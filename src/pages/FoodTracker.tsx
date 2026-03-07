import { useState } from 'react';
import { Search, Plus, ChevronRight, Loader2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useFoodSearch, useTodayEntries, addFoodEntryDB, type FoodRow } from '@/hooks/useFoods';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const RISK_COLORS: Record<string, string> = {
  laag: 'bg-green-100 text-green-800',
  gemiddeld: 'bg-yellow-100 text-yellow-800',
  hoog: 'bg-red-100 text-red-800',
};

export default function FoodTracker() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodRow | null>(null);
  const [portions, setPortions] = useState('1');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const { foods, loading, hasMore, loadMore } = useFoodSearch(search);
  const { entries, refetch } = useTodayEntries();

  async function handleAddFood() {
    if (!selectedFood || !user) return;
    setAdding(true);
    try {
      const p = parseFloat(portions) || 1;
      await addFoodEntryDB(user.id, selectedFood, p);
      toast.success(`${selectedFood.name} toegevoegd!`);
      setSelectedFood(null);
      setPortions('1');
      setDialogOpen(false);
      refetch();
    } catch {
      toast.error('Kon voeding niet toevoegen.');
    }
    setAdding(false);
  }

  const p = parseFloat(portions) || 1;

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader title="Voeding" subtitle="Log wat u vandaag heeft gegeten" />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek voedingsmiddel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-12 rounded-xl pl-10 text-base"
          />
        </div>

        {/* Food List */}
        <div className="mb-6 space-y-2">
          {foods.map(food => (
            <button
              key={food.id}
              onClick={() => { setSelectedFood(food); setDialogOpen(true); setPortions('1'); }}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-secondary/50"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{food.name}</p>
                  <Badge variant="outline" className={`text-[10px] ${RISK_COLORS[food.dialysis_risk_label] || ''}`}>
                    {food.dialysis_risk_label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {food.portion_description} · K: {food.potassium_mg}mg · F: {food.phosphate_mg}mg · E: {food.protein_g}g
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          ))}

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {!loading && foods.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Geen voedingsmiddelen gevonden.
            </p>
          )}

          {hasMore && !loading && (
            <Button variant="outline" onClick={loadMore} className="w-full rounded-xl">
              Meer laden...
            </Button>
          )}
        </div>

        {/* Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="rounded-2xl">
            {selectedFood && (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display">{selectedFood.name}</DialogTitle>
                  <p className="text-xs text-muted-foreground">{selectedFood.category} · {selectedFood.portion_description}</p>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <NutrientBox label="Kalium" value={Math.round(selectedFood.potassium_mg * p)} unit="mg" />
                    <NutrientBox label="Fosfaat" value={Math.round(selectedFood.phosphate_mg * p)} unit="mg" />
                    <NutrientBox label="Natrium" value={Math.round(selectedFood.sodium_mg * p)} unit="mg" />
                    <NutrientBox label="Eiwit" value={Math.round(selectedFood.protein_g * p)} unit="g" />
                    <div className="col-span-2">
                      <NutrientBox label="Vocht" value={Math.round(selectedFood.fluid_ml * p)} unit="ml" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Aantal porties ({selectedFood.portion_description})
                    </label>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={portions}
                      onChange={e => setPortions(e.target.value)}
                      className="h-12 rounded-xl text-base"
                    />
                  </div>
                  <Button onClick={handleAddFood} disabled={adding} className="h-12 w-full rounded-xl text-base font-semibold">
                    {adding ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Plus className="mr-2 h-5 w-5" />}
                    Toevoegen
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Today's entries */}
        {entries.length > 0 && (
          <div>
            <h2 className="mb-3 font-display text-lg font-semibold">Vandaag gegeten</h2>
            <div className="space-y-2">
              {entries.map(entry => (
                <div key={entry.id} className="rounded-xl border border-border bg-card p-3">
                  <p className="font-medium text-foreground">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">
                    K: {entry.potassium_mg}mg · F: {entry.phosphate_mg}mg · Na: {entry.sodium_mg}mg · E: {entry.protein_g}g · Vocht: {entry.fluid_ml}ml
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NutrientBox({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value} {unit}</p>
    </div>
  );
}
