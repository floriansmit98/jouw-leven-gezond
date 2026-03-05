import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SYMPTOM_LABELS, addSymptomEntry, getSymptomEntries, type SymptomType } from '@/lib/store';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const SYMPTOM_ICONS: Record<SymptomType, string> = {
  vermoeidheid: '😴',
  misselijkheid: '🤢',
  jeuk: '🤚',
  zwelling: '💧',
  duizeligheid: '😵',
  krampen: '⚡',
};

export default function SymptomTracker() {
  const [selected, setSelected] = useState<SymptomType | null>(null);
  const [severity, setSeverity] = useState(3);
  const [notes, setNotes] = useState('');

  const entries = getSymptomEntries();
  const last7Days = getLast7DaysData(entries);

  function handleSubmit() {
    if (!selected) return;
    addSymptomEntry({
      type: selected,
      severity: severity as 1 | 2 | 3 | 4 | 5,
      notes: notes || undefined,
    });
    toast.success('Symptoom geregistreerd!');
    setSelected(null);
    setSeverity(3);
    setNotes('');
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader
          title="Symptomen"
          subtitle="Houd uw klachten bij"
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
            <Button onClick={handleSubmit} className="h-12 w-full rounded-xl text-base font-semibold">
              Registreren
            </Button>
          </div>
        )}

        {/* Chart */}
        {last7Days.length > 0 && (
          <div>
            <h2 className="mb-3 font-display text-lg font-semibold">Afgelopen 7 dagen</h2>
            <div className="rounded-xl border border-border bg-card p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={last7Days}>
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(205, 75%, 48%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getLast7DaysData(entries: ReturnType<typeof getSymptomEntries>) {
  const days: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('nl-NL', { weekday: 'short' });
    days[key] = 0;
  }
  entries.forEach(e => {
    const key = e.timestamp.split('T')[0];
    if (key in days) days[key]++;
  });

  return Object.entries(days).map(([date, count]) => ({
    day: new Date(date).toLocaleDateString('nl-NL', { weekday: 'short' }),
    count,
  }));
}
