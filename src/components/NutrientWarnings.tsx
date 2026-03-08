import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import type { NutrientWarning, DailyWarning, RiskLevel } from '@/lib/nutrientWarnings';
import { RISK_STYLES } from '@/lib/nutrientWarnings';

/** Inline badges for per-food warnings (e.g. "Hoog in kalium") */
export function WarningBadges({ warnings }: { warnings: NutrientWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {warnings.map((w) => {
        const s = RISK_STYLES[w.level];
        return (
          <span
            key={w.nutrient}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${s.bg} ${s.border} ${s.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
            {w.label}
          </span>
        );
      })}
    </div>
  );
}

/** Expandable detail messages for per-food warnings */
export function WarningMessages({ warnings }: { warnings: NutrientWarning[] }) {
  if (warnings.length === 0) return null;

  // Only show hoog and letop messages
  const relevant = warnings.filter(w => w.level === 'hoog' || w.level === 'letop');
  if (relevant.length === 0) return null;

  return (
    <div className="space-y-1">
      {relevant.map((w) => {
        const s = RISK_STYLES[w.level];
        const Icon = w.level === 'hoog' ? AlertTriangle : Info;
        return (
          <div key={w.nutrient} className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 ${s.bg}`}>
            <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${s.text}`} />
            <p className="text-xs text-foreground">{w.message}</p>
          </div>
        );
      })}
    </div>
  );
}

/** Daily/meal total warning alerts */
export function DailyWarningAlerts({ warnings }: { warnings: DailyWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => {
        const s = RISK_STYLES[w.level];
        const Icon = w.level === 'hoog' ? AlertTriangle : Info;
        return (
          <div
            key={i}
            className={`flex items-start gap-2.5 rounded-xl border p-3 ${s.bg} ${s.border}`}
          >
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${s.text}`} />
            <p className="text-sm font-medium text-foreground">{w.message}</p>
          </div>
        );
      })}
    </div>
  );
}
