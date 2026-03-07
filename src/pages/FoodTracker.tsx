import { useState } from 'react';
import { Search, Plus, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { COMMON_FOODS, addFoodEntry, getFoodEntries, type FoodItem } from '@/lib/store';
import { toast } from 'sonner';

export default function FoodTracker() {
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [portions, setPortions] = useState('1');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = COMMON_FOODS.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const todayEntries = getFoodEntries().filter(f =>
    f.timestamp.startsWith(new Date().toISOString().split('T')[0])
  );

  function handleAddFood() {
    if (!selectedFood) return;
    const p = parseFloat(portions) || 1;
    addFoodEntry({
      name: selectedFood.name,
      potassium: Math.round(selectedFood.potassium * p),
      phosphate: Math.round(selectedFood.phosphate * p),
      sodium: Math.round(selectedFood.sodium * p),
      protein: Math.round(selectedFood.protein * p),
      fluid: Math.round(selectedFood.fluid * p),
    });
    toast.success(`${selectedFood.name} toegevoegd!`);
    setSelectedFood(null);
    setPortions('1');
    setDialogOpen(false);
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader
          title="Voeding"
          subtitle="Log wat u vandaag heeft gegeten"
        />

        {/* Search */}
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
          {filtered.map(food => (
            <Dialog key={food.name} open={dialogOpen && selectedFood?.name === food.name} onOpenChange={(open) => {
              setDialogOpen(open);
              if (open) setSelectedFood(food);
            }}>
              <DialogTrigger asChild>
                <button
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-secondary/50"
                >
                  <div>
                    <p className="font-semibold text-foreground">{food.name}</p>
                    <p className="text-xs text-muted-foreground">{food.portion} · K: {food.potassium}mg · F: {food.phosphate}mg · E: {food.protein}g</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="font-display">{food.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-muted-foreground">Kalium</p>
                      <p className="text-lg font-bold">{Math.round(food.potassium * (parseFloat(portions) || 1))} mg</p>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-muted-foreground">Fosfaat</p>
                      <p className="text-lg font-bold">{Math.round(food.phosphate * (parseFloat(portions) || 1))} mg</p>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-muted-foreground">Natrium</p>
                      <p className="text-lg font-bold">{Math.round(food.sodium * (parseFloat(portions) || 1))} mg</p>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-muted-foreground">Eiwit</p>
                      <p className="text-lg font-bold">{Math.round(food.protein * (parseFloat(portions) || 1))} g</p>
                    </div>
                    <div className="rounded-lg bg-muted p-3 col-span-2">
                      <p className="text-muted-foreground">Vocht</p>
                      <p className="text-lg font-bold">{Math.round(food.fluid * (parseFloat(portions) || 1))} ml</p>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Aantal porties ({food.portion})</label>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={portions}
                      onChange={e => setPortions(e.target.value)}
                      className="h-12 rounded-xl text-base"
                    />
                  </div>
                  <Button onClick={handleAddFood} className="h-12 w-full rounded-xl text-base font-semibold">
                    <Plus className="mr-2 h-5 w-5" />
                    Toevoegen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>

        {/* Today's entries */}
        {todayEntries.length > 0 && (
          <div>
            <h2 className="mb-3 font-display text-lg font-semibold">Vandaag gegeten</h2>
            <div className="space-y-2">
              {todayEntries.map(entry => (
                <div key={entry.id} className="rounded-xl border border-border bg-card p-3">
                  <p className="font-medium text-foreground">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">
                    K: {entry.potassium}mg · F: {entry.phosphate}mg · Na: {entry.sodium}mg · E: {entry.protein}g · Vocht: {entry.fluid}ml
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
