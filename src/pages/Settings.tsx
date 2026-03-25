import PageShell from "@/components/PageShell";
import AdBanner from '@/components/AdBanner';
import { useState } from 'react';
import { Settings, Save, Beaker, Flame, Waves, Egg, Droplets, Info, Calendar, Clock, RotateCcw } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLimits, saveLimits, getDialysisSchedule, saveDialysisSchedule, type DailyLimits, type DialysisSchedule } from '@/lib/store';
import { toast } from 'sonner';

const DAY_LABELS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

interface NutrientFieldProps {
  label: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  hint: string;
  isGoal?: boolean;
  onChange: (val: number) => void;
}

function NutrientField({ label, value, unit, icon, hint, isGoal, onChange }: NutrientFieldProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 gradient-card-highlight">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="rounded-lg bg-primary/10 p-1.5 text-primary">{icon}</span>
        <div className="flex-1">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {isGoal && (
            <span className="ml-1.5 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">doel</span>
          )}
          {!isGoal && (
            <span className="ml-1.5 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">limiet</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="h-12 rounded-xl text-lg font-bold"
        />
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">{unit}</span>
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        {hint}
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const [limits, setLimits] = useState<DailyLimits>(getLimits());
  const [schedule, setSchedule] = useState<DialysisSchedule>(getDialysisSchedule());
  const [saved, setSaved] = useState(false);

  function handleSave() {
    saveLimits(limits);
    saveDialysisSchedule(schedule);
    setSaved(true);
    toast.success('Instellingen opgeslagen!');
    setTimeout(() => setSaved(false), 2000);
  }

  function update(key: keyof DailyLimits, val: number) {
    setLimits(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  function toggleDay(day: number) {
    setSchedule(prev => ({
      ...prev,
      dialysisDays: prev.dialysisDays.includes(day)
        ? prev.dialysisDays.filter(d => d !== day)
        : [...prev.dialysisDays, day].sort(),
    }));
    setSaved(false);
  }

  function startNewPeriod() {
    const now = new Date().toISOString();
    setSchedule(prev => ({ ...prev, lastDialysisEnd: now }));
    setSaved(false);
    toast.info('Nieuwe dialyseperiode gestart. Vergeet niet op te slaan.');
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader
          title="Instellingen"
          mascotMessage="Pas hier uw limieten en doelen aan."
        />

        <div className="mb-4 rounded-xl border border-accent/20 bg-accent/8 p-4">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Tip:</span> Bespreek uw limieten met uw nefroloog of diëtist. 
            Pas ze aan als u klachten ervaart voordat het maximum bereikt wordt.
          </p>
        </div>

        {/* Dialysis schedule */}
        <div className="mb-6">
          <h2 className="mb-3 font-display text-base font-semibold text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Dialyseschema
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Stel in op welke dagen u dialyseert en hoe laat uw sessie eindigt.
          </p>

          <div className="space-y-4">
            {/* Dialysis days */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Dialysedagen</p>
              <div className="flex gap-2">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold transition-colors ${
                      schedule.dialysisDays.includes(i)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Usual end time */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> Gebruikelijke eindtijd
              </p>
              <Input
                type="time"
                value={schedule.usualEndTime}
                onChange={e => {
                  setSchedule(prev => ({ ...prev, usualEndTime: e.target.value }));
                  setSaved(false);
                }}
                className="h-12 rounded-xl text-base"
              />
            </div>

            {/* Last dialysis datetime */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 text-sm font-semibold text-foreground">Laatste dialyse eindtijd</p>
              <p className="mb-2 text-xs text-muted-foreground">
                Pas dit aan als de automatische berekening niet klopt.
              </p>
              <Input
                type="datetime-local"
                value={schedule.lastDialysisEnd ? schedule.lastDialysisEnd.slice(0, 16) : ''}
                onChange={e => {
                  const val = e.target.value;
                  setSchedule(prev => ({
                    ...prev,
                    lastDialysisEnd: val ? new Date(val).toISOString() : null,
                  }));
                  setSaved(false);
                }}
                className="h-12 rounded-xl text-base"
              />
            </div>

            {/* Start new period */}
            <Button
              onClick={startNewPeriod}
              variant="outline"
              className="h-12 w-full gap-2 rounded-xl text-base font-semibold"
            >
              <RotateCcw className="h-4 w-4" />
              Nieuwe dialyseperiode starten
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="mb-3 font-display text-base font-semibold text-foreground">
            Dagelijkse limieten
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Deze stoffen moeten onder het maximum blijven.
          </p>
          <div className="space-y-3">
            <NutrientField
              label="Kalium"
              value={limits.potassium}
              unit="mg"
              icon={<Beaker className="h-4 w-4" />}
              hint="Meestal 2000–3000 mg. Verhoogd kalium kan hartproblemen veroorzaken."
              onChange={val => update('potassium', val)}
            />
            <NutrientField
              label="Fosfaat"
              value={limits.phosphate}
              unit="mg"
              icon={<Flame className="h-4 w-4" />}
              hint="Meestal 800–1200 mg. Te veel fosfaat kan botproblemen veroorzaken."
              onChange={val => update('phosphate', val)}
            />
            <NutrientField
              label="Natrium"
              value={limits.sodium}
              unit="mg"
              icon={<Waves className="h-4 w-4" />}
              hint="Meestal 1500–2300 mg. Minder zout helpt bij vochtbalans."
              onChange={val => update('sodium', val)}
            />
            <NutrientField
              label="Vocht"
              value={limits.fluid}
              unit="ml"
              icon={<Droplets className="h-4 w-4" />}
              hint="Meestal 500–1500 ml. Afhankelijk van uw restfunctie en dialyse."
              onChange={val => update('fluid', val)}
            />
          </div>
        </div>

        <div className="mb-6">
          <h2 className="mb-3 font-display text-base font-semibold text-foreground">
            Dagelijks doel
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Eiwit is belangrijk bij dialyse — probeer dit doel te behalen.
          </p>
          <NutrientField
            label="Eiwit"
            value={limits.protein}
            unit="g"
            icon={<Egg className="h-4 w-4" />}
            hint="Meestal 60–80 g. Voldoende eiwit is essentieel om spiermassa te behouden."
            isGoal
            onChange={val => update('protein', val)}
          />
        </div>

        <Button
          onClick={handleSave}
          size="lg"
          className="h-14 w-full gap-2 rounded-xl text-base font-semibold"
        >
          <Save className="h-5 w-5" />
          {saved ? 'Opgeslagen ✓' : 'Opslaan'}
        </Button>

        <AdBanner className="mt-6" />

      </div>
    </div>
  );
}
