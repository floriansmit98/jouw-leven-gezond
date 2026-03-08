import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beaker, Droplets, Flame, Waves, Plus, Egg, Settings, LogOut, Clock, Sparkles } from 'lucide-react';
import NutrientCard from '@/components/NutrientCard';
import GoalCard from '@/components/GoalCard';
import RiskAlerts from '@/components/RiskAlerts';
import PageHeader from '@/components/PageHeader';
import { getLimits } from '@/lib/store';
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

  const totals = {
    potassium: entries.reduce((s, e) => s + Number(e.potassium_mg), 0),
    phosphate: entries.reduce((s, e) => s + Number(e.phosphate_mg), 0),
    sodium: entries.reduce((s, e) => s + Number(e.sodium_mg), 0),
    protein: entries.reduce((s, e) => s + Number(e.protein_g), 0),
    fluid: entries.reduce((s, e) => s + Number(e.fluid_ml), 0),
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader
          title="Goedendag 👋"
          mascotMood="greeting"
          mascotMessage="Welkom terug! Hier ziet u uw dagelijkse overzicht."
          action={
            <div className="flex gap-2">
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

        <div className="mb-6 grid grid-cols-2 gap-3">
          <Button onClick={() => navigate('/voeding')} className="h-14 gap-2 rounded-xl bg-primary text-primary-foreground text-base font-semibold shadow-md">
            <Plus className="h-5 w-5" /> Voeding loggen
          </Button>
          <Button onClick={() => navigate('/dialyse')} variant="outline" className="h-14 gap-2 rounded-xl text-base font-semibold">
            <Droplets className="h-5 w-5" /> Dialyse loggen
          </Button>
        </div>

        <div className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Risicoanalyse</h2>
          <RiskAlerts />
        </div>

        <div className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Dagelijks overzicht</h2>
          <div className="grid gap-3">
            <NutrientCard label="Kalium" current={totals.potassium} limit={limits.potassium} unit="mg" icon={<Beaker className="h-5 w-5" />} />
            <NutrientCard label="Fosfaat" current={totals.phosphate} limit={limits.phosphate} unit="mg" icon={<Flame className="h-5 w-5" />} />
            <NutrientCard label="Natrium" current={totals.sodium} limit={limits.sodium} unit="mg" icon={<Waves className="h-5 w-5" />} />
            <GoalCard label="Eiwit" current={totals.protein} goal={limits.protein} unit="g" icon={<Egg className="h-5 w-5" />} />
            <NutrientCard label="Vocht" current={totals.fluid} limit={limits.fluid} unit="ml" icon={<Droplets className="h-5 w-5" />} />
          </div>
        </div>

        <div className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Vochtschema</h2>
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
      <div className="rounded-xl border border-border bg-card p-5 text-center">
        <Droplets className="mx-auto mb-3 h-10 w-10 text-primary/40" />
        <p className="mb-1 text-sm font-semibold text-foreground">Wilt u een persoonlijk vochtschema?</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Verdeel uw dagelijkse vochtlimiet over de dag, afgestemd op uw wak- en slaaptijden.
        </p>
        <Button onClick={() => setShowSetup(true)} className="gap-2 rounded-xl">
          <Sparkles className="h-4 w-4" /> Maak vochtschema
        </Button>

        <Dialog open={showSetup} onOpenChange={setShowSetup}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Vochtschema instellen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-sm">Hoe laat wordt u wakker?</Label>
                <Input
                  type="time"
                  value={wakeTime}
                  onChange={e => setWakeTime(e.target.value)}
                  className="mt-1 h-12 rounded-xl text-base"
                />
              </div>
              <div>
                <Label className="text-sm">Hoe laat gaat u slapen?</Label>
                <Input
                  type="time"
                  value={sleepTime}
                  onChange={e => setSleepTime(e.target.value)}
                  className="mt-1 h-12 rounded-xl text-base"
                />
              </div>
              <div>
                <Label className="text-sm">Hoeveel drinkmomenten?</Label>
                <Input
                  type="number"
                  min={3}
                  max={12}
                  value={intervals}
                  onChange={e => setIntervals(Math.max(3, Math.min(12, parseInt(e.target.value) || 7)))}
                  className="mt-1 h-12 rounded-xl text-base"
                />
                <p className="mt-1 text-xs text-muted-foreground">Tussen 3 en 12 momenten</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                Uw vochtlimiet is <span className="font-bold text-foreground">{totalLimit} ml</span> per dag.
                Dit wordt verdeeld over <span className="font-bold text-foreground">{intervals}</span> momenten
                (±{Math.round(totalLimit / intervals)} ml per moment).
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSetup(false)}>Annuleren</Button>
              <Button onClick={handleCreate} className="gap-2">
                <Sparkles className="h-4 w-4" /> Schema maken
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const schedule = generateSchedule(totalLimit, config);
  const remaining = Math.max(0, totalLimit - consumed);
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Nog <span className="font-bold text-foreground">{remaining} ml</span> beschikbaar
        </div>
        <button
          onClick={handleReset}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Schema wijzigen
        </button>
      </div>
      <div className="space-y-2">
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
