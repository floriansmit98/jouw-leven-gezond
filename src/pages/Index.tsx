import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beaker, Droplets, Flame, Waves, Plus, Egg } from 'lucide-react';
import NutrientCard from '@/components/NutrientCard';
import GoalCard from '@/components/GoalCard';
import RiskAlerts from '@/components/RiskAlerts';
import PageHeader from '@/components/PageHeader';
import { getTodayTotals, getLimits } from '@/lib/store';
import { Button } from '@/components/ui/button';

export default function Index() {
  const navigate = useNavigate();
  const [totals, setTotals] = useState(getTodayTotals());
  const limits = getLimits();

  useEffect(() => {
    const interval = setInterval(() => setTotals(getTodayTotals()), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader
          title="Goedendag 👋"
          subtitle="Uw dagelijkse gezondheidsoverzicht"
        />

        {/* Quick Actions */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Button
            onClick={() => navigate('/voeding')}
            className="h-14 gap-2 rounded-xl bg-primary text-primary-foreground text-base font-semibold shadow-md"
          >
            <Plus className="h-5 w-5" />
            Voeding loggen
          </Button>
          <Button
            onClick={() => navigate('/dialyse')}
            variant="outline"
            className="h-14 gap-2 rounded-xl text-base font-semibold"
          >
            <Droplets className="h-5 w-5" />
            Dialyse loggen
          </Button>
        </div>

        {/* Risk Alerts */}
        <div className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
            Risicoanalyse
          </h2>
          <RiskAlerts />
        </div>

        {/* Nutrient Cards */}
        <div className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
            Dagelijks overzicht
          </h2>
          <div className="grid gap-3">
            <NutrientCard
              label="Kalium"
              current={totals.potassium}
              limit={limits.potassium}
              unit="mg"
              icon={<Beaker className="h-5 w-5" />}
            />
            <NutrientCard
              label="Fosfaat"
              current={totals.phosphate}
              limit={limits.phosphate}
              unit="mg"
              icon={<Flame className="h-5 w-5" />}
            />
            <NutrientCard
              label="Natrium"
              current={totals.sodium}
              limit={limits.sodium}
              unit="mg"
              icon={<Waves className="h-5 w-5" />}
            />
            <GoalCard
              label="Eiwit"
              current={totals.protein}
              goal={limits.protein}
              unit="g"
              icon={<Egg className="h-5 w-5" />}
            />
            <NutrientCard
              label="Vocht"
              current={totals.fluid}
              limit={limits.fluid}
              unit="ml"
              icon={<Droplets className="h-5 w-5" />}
            />
          </div>
        </div>

        {/* Fluid Schedule */}
        <div className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
            Vochtschema vandaag
          </h2>
          <FluidSchedule totalLimit={limits.fluid} consumed={totals.fluid} />
        </div>
      </div>
    </div>
  );
}

function FluidSchedule({ totalLimit, consumed }: { totalLimit: number; consumed: number }) {
  const schedule = [
    { time: '08:00', amount: Math.round(totalLimit * 0.15) },
    { time: '10:00', amount: Math.round(totalLimit * 0.10) },
    { time: '12:00', amount: Math.round(totalLimit * 0.15) },
    { time: '15:00', amount: Math.round(totalLimit * 0.10) },
    { time: '18:00', amount: Math.round(totalLimit * 0.20) },
    { time: '20:00', amount: Math.round(totalLimit * 0.15) },
    { time: '22:00', amount: Math.round(totalLimit * 0.15) },
  ];

  const remaining = Math.max(0, totalLimit - consumed);
  const currentHour = new Date().getHours();

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 text-sm text-muted-foreground">
        Nog <span className="font-bold text-foreground">{remaining} ml</span> beschikbaar vandaag
      </div>
      <div className="space-y-2">
        {schedule.map((slot, i) => {
          const hour = parseInt(slot.time.split(':')[0]);
          const isPast = hour < currentHour;
          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                isPast ? 'bg-muted/50 text-muted-foreground' : 'bg-secondary/50'
              }`}
            >
              <span className="font-medium">{slot.time}</span>
              <span>{slot.amount} ml</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
