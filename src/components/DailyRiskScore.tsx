import { useMemo } from 'react';
import { Shield, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useTodayEntries } from '@/hooks/useFoods';
import { getLimits } from '@/lib/store';

type RiskLevel = 'laag' | 'verhoogd' | 'hoog';

interface NutrientStatus {
  label: string;
  ratio: number;
  level: RiskLevel;
  message: string;
}

function classifyRatio(ratio: number): RiskLevel {
  if (ratio >= 0.9) return 'hoog';
  if (ratio >= 0.7) return 'verhoogd';
  return 'laag';
}

export default function DailyRiskScore() {
  const { entries } = useTodayEntries();
  const limits = getLimits();

  const totals = useMemo(() => ({
    potassium: entries.reduce((s, e) => s + Number(e.potassium_mg), 0),
    phosphate: entries.reduce((s, e) => s + Number(e.phosphate_mg), 0),
    sodium: entries.reduce((s, e) => s + Number(e.sodium_mg), 0),
    fluid: entries.reduce((s, e) => s + Number(e.fluid_ml), 0),
  }), [entries]);

  const nutrients: NutrientStatus[] = useMemo(() => {
    const items = [
      { key: 'kalium', label: 'Kalium', current: totals.potassium, limit: limits.potassium },
      { key: 'fosfaat', label: 'Fosfaat', current: totals.phosphate, limit: limits.phosphate },
      { key: 'natrium', label: 'Natrium', current: totals.sodium, limit: limits.sodium },
      { key: 'vocht', label: 'Vocht', current: totals.fluid, limit: limits.fluid },
    ];

    return items.map(item => {
      const ratio = item.current / item.limit;
      const level = classifyRatio(ratio);
      const message = level === 'hoog'
        ? 'boven advies'
        : level === 'verhoogd'
          ? 'licht verhoogd'
          : 'binnen advies';
      return { label: item.label, ratio, level, message };
    });
  }, [totals, limits]);

  const overallLevel: RiskLevel = useMemo(() => {
    if (nutrients.some(n => n.level === 'hoog')) return 'hoog';
    if (nutrients.some(n => n.level === 'verhoogd')) return 'verhoogd';
    return 'laag';
  }, [nutrients]);

  const config = {
    laag: {
      bg: 'bg-safe/8',
      border: 'border-safe/25',
      iconBg: 'bg-safe/15',
      iconColor: 'text-safe',
      Icon: CheckCircle,
      title: 'Laag risico',
      emoji: '🟢',
    },
    verhoogd: {
      bg: 'bg-warning/8',
      border: 'border-warning/25',
      iconBg: 'bg-warning/15',
      iconColor: 'text-warning',
      Icon: Info,
      title: 'Let op vandaag',
      emoji: '🟠',
    },
    hoog: {
      bg: 'bg-danger/8',
      border: 'border-danger/25',
      iconBg: 'bg-danger/15',
      iconColor: 'text-danger',
      Icon: AlertTriangle,
      title: 'Verhoogd risico vandaag',
      emoji: '🔴',
    },
  }[overallLevel];

  const dotColor = {
    laag: 'bg-safe',
    verhoogd: 'bg-warning',
    hoog: 'bg-danger',
  };

  return (
    <div className={`rounded-xl border p-4 ${config.bg} ${config.border}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`rounded-lg p-2 ${config.iconBg}`}>
          <Shield className={`h-5 w-5 ${config.iconColor}`} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Dialyse risico vandaag</p>
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            {config.emoji} {config.title}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {nutrients.map(n => (
          <div key={n.label} className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor[n.level]}`} />
            <span className="text-foreground font-medium">{n.label}:</span>
            <span className={`text-xs ${
              n.level === 'hoog' ? 'text-danger font-semibold' :
              n.level === 'verhoogd' ? 'text-warning' :
              'text-muted-foreground'
            }`}>
              {n.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
