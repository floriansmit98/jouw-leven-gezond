import { useState } from 'react';
import { Search, Plus, ChevronRight, Loader2, ShoppingCart } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useFoodSearch, useTodayEntries, addFoodEntryDB, type FoodRow } from '@/hooks/useFoods';
import { useOFFSearch } from '@/hooks/useOpenFoodFacts';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function FoodTracker() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodRow | null>(null);
  const [isOFF, setIsOFF] = useState(false);
  const [amount, setAmount] = useState('100');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const { foods, loading: nevoLoading, hasMore, loadMore } = useFoodSearch(search, false);
  const { products: offFoods, loading: offLoading, hasMore: offHasMore, loadMore: offLoadMore } = useOFFSearch(search, false);
  const { entries, refetch } = useTodayEntries();

  const amountNum = parseFloat(amount) || 0;
  const factor = amountNum / 100;

  function selectFood(food: FoodRow, fromOFF: boolean) {
    setSelectedFood(food);
    setIsOFF(fromOFF);
    setDialogOpen(true);
    setAmount('100');
  }

  async function handleAddFood() {
    if (!selectedFood || !user || amountNum <= 0) return;
    setAdding(true);
    try {
      if (isOFF) {
        // For OFF products, insert directly into food_entries (no food_id)
        const { error } = await supabase.from('food_entries').insert({
          user_id: user.id,
          food_id: null,
          name: selectedFood.name,
          potassium_mg: Math.round(selectedFood.potassium_mg * factor),
          phosphate_mg: Math.round(selectedFood.phosphate_mg * factor),
          sodium_mg: Math.round(selectedFood.sodium_mg * factor),
          protein_g: Math.round(selectedFood.protein_g * factor * 10) / 10,
          fluid_ml: Math.round(selectedFood.fluid_ml * factor),
          portions: factor,
        });
        if (error) throw error;
      } else {
        await addFoodEntryDB(user.id, selectedFood, factor);
      }
      toast.success(`${selectedFood.name} toegevoegd!`);
      setSelectedFood(null);
      setAmount('100');
      setDialogOpen(false);
      refetch();
    } catch {
      toast.error('Kon voeding niet toevoegen.');
    }
    setAdding(false);
  }

  const unitLabel = 'g';

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader title="Voeding" mascotMood="happy" mascotMessage="Zoek en log wat u vandaag heeft gegeten!" />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek voedingsmiddel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-12 rounded-xl pl-10 text-base"
          />
        </div>

        {search.trim() !== '' && (
          <div className="mb-6 space-y-2">
            {/* NEVO results */}
            {foods.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">NEVO-database</p>
                {foods.map(food => (
                  <FoodListItem key={food.id} food={food} onClick={() => selectFood(food, false)} />
                ))}
                {hasMore && !nevoLoading && (
                  <Button variant="outline" onClick={loadMore} className="w-full rounded-xl text-sm">
                    Meer NEVO-resultaten...
                  </Button>
                )}
              </>
            )}

            {/* OFF results */}
            {offFoods.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Supermarktproducten
                </p>
                {offFoods.map(food => (
                  <FoodListItem key={food.id} food={food} onClick={() => selectFood(food, true)} isSupermarket />
                ))}
                {offHasMore && !offLoading && (
                  <Button variant="outline" onClick={offLoadMore} className="w-full rounded-xl text-sm">
                    Meer supermarktproducten...
                  </Button>
                )}
              </>
            )}

            {(nevoLoading || offLoading) && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {!nevoLoading && !offLoading && foods.length === 0 && offFoods.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-foreground">
                  Geen producten gevonden voor "{search.trim()}".
                </p>
              </div>
            )}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="rounded-2xl">
            {selectedFood && (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display">{selectedFood.name}</DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {isOFF ? 'Open Food Facts' : selectedFood.category} · voedingswaarden per 100{unitLabel}
                  </p>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Hoeveelheid ({unitLabel})
                    </label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder={`bijv. 150 ${unitLabel}`}
                      className="h-12 rounded-xl text-base"
                    />
                    {amountNum > 0 && amountNum !== 100 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Berekend voor {amountNum}{unitLabel} (i.p.v. 100{unitLabel})
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <NutrientBox label="Kalium" value={Math.round(selectedFood.potassium_mg * factor)} unit="mg" />
                    <NutrientBox label="Fosfaat" value={Math.round(selectedFood.phosphate_mg * factor)} unit="mg" />
                    <NutrientBox label="Natrium" value={Math.round(selectedFood.sodium_mg * factor)} unit="mg" />
                    <NutrientBox label="Eiwit" value={Math.round(selectedFood.protein_g * factor * 10) / 10} unit="g" />
                    <div className="col-span-2">
                      <NutrientBox label="Vocht" value={Math.round(selectedFood.fluid_ml * factor)} unit="ml" />
                    </div>
                  </div>
                  <Button onClick={handleAddFood} disabled={adding || amountNum <= 0} className="h-12 w-full rounded-xl text-base font-semibold">
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
                    {Math.round(entry.portions * 100)}g · K: {entry.potassium_mg}mg · F: {entry.phosphate_mg}mg · Na: {entry.sodium_mg}mg · E: {entry.protein_g}g · Vocht: {entry.fluid_ml}ml
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

function FoodListItem({ food, onClick, isSupermarket }: { food: FoodRow; onClick: () => void; isSupermarket?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-secondary/50"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">{food.name}</p>
          {isSupermarket && (
            <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/20">OFF</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">per 100g</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
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
