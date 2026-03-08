import { useState } from 'react';
import { FileText, Download, Calendar, Share2, ExternalLink } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLimits, getDialysisSessions, SYMPTOM_LABELS, type DialysisSession, type DailyLimits, type SymptomType } from '@/lib/store';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

type Period = '1' | '7' | '14' | '30';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface FoodRecord {
  id: string;
  name: string;
  potassium_mg: number;
  phosphate_mg: number;
  sodium_mg: number;
  protein_g: number;
  fluid_ml: number;
  portions: number;
  logged_at: string;
}

interface SymptomRecord {
  id: string;
  symptom_name: string;
  severity_score: number;
  notes: string | null;
  logged_at: string;
}

function getPeriodStart(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function generateReportText(
  period: number,
  foods: FoodRecord[],
  symptoms: SymptomRecord[],
  sessions: DialysisSession[],
  limits: DailyLimits
): string {
  const now = new Date();
  const startDate = getPeriodStart(period);

  const lines: string[] = [];
  lines.push('═══════════════════════════════════════');
  lines.push('    DIALYSE PATIËNT RAPPORT');
  lines.push('═══════════════════════════════════════');
  lines.push('');
  lines.push(`Periode: ${formatDate(startDate.toISOString())} - ${formatDate(now.toISOString())}`);
  lines.push(`Gegenereerd op: ${formatDate(now.toISOString())} om ${now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`);
  lines.push('');

  lines.push('───────────────────────────────────────');
  lines.push('  INGESTELDE DAGLIMIETEN');
  lines.push('───────────────────────────────────────');
  lines.push(`  Kalium:   ${limits.potassium} mg`);
  lines.push(`  Fosfaat:  ${limits.phosphate} mg`);
  lines.push(`  Natrium:  ${limits.sodium} mg`);
  lines.push(`  Eiwit:    ${limits.protein} g`);
  lines.push(`  Vocht:    ${limits.fluid} ml`);
  lines.push('');

  if (foods.length > 0) {
    const totalK = foods.reduce((s, f) => s + Number(f.potassium_mg), 0);
    const totalP = foods.reduce((s, f) => s + Number(f.phosphate_mg), 0);
    const totalNa = foods.reduce((s, f) => s + Number(f.sodium_mg), 0);
    const totalPr = foods.reduce((s, f) => s + Number(f.protein_g), 0);
    const totalFl = foods.reduce((s, f) => s + Number(f.fluid_ml), 0);
    const days = period;

    lines.push('───────────────────────────────────────');
    lines.push('  VOEDINGSINNAME (GEMIDDELD PER DAG)');
    lines.push('───────────────────────────────────────');
    lines.push(`  Kalium:   ${Math.round(totalK / days)} mg  (limiet: ${limits.potassium} mg)`);
    lines.push(`  Fosfaat:  ${Math.round(totalP / days)} mg  (limiet: ${limits.phosphate} mg)`);
    lines.push(`  Natrium:  ${Math.round(totalNa / days)} mg  (limiet: ${limits.sodium} mg)`);
    lines.push(`  Eiwit:    ${Math.round(totalPr / days)} g   (limiet: ${limits.protein} g)`);
    lines.push(`  Vocht:    ${Math.round(totalFl / days)} ml  (limiet: ${limits.fluid} ml)`);
    lines.push('');
    lines.push(`  Totaal registraties: ${foods.length}`);
    lines.push('');

    lines.push('  Voedingsdetails per dag:');
    const byDate = new Map<string, FoodRecord[]>();
    foods.forEach(f => {
      const day = f.logged_at.split('T')[0];
      if (!byDate.has(day)) byDate.set(day, []);
      byDate.get(day)!.push(f);
    });

    Array.from(byDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([date, entries]) => {
        const dayK = entries.reduce((s, f) => s + Number(f.potassium_mg), 0);
        const dayP = entries.reduce((s, f) => s + Number(f.phosphate_mg), 0);
        const dayNa = entries.reduce((s, f) => s + Number(f.sodium_mg), 0);
        const dayFl = entries.reduce((s, f) => s + Number(f.fluid_ml), 0);
        lines.push(`    ${formatDate(date + 'T00:00:00')}: K=${dayK}mg P=${dayP}mg Na=${dayNa}mg Vocht=${dayFl}ml`);
        entries.forEach(e => lines.push(`      • ${e.name} (${e.portions}x)`));
      });
    lines.push('');
  } else {
    lines.push('  Geen voedingsregistraties in deze periode.');
    lines.push('');
  }

  if (symptoms.length > 0) {
    lines.push('───────────────────────────────────────');
    lines.push('  SYMPTOMEN');
    lines.push('───────────────────────────────────────');

    const symptomCounts = new Map<string, { count: number; totalSeverity: number }>();
    symptoms.forEach(s => {
      const label = SYMPTOM_LABELS[s.symptom_name as SymptomType] || s.symptom_name;
      if (!symptomCounts.has(label)) symptomCounts.set(label, { count: 0, totalSeverity: 0 });
      const entry = symptomCounts.get(label)!;
      entry.count++;
      entry.totalSeverity += s.severity_score;
    });

    symptomCounts.forEach((data, label) => {
      const avgSeverity = (data.totalSeverity / data.count).toFixed(1);
      lines.push(`  ${label}: ${data.count}x gemeld (gem. ernst: ${avgSeverity}/5)`);
    });
    lines.push('');

    lines.push('  Symptoomdetails:');
    [...symptoms]
      .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
      .forEach(s => {
        const label = SYMPTOM_LABELS[s.symptom_name as SymptomType] || s.symptom_name;
        const stars = '●'.repeat(s.severity_score) + '○'.repeat(5 - s.severity_score);
        lines.push(`    ${formatDate(s.logged_at)} - ${label} [${stars}]${s.notes ? ` - ${s.notes}` : ''}`);
      });
    lines.push('');
  } else {
    lines.push('  Geen symptomen geregistreerd in deze periode.');
    lines.push('');
  }

  if (sessions.length > 0) {
    lines.push('───────────────────────────────────────');
    lines.push('  DIALYSE SESSIES');
    lines.push('───────────────────────────────────────');
    lines.push(`  Aantal sessies: ${sessions.length}`);

    const avgFluidRemoved = sessions.reduce((s, d) => s + d.fluidRemoved, 0) / sessions.length;
    lines.push(`  Gem. vocht verwijderd: ${Math.round(avgFluidRemoved)} ml`);
    lines.push('');

    [...sessions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(s => {
        const weightChange = s.weightBefore - s.weightAfter;
        lines.push(`    ${formatDate(s.date + 'T00:00:00')} | ${s.type}`);
        lines.push(`      Gewicht: ${s.weightBefore}kg → ${s.weightAfter}kg (−${weightChange.toFixed(1)}kg)`);
        lines.push(`      Vocht verwijderd: ${s.fluidRemoved}ml`);
        if (s.notes) lines.push(`      Notities: ${s.notes}`);
      });
    lines.push('');
  }

  lines.push('═══════════════════════════════════════');
  lines.push('  Gegenereerd door NierDieet App');
  lines.push('  Dit rapport is bedoeld als hulpmiddel');
  lines.push('  en vervangt geen medisch advies.');
  lines.push('═══════════════════════════════════════');

  return lines.join('\n');
}

export default function Report() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('7');
  const [generating, setGenerating] = useState(false);
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

  // Dialysis sessions still from localStorage, filtered by period
  const allSessions = getDialysisSessions();
  const sessions = allSessions.filter(s => {
    const d = new Date(s.date);
    return d >= periodStart;
  });

  const limits = getLimits();

  const generateReportBlob = () => {
    const text = generateReportText(days, foods, symptoms, sessions, limits);
    return new Blob([text], { type: 'text/plain;charset=utf-8' });
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const blob = generateReportBlob();
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `dialyse-rapport-${dateStr}.txt`;

      if (isMobile && navigator.share) {
        // Mobile: use native share with file attachment
        const file = new File([blob], fileName, { type: 'text/plain;charset=utf-8' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: 'Dialyse Rapport', files: [file] });
          toast({ title: 'Rapport gedeeld', description: 'Het rapport is succesvol verstuurd.' });
        } else {
          // Fallback: open in new tab
          openInNewTab(blob);
        }
      } else {
        // Desktop: direct download via anchor
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast({ title: 'Rapport gedownload', description: 'Het rapport is succesvol aangemaakt.' });
      }
    } catch (err) {
      // Don't show error if user cancelled the share dialog
      if (err instanceof Error && err.name === 'AbortError') return;
      toast({ title: 'Fout', description: 'Het rapport kon niet worden gedownload. Probeer "Open rapport" of "Delen".', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const openInNewTab = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      toast({ title: 'Geblokkeerd', description: 'Uw browser blokkeert het openen van het rapport. Gebruik "Delen" om het rapport te versturen.', variant: 'destructive' });
      URL.revokeObjectURL(url);
    } else {
      toast({ title: 'Rapport geopend', description: 'Het rapport is geopend in een nieuw tabblad.' });
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  };

  const handleOpenReport = () => {
    try {
      const blob = generateReportBlob();
      openInNewTab(blob);
    } catch {
      toast({ title: 'Fout', description: 'Er ging iets mis bij het genereren.', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    try {
      const blob = generateReportBlob();
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `dialyse-rapport-${dateStr}.txt`;
      const file = new File([blob], fileName, { type: 'text/plain;charset=utf-8' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Dialyse Rapport', files: [file] });
      } else if (navigator.share) {
        const text = generateReportText(days, foods, symptoms, sessions, limits);
        await navigator.share({ title: 'Dialyse Rapport', text });
      } else {
        const text = generateReportText(days, foods, symptoms, sessions, limits);
        await navigator.clipboard.writeText(text);
        toast({ title: 'Gekopieerd', description: 'Het rapport is naar het klembord gekopieerd.' });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      toast({ title: 'Fout', description: 'Het rapport kon niet worden gedeeld.', variant: 'destructive' });
    }
  };

  const periodLabels: Record<Period, string> = {
    '1': 'Vandaag',
    '7': 'Afgelopen week',
    '14': 'Afgelopen 2 weken',
    '30': 'Afgelopen maand',
  };

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
          <Button onClick={handleDownload} disabled={generating} size="lg" className="h-14 gap-2 text-base font-semibold">
            <Download className="h-5 w-5" />
            {generating ? 'Genereren...' : (isMobile ? 'Download / Deel rapport' : 'Download rapport')}
          </Button>
          <Button onClick={handleOpenReport} variant="outline" size="lg" className="h-14 gap-2 text-base font-semibold">
            <ExternalLink className="h-5 w-5" />
            Open rapport
          </Button>
          <Button onClick={handleShare} variant="outline" size="lg" className="h-14 gap-2 text-base font-semibold">
            <Share2 className="h-5 w-5" />
            Delen met arts
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Dit rapport bevat een overzicht van uw voedingsinname, symptomen en dialyse sessies.
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
