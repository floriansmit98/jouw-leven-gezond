import { useState, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SYMPTOM_LABELS, type SymptomType } from '@/lib/store';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const SYMPTOM_ICONS: Record<SymptomType, string> = {
  vermoeidheid: '😴',
  misselijkheid: '🤢',
  jeuk: '🤚',
  zwelling: '💧',
  duizeligheid: '😵',
  krampen: '⚡',
};

const SEVERITY_COLORS: Record<number, string> = {
  1: 'hsl(var(--safe))',
  2: 'hsl(var(--safe))',
  3: 'hsl(var(--warning))',
  4: 'hsl(var(--danger))',
  5: 'hsl(var(--danger))',
};

interface SymptomRecord {
  id: string;
  user_id: string;
  symptom_name: string;
  severity_score: number;
  notes: string | null;
  logged_at: string;
}

export default function SymptomTracker() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SymptomType | null>(null);
  const [severity, setSeverity] = useState(3);
  const [notes, setNotes] = useState('');
  const [chartFilter, setChartFilter] = useState<SymptomType | 'all'>('all');

  const { data: entries = [] } = useQuery({
    queryKey: ['symptom_entries', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('symptom_entries')
        .select('*')
        .eq('user_id', user.id)
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

  // Chart data: filter by selected symptom
  const chartData = useMemo(() => {
    const filtered = chartFilter === 'all'
      ? entries
      : entries.filter(e => e.symptom_name === chartFilter);

    // Group by date, take max severity per symptom per day
    const byDate = new Map<string, Map<string, number>>();
    filtered.forEach(e => {
      const dateKey = e.logged_at.split('T')[0];
      if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
      const dayMap = byDate.get(dateKey)!;
      const current = dayMap.get(e.symptom_name) || 0;
      if (e.severity_score > current) dayMap.set(e.symptom_name, e.severity_score);
    });

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14) // last 14 days
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
      const names = new Set(entries.map(e => e.symptom_name));
      return Array.from(names) as SymptomType[];
    }
    return [chartFilter] as SymptomType[];
  }, [entries, chartFilter]);

  const CHART_COLORS: Record<SymptomType, string> = {
    vermoeidheid: 'hsl(205, 75%, 48%)',
    misselijkheid: 'hsl(145, 60%, 40%)',
    jeuk: 'hsl(35, 90%, 55%)',
    zwelling: 'hsl(250, 60%, 55%)',
    duizeligheid: 'hsl(0, 70%, 55%)',
    krampen: 'hsl(50, 80%, 50%)',
  };

  // Recent history (last 20)
  const recentEntries = entries.slice(0, 20);

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader
          title="Symptomen"
          mascotMood="neutral"
          mascotMessage="Houd hier uw klachten bij."
        />

        {/* Symptom buttons */}
        <div className="mb-6 grid grid-cols-2 gap-3">
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
              <span className="text-2xl">{SYMPTOM_ICONS[type]}</span>
              <span className="text-sm font-semibold text-foreground">{SYMPTOM_LABELS[type]}</span>
            </button>
          ))}
        </div>

        {selected && (
          <div className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4">
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

        {/* Chart section */}
        {entries.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Verloop</h2>

            {/* Filter buttons */}
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
              {(Object.keys(SYMPTOM_LABELS) as SymptomType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setChartFilter(type)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    chartFilter === type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {SYMPTOM_ICONS[type]} {SYMPTOM_LABELS[type]}
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
                        SYMPTOM_LABELS[name as SymptomType] || name,
                      ]}
                    />
                    {activeSymptoms.map(symptom => (
                      <Line
                        key={symptom}
                        type="monotone"
                        dataKey={symptom}
                        stroke={CHART_COLORS[symptom]}
                        strokeWidth={2}
                        dot={{ r: 4, fill: CHART_COLORS[symptom] }}
                        connectNulls={false}
                        name={symptom}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Geen data voor dit symptoom.
                </p>
              )}

              {/* Legend */}
              {chartFilter === 'all' && activeSymptoms.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {activeSymptoms.map(s => (
                    <div key={s} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[s] }} />
                      <span className="text-xs text-muted-foreground">{SYMPTOM_LABELS[s]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent history */}
        {recentEntries.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Geschiedenis</h2>
            <div className="space-y-2">
              {recentEntries.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <span className="text-xl">
                    {SYMPTOM_ICONS[entry.symptom_name as SymptomType] || '❓'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {SYMPTOM_LABELS[entry.symptom_name as SymptomType] || entry.symptom_name}
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
