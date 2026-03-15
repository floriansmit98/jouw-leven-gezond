import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beaker, Flame, Waves, Egg, Droplets, Clock, CalendarCheck, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useDialysisPeriodTotals } from '@/hooks/useDialysisPeriod';
import NutrientCard from '@/components/NutrientCard';
import GoalCard from '@/components/GoalCard';
import { Button } from '@/components/ui/button';
import { getStatusColor, getGoalStatus } from '@/lib/store';

function formatDatetime(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatHours(hours: number): string {
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  if (days > 0) return `${days}d ${h}u`;
  return `${h} uur`;
}

export default function DialysisPeriodView() {
  const navigate = useNavigate();
  const {
    totals,
    periodLimits,
    periodDays,
    elapsedHours,
    overallStatus,
    lastEnd,
    nextDialysis,
  } = useDialysisPeriodTotals();

  const nutrientCards = useMemo(() => {
    const items = [
      { type: 'limit' as const, key: 'potassium', label: 'Kalium', current: totals.potassium, limit: periodLimits.potassium, unit: 'mg', icon: <Beaker className="h-5 w-5" /> },
      { type: 'limit' as const, key: 'phosphate', label: 'Fosfaat', current: totals.phosphate, limit: periodLimits.phosphate, unit: 'mg', icon: <Flame className="h-5 w-5" /> },
      { type: 'limit' as const, key: 'sodium', label: 'Natrium', current: totals.sodium, limit: periodLimits.sodium, unit: 'mg', icon: <Waves className="h-5 w-5" /> },
      { type: 'goal' as const, key: 'protein', label: 'Eiwit', current: totals.protein, limit: periodLimits.protein, unit: 'g', icon: <Egg className="h-5 w-5" /> },
      { type: 'limit' as const, key: 'fluid', label: 'Vocht', current: totals.fluid, limit: periodLimits.fluid, unit: 'ml', icon: <Droplets className="h-5 w-5" /> },
    ];

    const statusScore = (item: typeof items[0]) => {
      if (item.type === 'goal') {
        const s = getGoalStatus(item.current, item.limit);
        return s === 'danger' ? 2 : s === 'warning' ? 1 : 0;
      }
      const s = getStatusColor(item.current, item.limit);
      return s === 'danger' ? 2 : s === 'warning' ? 1 : 0;
    };

    return [...items].sort((a, b) => statusScore(b) - statusScore(a));
  }, [totals, periodLimits]);

  if (!lastEnd) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="mb-2 font-semibold text-foreground">Geen dialyse ingesteld</p>
        <p className="mb-4 text-sm text-muted-foreground">
          Stel uw dialyseschema in bij Instellingen om de tussenperiode bij te houden.
        </p>
        <Button onClick={() => navigate('/instellingen')} variant="outline" className="rounded-xl">
          Naar instellingen
        </Button>
      </div>
    );
  }

  const statusConfig = {
    ontrack: {
      bg: 'bg-safe/8',
      border: 'border-safe/25',
      icon: <CheckCircle className="h-5 w-5 text-safe" />,
      label: 'Op schema',
      emoji: '🟢',
    },
    caution: {
      bg: 'bg-warning/8',
      border: 'border-warning/25',
      icon: <Info className="h-5 w-5 text-warning" />,
      label: 'Let op',
      emoji: '🟠',
    },
    above: {
      bg: 'bg-danger/8',
      border: 'border-danger/25',
      icon: <AlertTriangle className="h-5 w-5 text-danger" />,
      label: 'Boven richtlijn',
      emoji: '🔴',
    },
  }[overallStatus];

  return (
    <div className="space-y-4">
      {/* Period info */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Laatste dialyse</p>
            <p className="font-semibold text-foreground">{formatDatetime(lastEnd)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Volgende dialyse</p>
            <p className="font-semibold text-foreground">{formatDatetime(nextDialysis)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Verstreken tijd</p>
            <p className="font-semibold text-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {formatHours(elapsedHours)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Periode</p>
            <p className="font-semibold text-foreground flex items-center gap-1">
              <CalendarCheck className="h-3.5 w-3.5" /> {periodDays} {periodDays === 1 ? 'dag' : 'dagen'}
            </p>
          </div>
        </div>
      </div>

      {/* Overall status */}
      <div className={`rounded-xl border p-4 ${statusConfig.bg} ${statusConfig.border}`}>
        <div className="flex items-center gap-3">
          {statusConfig.icon}
          <div>
            <p className="text-xs text-muted-foreground">Status tussenperiode</p>
            <p className="font-semibold text-foreground">{statusConfig.emoji} {statusConfig.label}</p>
          </div>
        </div>
      </div>

      {/* Nutrient cards */}
      <div>
        <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
          Totaal sinds laatste dialyse
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Limieten zijn berekend voor {periodDays} {periodDays === 1 ? 'dag' : 'dagen'} tussen sessies.
        </p>
        <div className="grid gap-3">
          {nutrientCards.map(item =>
            item.type === 'goal' ? (
              <GoalCard key={item.key} label={item.label} current={item.current} goal={item.limit} unit={item.unit} icon={item.icon} />
            ) : (
              <NutrientCard key={item.key} label={item.label} current={item.current} limit={item.limit} unit={item.unit} icon={item.icon} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
