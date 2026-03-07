import { useState } from 'react';
import { FileText, Download, Calendar, Share2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getFoodEntries,
  getSymptomEntries,
  getDialysisSessions,
  getFluidEntries,
  getLimits,
  SYMPTOM_LABELS,
  type FoodEntry,
  type SymptomEntry,
  type DialysisSession,
  type FluidEntry,
  type DailyLimits,
} from '@/lib/store';
import { toast } from '@/hooks/use-toast';

type Period = '1' | '7' | '14' | '30';

function filterByDays<T extends { timestamp?: string; date?: string }>(items: T[], days: number): T[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return items.filter(item => {
    const d = new Date(item.timestamp || item.date || '');
    return d >= cutoff;
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function generateReportText(
  period: number,
  foods: FoodEntry[],
  symptoms: SymptomEntry[],
  sessions: DialysisSession[],
  fluids: FluidEntry[],
  limits: DailyLimits
): string {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  const lines: string[] = [];
  lines.push('═══════════════════════════════════════');
  lines.push('    DIALYSE PATIËNT RAPPORT');
  lines.push('═══════════════════════════════════════');
  lines.push('');
  lines.push(`Periode: ${formatDate(startDate.toISOString())} - ${formatDate(now.toISOString())}`);
  lines.push(`Gegenereerd op: ${formatDate(now.toISOString())} om ${now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`);
  lines.push('');

  // Daily limits
  lines.push('───────────────────────────────────────');
  lines.push('  INGESTELDE DAGLIMIETEN');
  lines.push('───────────────────────────────────────');
  lines.push(`  Kalium:   ${limits.potassium} mg`);
  lines.push(`  Fosfaat:  ${limits.phosphate} mg`);
  lines.push(`  Natrium:  ${limits.sodium} mg`);
  lines.push(`  Eiwit:    ${limits.protein} g`);
  lines.push(`  Vocht:    ${limits.fluid} ml`);
  lines.push('');

  // Nutrition summary
  if (foods.length > 0) {
    const totalK = foods.reduce((s, f) => s + f.potassium, 0);
    const totalP = foods.reduce((s, f) => s + f.phosphate, 0);
    const totalNa = foods.reduce((s, f) => s + f.sodium, 0);
    const totalPr = foods.reduce((s, f) => s + f.protein, 0);
    const totalFl = foods.reduce((s, f) => s + f.fluid, 0) + fluids.reduce((s, f) => s + f.amount, 0);
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
    lines.push(`  Totaal voedingsregistraties: ${foods.length}`);
    lines.push(`  Totaal vochtregistraties: ${fluids.length}`);
    lines.push('');

    // Daily breakdown
    lines.push('  Voedingsdetails per dag:');
    const byDate = new Map<string, FoodEntry[]>();
    foods.forEach(f => {
      const day = f.timestamp.split('T')[0];
      if (!byDate.has(day)) byDate.set(day, []);
      byDate.get(day)!.push(f);
    });
    
    Array.from(byDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([date, entries]) => {
        const dayK = entries.reduce((s, f) => s + f.potassium, 0);
        const dayP = entries.reduce((s, f) => s + f.phosphate, 0);
        const dayNa = entries.reduce((s, f) => s + f.sodium, 0);
        lines.push(`    ${formatDate(date + 'T00:00:00')}: K=${dayK}mg P=${dayP}mg Na=${dayNa}mg`);
        entries.forEach(e => lines.push(`      • ${e.name}`));
      });
    lines.push('');
  } else {
    lines.push('  Geen voedingsregistraties in deze periode.');
    lines.push('');
  }

  // Symptoms
  if (symptoms.length > 0) {
    lines.push('───────────────────────────────────────');
    lines.push('  SYMPTOMEN');
    lines.push('───────────────────────────────────────');
    
    const symptomCounts = new Map<string, { count: number; totalSeverity: number }>();
    symptoms.forEach(s => {
      const label = SYMPTOM_LABELS[s.type];
      if (!symptomCounts.has(label)) symptomCounts.set(label, { count: 0, totalSeverity: 0 });
      const entry = symptomCounts.get(label)!;
      entry.count++;
      entry.totalSeverity += s.severity;
    });

    symptomCounts.forEach((data, label) => {
      const avgSeverity = (data.totalSeverity / data.count).toFixed(1);
      lines.push(`  ${label}: ${data.count}x gemeld (gem. ernst: ${avgSeverity}/5)`);
    });
    lines.push('');

    lines.push('  Symptoomdetails:');
    [...symptoms]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .forEach(s => {
        const label = SYMPTOM_LABELS[s.type];
        const stars = '●'.repeat(s.severity) + '○'.repeat(5 - s.severity);
        lines.push(`    ${formatDate(s.timestamp)} - ${label} [${stars}]${s.notes ? ` - ${s.notes}` : ''}`);
      });
    lines.push('');
  } else {
    lines.push('  Geen symptomen geregistreerd in deze periode.');
    lines.push('');
  }

  // Dialysis sessions
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
  const [period, setPeriod] = useState<Period>('7');
  const [generating, setGenerating] = useState(false);

  const days = parseInt(period);
  const foods = filterByDays(getFoodEntries(), days);
  const symptoms = filterByDays(getSymptomEntries(), days);
  const sessions = filterByDays(getDialysisSessions(), days);
  const fluids = filterByDays(getFluidEntries(), days);
  const limits = getLimits();

  const handleDownload = () => {
    setGenerating(true);
    try {
      const text = generateReportText(days, foods, symptoms, sessions, fluids, limits);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `dialyse-rapport-${dateStr}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Rapport gedownload', description: 'Het rapport is succesvol aangemaakt.' });
    } catch {
      toast({ title: 'Fout', description: 'Er ging iets mis bij het genereren.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    const text = generateReportText(days, foods, symptoms, sessions, fluids, limits);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Dialyse Rapport',
          text,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Gekopieerd', description: 'Het rapport is naar het klembord gekopieerd.' });
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

        {/* Period selector */}
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

        {/* Summary preview */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              Overzicht ({periodLabels[period].toLowerCase()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <SummaryRow label="Voedingsregistraties" value={foods.length} />
              <SummaryRow label="Vochtregistraties" value={fluids.length} />
              <SummaryRow label="Symptoomregistraties" value={symptoms.length} />
              <SummaryRow label="Dialyse sessies" value={sessions.length} />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-3">
          <Button
            onClick={handleDownload}
            disabled={generating}
            size="lg"
            className="h-14 gap-2 text-base font-semibold"
          >
            <Download className="h-5 w-5" />
            {generating ? 'Genereren...' : 'Download rapport'}
          </Button>
          <Button
            onClick={handleShare}
            variant="outline"
            size="lg"
            className="h-14 gap-2 text-base font-semibold"
          >
            <Share2 className="h-5 w-5" />
            Delen met arts
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Dit rapport bevat een overzicht van uw voedingsinname, symptomen en dialyse sessies.
          U kunt het downloaden of direct delen met uw zorgverlener.
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
