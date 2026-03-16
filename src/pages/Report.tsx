import { useState } from 'react';
import { FileText, Download, Calendar, ArrowLeft } from 'lucide-react';
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

  const periodLabels: Record<Period, string> = {
    '1': 'Vandaag',
    '7': 'Afgelopen week',
    '14': 'Afgelopen 2 weken',
    '30': 'Afgelopen maand',
  };

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

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const handleDownload = () => {
    try {
      const pdf = ensurePdf();
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);

      if (isMobile) {
        const newTab = window.open(blobUrl, '_blank');
        if (!newTab) {
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = getFileName();
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        toast({ title: 'Rapport geopend', description: 'U kunt het PDF-bestand nu opslaan of delen.' });
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = getFileName();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'Rapport opgeslagen', description: 'Het PDF-bestand wordt gedownload.' });
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch {
      toast({ title: 'Fout', description: 'Het bestand kon niet worden gedownload.', variant: 'destructive' });
    }
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

        <div className="border-t bg-background p-3">
          <Button onClick={handleDownload} className="w-full gap-2 h-12">
            <Download className="h-5 w-5" />
            <span>Downloaden (PDF)</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader title="Rapport" mascotMessage="Exporteer uw gegevens voor uw arts." />

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
