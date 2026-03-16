import { useState } from 'react';
import { FileText, Download, Calendar, Share2, ArrowLeft, Mail, MessageCircle, Copy, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ReportPreview from '@/components/ReportPreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLimits, getDialysisSessions, type DialysisSession } from '@/lib/store';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { generateReportPdf, type FoodRecord, type SymptomRecord } from '@/lib/generateReportPdf';
import type { jsPDF } from 'jspdf';
import { usePremium } from '@/contexts/PremiumContext';
import PremiumBanner from '@/components/PremiumBanner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type Period = '1' | '7' | '14' | '30';

function getPeriodStart(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

export default function Report() {
  const { isPremium } = usePremium();
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('7');
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfInstance, setPdfInstance] = useState<jsPDF | null>(null);

  const days = parseInt(period, 10);
  const periodStart = getPeriodStart(days);
  const periodStartIso = periodStart.toISOString();

  const { data: foods = [] } = useQuery({
    queryKey: ['report_foods', user?.id, days],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', periodStartIso)
        .order('logged_at', { ascending: false });
      if (error) throw error;
      return data as FoodRecord[];
    },
    enabled: !!user && isPremium,
  });

  const { data: symptoms = [] } = useQuery({
    queryKey: ['report_symptoms', user?.id, days],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('symptom_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', periodStartIso)
        .order('logged_at', { ascending: false });
      if (error) throw error;
      return data as SymptomRecord[];
    },
    enabled: !!user && isPremium,
  });

  const allSessions = getDialysisSessions();
  const sessions = allSessions.filter(s => new Date(s.date) >= periodStart);
  const limits = getLimits();

  if (!isPremium) {
    return (
      <div className="min-h-screen pb-24">
        <div className="mx-auto max-w-lg px-4 pt-6">
          <PageHeader title="Rapport" mascotMessage="Exporteer uw gegevens voor uw arts." />
          <PremiumBanner
            title="Rapporten exporteren"
            description="Met Premium kunt u uw voedings-, symptoom- en dialysegegevens exporteren als PDF voor uw arts."
          />
        </div>
      </div>
    );
  }


  const getFileName = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    return `dialyse-rapport-${dateStr}.pdf`;
  };

  const ensurePdf = (): jsPDF => {
    if (pdfInstance) return pdfInstance;
    const pdf = generateReportPdf(days, foods, symptoms, sessions, limits);
    setPdfInstance(pdf);
    return pdf;
  };

  const handlePreview = () => {
    setGenerating(true);
    try {
      const pdf = generateReportPdf(days, foods, symptoms, sessions, limits);
      setPdfInstance(pdf);
      setShowPreview(true);
    } catch {
      toast({ title: 'Fout', description: 'Het rapport kon niet worden gegenereerd.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const closePreview = () => {
    setShowPreview(false);
    setPdfInstance(null);
  };

  const handleDownload = () => {
    try {
      const pdf = ensurePdf();
      pdf.save(getFileName());
      toast({ title: 'Rapport opgeslagen', description: 'Het PDF-bestand wordt gedownload.' });
    } catch {
      toast({ title: 'Fout', description: 'Het bestand kon niet worden gedownload. Probeer "Delen".', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    try {
      const pdf = ensurePdf();
      const blob = pdf.output('blob');
      const file = new File([blob], getFileName(), { type: 'application/pdf' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Dialyse Rapport', files: [file] });
        return;
      }

      // Show share sheet with options
      setShowShareSheet(true);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setShowShareSheet(true);
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent('Mijn Dialyse Rapport');
    const body = encodeURIComponent('Hierbij mijn dialyse rapport. Het PDF-bestand is als bijlage toegevoegd of kan gedownload worden vanuit de app.');
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    setShowShareSheet(false);
    toast({ title: 'E-mail geopend', description: 'Download eerst het rapport en voeg het als bijlage toe.' });
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent('Bekijk mijn dialyse rapport. Ik heb het geëxporteerd vanuit de NierDieet App.');
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setShowShareSheet(false);
    toast({ title: 'WhatsApp geopend', description: 'Download eerst het rapport om het mee te sturen.' });
  };

  const handleCopyText = async () => {
    const text = `Dialyse Rapport - ${periodLabels[period]}\n\nVoeding: ${foods.length} registraties\nSymptomen: ${symptoms.length} registraties\nDialyse sessies: ${sessions.length}\n\nGeëxporteerd vanuit NierDieet App`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Gekopieerd', description: 'Rapportsamenvatting gekopieerd naar klembord.' });
    } catch {
      toast({ title: 'Fout', description: 'Kopiëren niet gelukt.', variant: 'destructive' });
    }
  };

  const periodLabels: Record<Period, string> = {
    '1': 'Vandaag',
    '7': 'Afgelopen week',
    '14': 'Afgelopen 2 weken',
    '30': 'Afgelopen maand',
  };

  // Preview screen
  if (showPreview) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Button variant="ghost" size="icon" onClick={closePreview}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-base font-semibold">Rapport voorbeeld</h1>
          <Button variant="ghost" size="icon" onClick={handleShare} aria-label="Delen">
            <Share2 className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ReportPreview
            period={days}
            foods={foods}
            symptoms={symptoms}
            sessions={sessions}
            limits={limits}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 border-t bg-background p-3">
          <Button onClick={handleDownload} className="flex-col gap-1 h-auto py-3">
            <Download className="h-5 w-5" />
            <span className="text-xs">Downloaden</span>
          </Button>
          <Button onClick={handleShare} variant="outline" className="flex-col gap-1 h-auto py-3">
            <Share2 className="h-5 w-5" />
            <span className="text-xs">Delen</span>
          </Button>
        </div>

        <Sheet open={showShareSheet} onOpenChange={setShowShareSheet}>
          <SheetContent side="bottom" className="rounded-t-2xl pb-8">
            <SheetHeader className="pb-2">
              <SheetTitle className="text-base">Rapport delen</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <button
                onClick={handleEmailShare}
                className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <span className="text-xs font-medium text-foreground">E-mail</span>
              </button>
              <button
                onClick={handleWhatsAppShare}
                className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-xs font-medium text-foreground">WhatsApp</span>
              </button>
              <button
                onClick={handleCopyText}
                className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  {copied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5 text-muted-foreground" />}
                </div>
                <span className="text-xs font-medium text-foreground">{copied ? 'Gekopieerd!' : 'Kopiëren'}</span>
              </button>
            </div>
            <div className="mt-4 pt-3 border-t">
              <Button onClick={handleDownload} variant="outline" className="w-full gap-2">
                <Download className="h-4 w-4" />
                Download PDF en deel handmatig
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Tip: download het PDF-bestand en voeg het als bijlage toe aan uw bericht.
            </p>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <div className="flex items-start justify-between">
          <PageHeader title="Rapport" mascotMessage="Exporteer uw gegevens voor uw arts." />
          <Button
            variant="ghost"
            size="icon"
            className="mt-1 shrink-0"
            onClick={handleShare}
            aria-label="Rapport delen"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>

        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-primary" />
              Periode selecteren
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(periodLabels) as [Period, string][]).map(([key, label]) => (
                <Button
                  key={key}
                  variant={period === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPeriod(key)}
                  className="text-sm"
                >
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              Overzicht ({periodLabels[period].toLowerCase()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <SummaryRow label="Voeding & vocht registraties" value={foods.length} />
              <SummaryRow label="Symptoomregistraties" value={symptoms.length} />
              <SummaryRow label="Dialyse sessies" value={sessions.length} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handlePreview} disabled={generating} size="lg" className="w-full h-14 gap-2 text-base font-semibold">
          <FileText className="h-5 w-5" />
          {generating ? 'Genereren...' : 'Rapport genereren (PDF)'}
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Het rapport wordt als PDF gegenereerd met uw voedingsinname, symptomen en dialyse sessies.
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
