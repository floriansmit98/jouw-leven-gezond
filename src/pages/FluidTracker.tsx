import { useState } from 'react';
import { Search, Plus, ChevronRight, Loader2, ShoppingCart } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useFoodSearch, useTodayEntries, addFoodEntryDB, foodDisplayName, type FoodRow } from '@/hooks/useFoods';
import { useOFFSearch } from '@/hooks/useOpenFoodFacts';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function FluidTracker() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedDrink, setSelectedDrink] = useState<FoodRow | null>(null);
  const [isOFF, setIsOFF] = useState(false);
  const [amount, setAmount] = useState('100');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const { foods: drinks, loading: nevoLoading, hasMore, loadMore } = useFoodSearch(search, true);
  const { products: offDrinks, loading: offLoading, hasMore: offHasMore, loadMore: offLoadMore, noResults: offNoResults } = useOFFSearch(search, true);
  const { entries, refetch } = useTodayEntries();

  const drinkEntries = entries.filter(e => {
    const name = e.name.toLowerCase();
    return name.includes('drank') || name.includes('sap') || name.includes('melk') ||
      name.includes('koffie') || name.includes('thee') || name.includes('water') ||
      name.includes('bier') || name.includes('wijn') || name.includes('cola') ||
      name.includes('limonade') || name.includes('soep') || name.includes('juice') ||
      name.includes('yoghurt') || e.fluid_ml > 50;
  });

  const amountNum = parseFloat(amount) || 0;
  const factor = amountNum / 100;

  function selectDrink(drink: FoodRow, fromOFF: boolean) {
    setSelectedDrink(drink);
    setIsOFF(fromOFF);
    setDialogOpen(true);
    setAmount('100');
  }

  async function handleAddDrink() {
    if (!selectedDrink || !user || amountNum <= 0) return;
    setAdding(true);
    try {
      if (isOFF) {
        const { error } = await supabase.from('food_entries').insert({
          user_id: user.id,
          food_id: null,
          name: selectedDrink.name,
         potassium_mg: Math.round(selectedDrink.potassium_mg * factor),
          phosphate_mg: Math.round(selectedDrink.phosphate_mg * factor),
          sodium_mg: Math.round(selectedDrink.sodium_mg * factor),
          protein_g: Math.round(selectedDrink.protein_g * factor * 10) / 10,
          fluid_ml: Math.round(selectedDrink.fluid_ml * factor),
          portions: factor,
        });
        if (error) throw error;
      } else {
        await addFoodEntryDB(user.id, selectedDrink, factor);
      }
      toast.success(`${selectedDrink.name} toegevoegd!`);
      setSelectedDrink(null);
      setAmount('100');
      setDialogOpen(false);
      refetch();
    } catch {
      toast.error('Kon drank niet toevoegen.');
    }
    setAdding(false);
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader title="Vocht" mascotMood="neutral" mascotMessage="Houd uw vochtinname bij!" />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek drank of vocht..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-12 rounded-xl pl-10 text-base"
          />
        </div>

        {search.trim() !== '' && (
          <div className="mb-6 space-y-2">
            {/* NEVO results */}
            {drinks.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">NEVO-database</p>
                {drinks.map(drink => (
                  <DrinkListItem key={drink.id} drink={drink} onClick={() => selectDrink(drink, false)} />
                ))}
                {hasMore && !nevoLoading && (
                  <Button variant="outline" onClick={loadMore} className="w-full rounded-xl text-sm">
                    Meer NEVO-resultaten...
                  </Button>
                )}
              </>
            )}

            {/* OFF results */}
            {search.trim().length >= 2 && (
              <>
                <p className="mt-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Supermarktproducten
                </p>
                {offDrinks.length > 0 && offDrinks.map(drink => (
                  <DrinkListItem key={drink.id} drink={drink} onClick={() => selectDrink(drink, true)} isSupermarket />
                ))}
                {offHasMore && !offLoading && (
                  <Button variant="outline" onClick={offLoadMore} className="w-full rounded-xl text-sm">
                    Meer supermarktproducten...
                  </Button>
                )}
                {!offLoading && offNoResults && (
                  <p className="text-xs text-muted-foreground px-1 py-2">Geen supermarktdranken met volledige voedingswaarden gevonden.</p>
                )}
              </>
            )}

            {(nevoLoading || offLoading) && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {!nevoLoading && !offLoading && drinks.length === 0 && offDrinks.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-foreground">
                  Geen dranken gevonden voor "{search.trim()}".
                </p>
              </div>
            )}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="rounded-2xl">
            {selectedDrink && (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display">{selectedDrink.name}</DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {isOFF ? 'Open Food Facts' : selectedDrink.category} · voedingswaarden per 100ml
                  </p>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Hoeveelheid (ml)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="bijv. 250 ml"
                      className="h-12 rounded-xl text-base"
                    />
                    {amountNum > 0 && amountNum !== 100 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Berekend voor {amountNum}ml (i.p.v. 100ml)
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <NutrientBox label="Vocht" value={Math.round(selectedDrink.fluid_ml * factor)} unit="ml" />
                    <NutrientBox label="Kalium" value={Math.round(selectedDrink.potassium_mg * factor)} unit="mg" />
                    <NutrientBox label="Fosfaat" value={Math.round(selectedDrink.phosphate_mg * factor)} unit="mg" />
                    <NutrientBox label="Natrium" value={Math.round(selectedDrink.sodium_mg * factor)} unit="mg" />
                  </div>
                  <Button onClick={handleAddDrink} disabled={adding || amountNum <= 0} className="h-12 w-full rounded-xl text-base font-semibold">
                    {adding ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Plus className="mr-2 h-5 w-5" />}
                    Toevoegen
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {drinkEntries.length > 0 && (
          <div>
            <h2 className="mb-3 font-display text-lg font-semibold">Vandaag gedronken</h2>
            <div className="space-y-2">
              {drinkEntries.map(entry => (
                <div key={entry.id} className="rounded-xl border border-border bg-card p-3">
                  <p className="font-medium text-foreground">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(entry.portions * 100)}ml · Vocht: {entry.fluid_ml}ml
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

function DrinkListItem({ drink, onClick, isSupermarket }: { drink: FoodRow; onClick: () => void; isSupermarket?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-secondary/50"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">{drink.name}</p>
          {isSupermarket && (
            <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/20">OFF</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">per 100ml</p>
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
