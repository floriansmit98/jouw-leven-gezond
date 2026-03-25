import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePremium } from '@/contexts/PremiumContext';
import { useAdBanner } from '@/contexts/AdBannerContext';
import { Beaker, Droplets, Flame, Waves, Egg, Settings, LogOut, Clock, Sparkles, Search, Crown } from 'lucide-react';
import AdBanner from '@/components/AdBanner';
import PageShell from '@/components/PageShell';
import NutrientCard from '@/components/NutrientCard';
import GoalCard from '@/components/GoalCard';
import RiskAlerts from '@/components/RiskAlerts';
import DailyRiskScore from '@/components/DailyRiskScore';
import DialysisPeriodView from '@/components/DialysisPeriodView';
import PageHeader from '@/components/PageHeader';
import { getLimits, getStatusColor, getGoalStatus } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTodayEntries } from '@/hooks/useFoods';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import FluidScheduleSection from '@/components/FluidScheduleSection';

export default function Index() {
  const { isPremium } = usePremium();
  const { contentBottomPadding } = useAdBanner();
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

  const nutrientCards = useMemo(() => {
    const items = [
      { type: 'limit' as const, key: 'potassium', label: 'Kalium', current: totals.potassium, limit: limits.potassium, unit: 'mg', icon: <Beaker className="h-5 w-5" /> },
      { type: 'limit' as const, key: 'phosphate', label: 'Fosfaat', current: totals.phosphate, limit: limits.phosphate, unit: 'mg', icon: <Flame className="h-5 w-5" /> },
      { type: 'limit' as const, key: 'sodium', label: 'Natrium', current: totals.sodium, limit: limits.sodium, unit: 'mg', icon: <Waves className="h-5 w-5" /> },
      { type: 'goal' as const, key: 'protein', label: 'Eiwit', current: totals.protein, limit: limits.protein, unit: 'g', icon: <Egg className="h-5 w-5" /> },
      { type: 'limit' as const, key: 'fluid', label: 'Vocht', current: totals.fluid, limit: limits.fluid, unit: 'ml', icon: <Droplets className="h-5 w-5" /> },
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
  }, [totals, limits]);

  return (
    <div className="min-h-screen" style={{ paddingBottom: contentBottomPadding }}>
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

        {/* Dashboard tabs */}
        <Tabs defaultValue="today" className="mb-5">
          <TabsList className="mb-4 w-full rounded-xl">
            <TabsTrigger value="today" className="flex-1 rounded-lg text-sm font-semibold">
              Vandaag
            </TabsTrigger>
            <TabsTrigger
              value="period"
              className="flex-1 rounded-lg text-sm font-semibold gap-1"
              onClick={(e) => {
                if (!isPremium) {
                  e.preventDefault();
                  navigate('/premium');
                }
              }}
            >
              Sinds laatste dialyse
              {!isPremium && <Crown className="h-3.5 w-3.5 text-warning" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            {/* Daily risk score */}
            <div className="mb-5">
              <DailyRiskScore />
            </div>

            {/* Warnings */}
            <div className="mb-5">
              <RiskAlerts />
            </div>

            {/* Daily overview */}
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

            {/* Ad banner */}
            <AdBanner className="mb-5" />

            {/* Fluid schedule */}
            <div className="mb-6">
              <FluidScheduleSection totalLimit={limits.fluid} consumed={totals.fluid} />
            </div>
          </TabsContent>

          <TabsContent value="period">
            <DialysisPeriodView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
