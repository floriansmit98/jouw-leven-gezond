import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDialysisSession, getDialysisSessions } from '@/lib/store';
import { toast } from 'sonner';
import { Plus, Calendar } from 'lucide-react';

export default function DialysisLog() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'hemodialyse',
    weightBefore: '',
    weightAfter: '',
    fluidRemoved: '',
    notes: '',
  });

  const sessions = getDialysisSessions().sort((a, b) => b.date.localeCompare(a.date));

  function handleSubmit() {
    if (!form.weightBefore || !form.weightAfter) {
      toast.error('Vul alle verplichte velden in.');
      return;
    }
    addDialysisSession({
      date: form.date,
      type: form.type,
      weightBefore: parseFloat(form.weightBefore),
      weightAfter: parseFloat(form.weightAfter),
      fluidRemoved: parseFloat(form.fluidRemoved) || 0,
      notes: form.notes || undefined,
    });
    toast.success('Dialyse sessie opgeslagen!');
    setShowForm(false);
    setForm({
      date: new Date().toISOString().split('T')[0],
      type: 'hemodialyse',
      weightBefore: '',
      weightAfter: '',
      fluidRemoved: '',
      notes: '',
    });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader
          title="Dialyse"
          mascotMessage="Log hier uw dialyse sessies."
          action={
            <Button
              onClick={() => setShowForm(!showForm)}
              className="h-11 gap-2 rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Nieuw
            </Button>
          }
        />

        {showForm && (
          <div className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Datum</label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="h-12 rounded-xl"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Type dialyse</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hemodialyse">Hemodialyse</SelectItem>
                  <SelectItem value="peritoneaaldialyse">Peritoneaaldialyse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Gewicht voor (kg)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="bijv. 75.5"
                  value={form.weightBefore}
                  onChange={e => setForm(f => ({ ...f, weightBefore: e.target.value }))}
                  className="h-12 rounded-xl"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Gewicht na (kg)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="bijv. 73.0"
                  value={form.weightAfter}
                  onChange={e => setForm(f => ({ ...f, weightAfter: e.target.value }))}
                  className="h-12 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Vocht verwijderd (ml)</label>
              <Input
                type="number"
                placeholder="bijv. 2500"
                value={form.fluidRemoved}
                onChange={e => setForm(f => ({ ...f, fluidRemoved: e.target.value }))}
                className="h-12 rounded-xl"
              />
            </div>
            <Textarea
              placeholder="Notities..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="rounded-xl"
            />
            <Button onClick={handleSubmit} className="h-12 w-full rounded-xl text-base font-semibold">
              Opslaan
            </Button>
          </div>
        )}

        {/* Sessions list */}
        <div className="space-y-3">
          {sessions.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              Nog geen sessies geregistreerd.
            </p>
          )}
          {sessions.map(session => (
            <div key={session.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  {new Date(session.date).toLocaleDateString('nl-NL', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </span>
              </div>
              <div className="mb-1 text-sm font-semibold capitalize text-foreground">
                {session.type}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Voor</p>
                  <p className="font-bold">{session.weightBefore} kg</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Na</p>
                  <p className="font-bold">{session.weightAfter} kg</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Verwijderd</p>
                  <p className="font-bold">{session.fluidRemoved} ml</p>
                </div>
              </div>
              {session.notes && (
                <p className="mt-2 text-sm text-muted-foreground">{session.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
