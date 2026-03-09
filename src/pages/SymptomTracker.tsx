import { useState, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { SYMPTOM_LABELS, EXTENDED_SYMPTOMS, type SymptomType } from '@/lib/store';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { ChevronDown, ArrowLeft, Search, X } from 'lucide-react';
import { usePremium } from '@/contexts/PremiumContext';
import PremiumBanner from '@/components/PremiumBanner';
import AdBanner from '@/components/AdBanner';

const QUICK_SYMPTOM_ICONS: Record<SymptomType, string> = {
  vermoeidheid: '😴',
  misselijkheid: '🤢',
  jeuk: '🤚',
  zwelling: '💧',
  duizeligheid: '😵',
  krampen: '⚡',
};

// Build a combined lookup for labels and emojis (quick + extended)
const ALL_SYMPTOM_LABELS: Record<string, string> = {
  ...SYMPTOM_LABELS,
  ...Object.fromEntries(EXTENDED_SYMPTOMS.map(s => [s.key, s.label])),
};

const ALL_SYMPTOM_EMOJIS: Record<string, string> = {
  ...QUICK_SYMPTOM_ICONS,
  ...Object.fromEntries(EXTENDED_SYMPTOMS.map(s => [s.key, s.emoji])),
};

const CHART_COLORS_LIST = [
  'hsl(205, 75%, 48%)', 'hsl(145, 60%, 40%)', 'hsl(35, 90%, 55%)',
  'hsl(250, 60%, 55%)', 'hsl(0, 70%, 55%)', 'hsl(50, 80%, 50%)',
  'hsl(180, 60%, 40%)', 'hsl(300, 50%, 50%)', 'hsl(90, 60%, 40%)',
];

interface SymptomRecord {
  id: string;
  user_id: string;
  symptom_name: string;
  severity_score: number;
  notes: string | null;
  logged_at: string;
}

type Period = '1' | '7' | '14' | '30';

const PERIOD_LABELS: Record<Period, string> = {
  '1': 'Vandaag',
  '7': 'Week',
  '14': '2 weken',
  '30': 'Maand',
};

function getPeriodStart(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

export default function SymptomTracker() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isPremium } = usePremium();
  const [selected, setSelected] = useState<string | null>(null);
  const [severity, setSeverity] = useState(3);
  const [notes, setNotes] = useState('');
  const [chartFilter, setChartFilter] = useState<string>('all');
  const [period, setPeriod] = useState<Period>('7');
  const [showMore, setShowMore] = useState(false);
  const [moreSearch, setMoreSearch] = useState('');

  const days = parseInt(period, 10);

  const { data: entries = [] } = useQuery({
    queryKey: ['symptom_entries', user?.id, days],
    queryFn: async () => {
      if (!user) return [];
      const cutoff = getPeriodStart(days).toISOString();
      const { data, error } = await supabase
        .from('symptom_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', cutoff)
        .order('logged_at', { ascending: false });
      if (error) throw error;
      return data as SymptomRecord[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (entry: { symptom_name: string; severity_score: number; notes?: string }) => {
      if (!user) throw new Error('Niet ingelogd');
      const { error } = await supabase.from('symptom_entries').insert({
        user_id: user.id,
        symptom_name: entry.symptom_name,
        severity_score: entry.severity_score,
        notes: entry.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symptom_entries'] });
      toast.success('Symptoom geregistreerd!');
      setSelected(null);
      setSeverity(3);
      setNotes('');
    },
    onError: () => toast.error('Kon symptoom niet opslaan.'),
  });

  function handleSubmit() {
    if (!selected) return;
    addMutation.mutate({
      symptom_name: selected,
      severity_score: severity,
      notes: notes || undefined,
    });
  }

  function handleSelectSymptom(key: string) {
    setSelected(key);
    setShowMore(false);
    setMoreSearch('');
  }

  // Filter extended symptoms by search
  const filteredExtended = useMemo(() => {
    if (!moreSearch.trim()) return EXTENDED_SYMPTOMS;
    const q = moreSearch.toLowerCase();
    return EXTENDED_SYMPTOMS.filter(s =>
      s.label.toLowerCase().includes(q) || s.key.toLowerCase().includes(q)
    );
  }, [moreSearch]);

  const chartData = useMemo(() => {
    const filtered = chartFilter === 'all'
      ? entries
      : entries.filter(e => e.symptom_name === chartFilter);

    const byDate = new Map<string, Map<string, number>>();
    filtered.forEach(e => {
      const dateKey = format(new Date(e.logged_at), 'yyyy-MM-dd');
      if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
      const dayMap = byDate.get(dateKey)!;
      const current = dayMap.get(e.symptom_name) || 0;
      if (e.severity_score > current) dayMap.set(e.symptom_name, e.severity_score);
    });

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, symptoms]) => {
        const point: Record<string, string | number> = {
          date: format(new Date(date), 'd MMM', { locale: nl }),
        };
        symptoms.forEach((score, name) => {
          point[name] = score;
        });
        return point;
      });
  }, [entries, chartFilter]);

  const activeSymptoms = useMemo(() => {
    if (chartFilter === 'all') {
      return Array.from(new Set(entries.map(e => e.symptom_name)));
    }
    return [chartFilter];
  }, [entries, chartFilter]);

  // All unique symptom names from entries for chart filter
  const loggedSymptomNames = useMemo(() => {
    return Array.from(new Set(entries.map(e => e.symptom_name)));
  }, [entries]);

  function getChartColor(symptom: string, index: number) {
    return CHART_COLORS_LIST[index % CHART_COLORS_LIST.length];
  }

  // "Meer symptomen" full-screen overlay
  if (showMore) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="mx-auto max-w-lg px-4 pt-6">
          {/* Header */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => { setShowMore(false); setMoreSearch(''); }}
              className="rounded-xl p-2 text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-display text-xl font-bold text-foreground">Meer symptomen</h1>
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={moreSearch}
              onChange={e => setMoreSearch(e.target.value)}
              placeholder="Zoek symptoom"
              className="h-12 rounded-xl pl-10 text-base"
              autoFocus
            />
            {moreSearch && (
              <button
                onClick={() => setMoreSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Symptom list */}
          <div className="space-y-2">
            {filteredExtended.map(s => (
              <button
                key={s.key}
                onClick={() => handleSelectSymptom(s.key)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-accent/50"
              >
                <span className="text-xl">{s.emoji}</span>
                <span className="text-sm font-semibold text-foreground">{s.label}</span>
              </button>
            ))}
            {filteredExtended.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Geen symptomen gevonden.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader
          title="Symptomen"
          mascotMessage="Houd hier uw klachten bij."
        />

        {/* Quick-access symptom buttons */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          {(Object.keys(SYMPTOM_LABELS) as SymptomType[]).map(type => (
            <button
              key={type}
              onClick={() => setSelected(type)}
              className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                selected === type
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <span className="text-2xl">{QUICK_SYMPTOM_ICONS[type]}</span>
              <span className="text-sm font-semibold text-foreground">{SYMPTOM_LABELS[type]}</span>
            </button>
          ))}
        </div>

        {/* More symptoms button */}
        <button
          onClick={() => setShowMore(true)}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" />
          Meer symptomen
        </button>

        {/* Severity + submit form */}
        {selected && (
          <div className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{ALL_SYMPTOM_EMOJIS[selected] || '❓'}</span>
              <span className="text-sm font-semibold text-foreground">
                {ALL_SYMPTOM_LABELS[selected] || selected}
              </span>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Hoe erg? ({severity}/5)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setSeverity(n)}
                    className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold transition-all ${
                      severity >= n
                        ? n <= 2 ? 'bg-safe text-safe-foreground' : n <= 3 ? 'bg-warning text-warning-foreground' : 'bg-danger text-danger-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              placeholder="Eventuele opmerkingen..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="rounded-xl"
            />
            <Button
              onClick={handleSubmit}
              disabled={addMutation.isPending}
              className="h-12 w-full rounded-xl text-base font-semibold"
            >
              {addMutation.isPending ? 'Opslaan...' : 'Registreren'}
            </Button>
          </div>
        )}

        {/* Period selector */}
        <div className="mb-4">
          <div className="grid grid-cols-4 gap-2">
            {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([key, label]) => {
              const locked = !isPremium && key !== '1';
              return (
                <Button
                  key={key}
                  variant={period === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => locked ? undefined : setPeriod(key)}
                  className={`text-sm ${locked ? 'opacity-50' : ''}`}
                  disabled={locked}
                >
                  {label} {locked ? '🔒' : ''}
                </Button>
              );
            })}
          </div>
          {!isPremium && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Meerdaagse trends zijn beschikbaar met <button onClick={() => window.location.href = '/premium'} className="font-semibold text-primary underline">Premium</button>.
            </p>
          )}
        </div>

        {/* Chart section */}
        {entries.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
              Verloop ({PERIOD_LABELS[period].toLowerCase()})
            </h2>

            {/* Symptom filter buttons */}
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                onClick={() => setChartFilter('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  chartFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Alles
              </button>
              {loggedSymptomNames.map(name => (
                <button
                  key={name}
                  onClick={() => setChartFilter(name)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    chartFilter === name
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {ALL_SYMPTOM_EMOJIS[name] || '❓'} {ALL_SYMPTOM_LABELS[name] || name}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value: number, name: string) => [
                        `${value}/5`,
                        ALL_SYMPTOM_LABELS[name] || name,
                      ]}
                    />
                    {activeSymptoms.map((symptom, idx) => (
                      <Line
                        key={symptom}
                        type="monotone"
                        dataKey={symptom}
                        stroke={getChartColor(symptom, idx)}
                        strokeWidth={2}
                        dot={{ r: 4, fill: getChartColor(symptom, idx) }}
                        connectNulls={false}
                        name={symptom}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Geen data in deze periode.
                </p>
              )}

              {chartFilter === 'all' && activeSymptoms.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {activeSymptoms.map((s, idx) => (
                    <div key={s} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: getChartColor(s, idx) }} />
                      <span className="text-xs text-muted-foreground">{ALL_SYMPTOM_LABELS[s] || s}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent history */}
        {entries.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
              Geschiedenis ({PERIOD_LABELS[period].toLowerCase()})
            </h2>
            <div className="space-y-2">
              {entries.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <span className="text-xl">
                    {ALL_SYMPTOM_EMOJIS[entry.symptom_name] || '❓'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {ALL_SYMPTOM_LABELS[entry.symptom_name] || entry.symptom_name}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${
                          entry.severity_score <= 2
                            ? 'bg-safe/20 text-safe'
                            : entry.severity_score <= 3
                            ? 'bg-warning/20 text-warning'
                            : 'bg-danger/20 text-danger'
                        }`}
                      >
                        {entry.severity_score}/5
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.logged_at), "EEEE d MMM 'om' HH:mm", { locale: nl })}
                    </p>
                    {entry.notes && (
                      <p className="mt-1 text-xs text-muted-foreground italic truncate">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
