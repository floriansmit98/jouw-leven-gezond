import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beaker, Droplets, Flame, Waves, Plus, Egg, Settings, LogOut, Clock, Sparkles, Search, Crown } from 'lucide-react';
import AdBanner from '@/components/AdBanner';
import { usePremium } from '@/contexts/PremiumContext';
import NutrientCard from '@/components/NutrientCard';
import GoalCard from '@/components/GoalCard';
import RiskAlerts from '@/components/RiskAlerts';
import DailyRiskScore from '@/components/DailyRiskScore';
import PageHeader from '@/components/PageHeader';
import { getLimits, getStatusColor, getGoalStatus } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTodayEntries } from '@/hooks/useFoods';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function Index() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const limits = getLimits();
  const { entries } = useTodayEntries();

  const totals = useMemo(() => ({
    potassium: entries.reduce((s, e) => s + Number(e.potassium_mg), 0),
    phosphate: entries.reduce((s, e) => s + Number(e.phosphate_mg), 0),
    sodium: entries.reduce((s, e) => s + Number(e.sodium_mg), 0),
    protein: entries.reduce((s, e) => s + Number(e.protein_g), 0),
    fluid: entries.reduce((s, e) => s + Number(e.fluid_ml), 0),
  }), [entries]);

  // Sort nutrients by criticality
  const nutrientCards = useMemo(() => {
    const items = [
      { type: 'limit' as const, key: 'potassium', label: 'Kalium', current: totals.potassium, limit: limits.potassium, unit: 'mg', icon: <Beaker className="h-5 w-5" /> },
      { type: 'limit' as const, key: 'phosphate', label: 'Fosfaat', current: totals.phosphate, limit: limits.phosphate, unit: 'mg', icon: <Flame className="h-5 w-5" /> },
      { type: 'limit' as const, key: 'sodium', label: 'Natrium', current: totals.sodium, limit: limits.sodium, unit: 'mg', icon: <Waves className="h-5 w-5" /> },
      { type: 'goal' as const, key: 'protein', label: 'Eiwit', current: totals.protein, limit: limits.protein, unit: 'g', icon: <Egg className="h-5 w-5" /> },
      { type: 'limit' as const, key: 'fluid', label: 'Vocht', current: totals.fluid, limit: limits.fluid, unit: 'ml', icon: <Droplets className="h-5 w-5" /> },
    ];

    // Score: danger=2, warning=1, safe=0
    const statusScore = (item: typeof items[0]) => {
      if (item.type === 'goal') {
        const s = getGoalStatus(item.current, item.limit);
        return s === 'danger' ? 2 : s === 'warning' ? 1 : 0;
      }
      const s = getStatusColor(item.current, item.limit);
      return s === 'danger' ? 2 : s === 'warning' ? 1 : 0;
    };

    return [...items].sort((a, b) => statusScore(b) - statusScore(a));
  }, [totals, limits]);

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader
          title="Goedendag 👋"
          mascotMessage="Welkom terug!"
          action={
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/premium')}
                className="rounded-lg bg-primary-foreground/20 p-2 text-primary-foreground transition-colors hover:bg-primary-foreground/30"
              >
                <Crown className="h-5 w-5" />
              </button>
              <button
                onClick={() => navigate('/instellingen')}
                className="rounded-lg bg-primary-foreground/20 p-2 text-primary-foreground transition-colors hover:bg-primary-foreground/30"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button
                onClick={signOut}
                className="rounded-lg bg-primary-foreground/20 p-2 text-primary-foreground transition-colors hover:bg-primary-foreground/30"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          }
        />

        {/* Search bar + dialyse action */}
        <div className="mb-5 flex gap-3">
          <button
            onClick={() => navigate('/voeding')}
            className="flex flex-1 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-accent/50"
          >
            <Search className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Wat heeft u gegeten?</span>
          </button>
          <Button onClick={() => navigate('/dialyse')} variant="outline" className="h-auto shrink-0 gap-2 rounded-2xl px-4 font-semibold">
            <Droplets className="h-5 w-5" /> Dialyse
          </Button>
        </div>

        {/* Daily risk score */}
        <div className="mb-5">
          <DailyRiskScore />
        </div>

        {/* Warnings */}
        <div className="mb-5">
          <RiskAlerts />
        </div>

        {/* Daily overview - sorted by criticality */}
        <div className="mb-5">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Dagoverzicht</h2>
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

        {/* Fluid schedule */}
        <div className="mb-6">
          <FluidScheduleSection totalLimit={limits.fluid} consumed={totals.fluid} />
        </div>
      </div>
    </div>
  );
}

interface ScheduleConfig {
  wakeTime: string;
  sleepTime: string;
  intervals: number;
}

function generateSchedule(totalLimit: number, config: ScheduleConfig) {
  const [wH, wM] = config.wakeTime.split(':').map(Number);
  const [sH, sM] = config.sleepTime.split(':').map(Number);
  const wakeMinutes = wH * 60 + wM;
  const sleepMinutes = sH * 60 + sM;
  const totalMinutes = sleepMinutes > wakeMinutes
    ? sleepMinutes - wakeMinutes
    : (24 * 60 - wakeMinutes) + sleepMinutes;

  const intervalMinutes = Math.floor(totalMinutes / config.intervals);
  const amountPerSlot = Math.round(totalLimit / config.intervals / 50) * 50 || 50;

  const slots: { time: string; amount: number }[] = [];
  for (let i = 0; i < config.intervals; i++) {
    const mins = (wakeMinutes + i * intervalMinutes) % (24 * 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    slots.push({
      time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      amount: amountPerSlot,
    });
  }
  return slots;
}

const SCHEDULE_STORAGE_KEY = 'fluid-schedule-config';

function FluidScheduleSection({ totalLimit, consumed }: { totalLimit: number; consumed: number }) {
  const [showSetup, setShowSetup] = useState(false);
  const [config, setConfig] = useState<ScheduleConfig | null>(() => {
    const stored = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  const [wakeTime, setWakeTime] = useState(config?.wakeTime || '07:00');
  const [sleepTime, setSleepTime] = useState(config?.sleepTime || '23:00');
  const [intervals, setIntervals] = useState(config?.intervals || 7);
  const remaining = Math.max(0, totalLimit - consumed);

  function handleCreate() {
    const newConfig: ScheduleConfig = { wakeTime, sleepTime, intervals };
    setConfig(newConfig);
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(newConfig));
    setShowSetup(false);
  }

  function handleReset() {
    setConfig(null);
    localStorage.removeItem(SCHEDULE_STORAGE_KEY);
  }

  if (!config) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <Droplets className="mx-auto mb-2 h-8 w-8 text-primary/40" />
        <p className="mb-1 text-sm font-semibold text-foreground">Vochtschema instellen</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Verdeel uw limiet van {totalLimit} ml over de dag.
        </p>
        <Button size="sm" onClick={() => setShowSetup(true)} className="gap-2 rounded-xl">
          <Sparkles className="h-4 w-4" /> Schema maken
        </Button>

        <Dialog open={showSetup} onOpenChange={setShowSetup}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Vochtschema instellen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-sm">Wakker worden</Label>
                <Input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} className="mt-1 h-12 rounded-xl text-base" />
              </div>
              <div>
                <Label className="text-sm">Slapen gaan</Label>
                <Input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} className="mt-1 h-12 rounded-xl text-base" />
              </div>
              <div>
                <Label className="text-sm">Drinkmomenten</Label>
                <Input type="number" min={3} max={12} value={intervals} onChange={e => setIntervals(Math.max(3, Math.min(12, parseInt(e.target.value) || 7)))} className="mt-1 h-12 rounded-xl text-base" />
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                {totalLimit} ml ÷ {intervals} = ±{Math.round(totalLimit / intervals)} ml per moment
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSetup(false)}>Annuleren</Button>
              <Button onClick={handleCreate} className="gap-2">
                <Sparkles className="h-4 w-4" /> Maken
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const schedule = generateSchedule(totalLimit, config);
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Prominent remaining fluid */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-primary" />
          <span className="text-base font-bold text-foreground">Nog {remaining} ml</span>
          <span className="text-sm text-muted-foreground">beschikbaar</span>
        </div>
        <button onClick={handleReset} className="text-xs text-muted-foreground underline hover:text-foreground">
          Wijzigen
        </button>
      </div>
      <div className="space-y-1.5">
        {schedule.map((slot, i) => {
          const [h, m] = slot.time.split(':').map(Number);
          const isPast = h < currentHour || (h === currentHour && m <= currentMinute);
          const isCurrent = h === currentHour;
          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                isCurrent
                  ? 'bg-primary/10 font-semibold text-primary ring-1 ring-primary/20'
                  : isPast
                    ? 'bg-muted/50 text-muted-foreground line-through'
                    : 'bg-secondary/50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                {slot.time}
              </span>
              <span>{slot.amount} ml</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
