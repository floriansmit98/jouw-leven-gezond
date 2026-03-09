import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { analyzeDailyWarnings, type DailyWarning } from '@/lib/nutrientWarnings';
import { RISK_STYLES } from '@/lib/nutrientWarnings';
import { useTodayEntries } from '@/hooks/useFoods';
import { getLimits } from '@/lib/store';
import { useMemo } from 'react';

export default function RiskAlerts() {
  const { entries } = useTodayEntries();
  const limits = getLimits();

  const totals = useMemo(() => ({
    potassium: entries.reduce((s, e) => s + Number(e.potassium_mg), 0),
    phosphate: entries.reduce((s, e) => s + Number(e.phosphate_mg), 0),
    sodium: entries.reduce((s, e) => s + Number(e.sodium_mg), 0),
    protein: entries.reduce((s, e) => s + Number(e.protein_g), 0),
    fluid: entries.reduce((s, e) => s + Number(e.fluid_ml), 0),
  }), [entries]);

  const warnings = analyzeDailyWarnings(totals, limits);

  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-safe/20 bg-safe/8 p-4">
        <div className="rounded-lg bg-safe/15 p-2">
          <CheckCircle className="h-5 w-5 shrink-0 text-safe" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Alles ziet er goed uit!</p>
          <p className="text-sm text-muted-foreground">Geen waarschuwingen vandaag.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {warnings.map((warning, i) => {
        const s = RISK_STYLES[warning.level];
        const Icon = warning.level === 'hoog' ? AlertTriangle : Info;
        return (
          <div
            key={i}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${s.bg} ${s.border}`}
          >
            <div className={`rounded-lg p-1.5 ${s.bg}`}>
              <Icon className={`h-4 w-4 shrink-0 ${s.text}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{warning.title}</p>
              <p className="text-xs text-muted-foreground">{warning.subtitle}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
