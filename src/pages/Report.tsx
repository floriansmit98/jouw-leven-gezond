import { useState } from 'react';
import { FileText, Download, Calendar, Share2, Eye, ArrowLeft, Save } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLimits, getDialysisSessions, type DialysisSession } from '@/lib/store';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { generateReportPdf, type FoodRecord, type SymptomRecord } from '@/lib/generateReportPdf';
import type { jsPDF } from 'jspdf';

type Period = '1' | '7' | '14' | '30';

function getPeriodStart(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

export default function Report() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('7');
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfInstance, setPdfInstance] = useState<jsPDF | null>(null);
  const isMobile = useIsMobile();

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
    enabled: !!user,
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
    enabled: !!user,
  });

  const allSessions = getDialysisSessions();
  const sessions = allSessions.filter(s => new Date(s.date) >= periodStart);
  const limits = getLimits();

  const buildPdf = () => {
    return generateReportPdf(days, foods, symptoms, sessions, limits);
  };

  const getFileName = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    return `dialyse-rapport-${dateStr}.pdf`;
  };

  const getPdfBlob = (pdf: jsPDF): Blob => {
    return pdf.output('blob');
  };

  // Generate and show in-app preview
  const handlePreview = async () => {
    setGenerating(true);
    try {
      const pdf = buildPdf();
      const blob = getPdfBlob(pdf);
      const url = URL.createObjectURL(blob);
      setPdfInstance(pdf);
      setPreviewUrl(url);
    } catch {
      toast({ title: 'Fout', description: 'Het rapport kon niet worden gegenereerd.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPdfInstance(null);
  };

  // Save: use jsPDF.save which triggers a real download
  const handleSave = () => {
    try {
      const pdf = pdfInstance ?? buildPdf();
      pdf.save(getFileName());
      toast({ title: 'Rapport opgeslagen', description: 'Het PDF-bestand wordt gedownload.' });
    } catch {
      toast({ title: 'Fout', description: 'Het bestand kon niet worden opgeslagen. Probeer "Delen".', variant: 'destructive' });
    }
  };

  // Share: native share with the actual PDF file
  const handleShare = async () => {
    try {
      const pdf = pdfInstance ?? buildPdf();
      const blob = getPdfBlob(pdf);
      const file = new File([blob], getFileName(), { type: 'application/pdf' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Dialyse Rapport', files: [file] });
        return; // success — share dialog was shown
      }

      // Fallback: try sharing without file
      if (navigator.share) {
        const dataUrl = pdf.output('datauristring');
        await navigator.share({ title: 'Dialyse Rapport', text: 'Bekijk het dialyse rapport.', url: dataUrl });
        return;
      }

      // Last fallback: copy data URL
      toast({ title: 'Delen niet beschikbaar', description: 'Uw browser ondersteunt delen niet. Gebruik "Opslaan" om het bestand te downloaden.', variant: 'destructive' });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      toast({ title: 'Fout', description: 'Het rapport kon niet worden gedeeld. Probeer "Opslaan".', variant: 'destructive' });
    }
  };

  // Open in browser tab
  const handleOpen = () => {
    try {
      const pdf = pdfInstance ?? buildPdf();
      const blob = getPdfBlob(pdf);
      const url = URL.createObjectURL(blob);
      // Use an anchor with target _blank as fallback for window.open
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      // On iOS Safari, window.open in user-gesture context works better
      const win = window.open(url, '_blank');
      if (!win) {
        // Fallback: trigger via anchor click
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast({ title: 'Fout', description: 'Het rapport kon niet worden geopend. Probeer "Delen" of "Opslaan".', variant: 'destructive' });
    }
  };

  const periodLabels: Record<Period, string> = {
    '1': 'Vandaag',
    '7': 'Afgelopen week',
    '14': 'Afgelopen 2 weken',
    '30': 'Afgelopen maand',
  };

  // Preview screen
  if (previewUrl) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Button variant="ghost" size="icon" onClick={closePreview}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-base font-semibold">Rapport voorbeeld</h1>
        </div>

        <div className="flex-1 overflow-hidden">
          <iframe
            src={previewUrl}
            className="h-full w-full border-0"
            title="Rapport PDF"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 border-t bg-background p-3">
          <Button onClick={handleSave} variant="outline" className="flex-col gap-1 h-auto py-3">
            <Save className="h-5 w-5" />
            <span className="text-xs">Opslaan</span>
          </Button>
          <Button onClick={handleShare} variant="outline" className="flex-col gap-1 h-auto py-3">
            <Share2 className="h-5 w-5" />
            <span className="text-xs">Delen</span>
          </Button>
          <Button onClick={handleOpen} variant="outline" className="flex-col gap-1 h-auto py-3">
            <Eye className="h-5 w-5" />
            <span className="text-xs">Openen</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader title="Rapport" mascotMood="neutral" mascotMessage="Exporteer uw gegevens voor uw arts." />

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

        <div className="grid grid-cols-1 gap-3">
          <Button onClick={handlePreview} disabled={generating} size="lg" className="h-14 gap-2 text-base font-semibold">
            <FileText className="h-5 w-5" />
            {generating ? 'Genereren...' : 'Rapport genereren (PDF)'}
          </Button>

          {!isMobile && (
            <Button onClick={handleSave} variant="outline" size="lg" className="h-14 gap-2 text-base font-semibold">
              <Download className="h-5 w-5" />
              Direct downloaden
            </Button>
          )}
        </div>

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
