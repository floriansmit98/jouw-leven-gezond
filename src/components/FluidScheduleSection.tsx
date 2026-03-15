import { useState } from 'react';
import { Droplets, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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

export default function FluidScheduleSection({ totalLimit, consumed }: { totalLimit: number; consumed: number }) {
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
