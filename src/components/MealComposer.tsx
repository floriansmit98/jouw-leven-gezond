import { useState, useMemo } from 'react';
import { Plus, X, Check, Loader2, Search, ChevronRight, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AmountInput from '@/components/AmountInput';
import { useRecentFoods, useMostUsedFoods, foodDisplayName, type FoodRow } from '@/hooks/useFoods';
import { useUnifiedSearch, type UnifiedSearchResult } from '@/hooks/useUnifiedSearch';
import { type MealDraftItem, draftTotals, saveMeal, type MealWithItems } from '@/hooks/useMeals';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { analyzeFoodWarnings } from '@/lib/nutrientWarnings';
import { WarningBadges } from '@/components/NutrientWarnings';

/** Convert a UnifiedSearchResult to a FoodRow for use in the meal composer */
function unifiedResultToFoodRow(r: UnifiedSearchResult): FoodRow {
  return {
    id: r.food_id || r.result_id,
    name: r.display_name,
    display_name: r.display_name,
    category: r.category || 'overig',
    portion_description: r.portion_description || '100g',
    portion_grams: r.portion_grams || 100,
    potassium_mg: r.potassium_mg ?? 0,
    phosphate_mg: r.phosphate_mg ?? 0,
    sodium_mg: r.sodium_mg ?? 0,
    protein_g: r.protein_g ?? 0,
    fluid_ml: r.fluid_ml ?? 0,
    dialysis_risk_label: 'laag',
  };
}

const MEAL_TYPES = [
  { value: 'ontbijt', label: 'Ontbijt' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'avondeten', label: 'Avondeten' },
  { value: 'tussendoortje', label: 'Tussendoortje' },
  { value: 'custom', label: 'Anders' },
];

interface MealComposerProps {
  onSaved: () => void;
  onCancel: () => void;
  /** Pre-fill from a favorite/duplicate meal */
  prefill?: MealWithItems;
}

export default function MealComposer({ onSaved, onCancel, prefill }: MealComposerProps) {
  const { user } = useAuth();
  const [mealType, setMealType] = useState(prefill?.meal_type || 'ontbijt');
  const [customName, setCustomName] = useState(prefill?.name || '');
  const [items, setItems] = useState<MealDraftItem[]>([]);
  const [addingFood, setAddingFood] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  const [favoriteName, setFavoriteName] = useState('');

  const mealName = mealType === 'custom' ? customName : MEAL_TYPES.find(t => t.value === mealType)?.label || mealType;
  const totals = useMemo(() => draftTotals(items), [items]);

  const addItem = (food: FoodRow, amountGrams: number) => {
    setItems(prev => [...prev, { food, amountGrams }]);
    setAddingFood(false);
  };

  const updateItemAmount = (index: number, amountGrams: number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, amountGrams } : item));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleSave = async () => {
    if (!user || items.length === 0) return;
    if (mealType === 'custom' && !customName.trim()) {
      toast.error('Geef een naam aan uw maaltijd.');
      return;
    }
    setSaving(true);
    try {
      await saveMeal(user.id, mealName, mealType, items, saveAsFavorite, favoriteName || undefined);
      toast.success(`${mealName} opgeslagen met ${items.length} item${items.length > 1 ? 's' : ''}!`);
      onSaved();
    } catch {
      toast.error('Kon maaltijd niet opslaan.');
    }
    setSaving(false);
  };

  if (addingFood) {
    return <FoodPicker onSelect={addItem} onBack={() => setAddingFood(false)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>← Terug</Button>
        <h2 className="font-display text-lg font-semibold text-foreground">Maaltijd samenstellen</h2>
      </div>

      {/* Meal type selector */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Type maaltijd</p>
        <div className="flex flex-wrap gap-2">
          {MEAL_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => setMealType(type.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                mealType === type.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
        {mealType === 'custom' && (
          <Input
            placeholder="Naam van de maaltijd..."
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            className="mt-2 h-11 rounded-xl text-base"
            autoFocus
          />
        )}
      </div>

      {/* Items list */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">
          Producten ({items.length})
        </p>

        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Voeg producten toe aan uw maaltijd</p>
          </div>
        )}

        <div className="space-y-2">
          {items.map((item, index) => {
            const factor = item.amountGrams / 100;
            const isEditing = editingIndex === index;
            const warnings = analyzeFoodWarnings(item.food, item.amountGrams);

            return (
              <div key={index} className="rounded-xl border border-border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0" onClick={() => setEditingIndex(isEditing ? null : index)}>
                    <p className="font-semibold text-foreground text-sm truncate">{foodDisplayName(item.food)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.amountGrams}{['dranken', 'alcohol'].includes(item.food.category) ? 'ml' : 'g'}
                      {' · '}K: {Math.round(item.food.potassium_mg * factor)}mg
                      {' · '}Na: {Math.round(item.food.sodium_mg * factor)}mg
                    </p>
                  </div>
                  <button onClick={() => removeItem(index)} className="rounded-lg p-1.5 hover:bg-muted">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {warnings.length > 0 && <WarningBadges warnings={warnings} />}

                {isEditing && (
                  <div className="border-t border-border pt-2">
                    <AmountInput
                      food={item.food}
                      grams={item.amountGrams}
                      onGramsChange={(g) => updateItemAmount(index, g)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add more button */}
        <button
          onClick={() => setAddingFood(true)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Product toevoegen
        </button>
      </div>

      {/* Totals preview */}
      {items.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground mb-2">Maaltijd totaal</p>
          <div className="grid grid-cols-5 gap-2 text-center">
            <NutrientBox label="Kalium" value={totals.potassium} unit="mg" />
            <NutrientBox label="Fosfaat" value={totals.phosphate} unit="mg" />
            <NutrientBox label="Natrium" value={totals.sodium} unit="mg" />
            <NutrientBox label="Eiwit" value={Math.round(totals.protein * 10) / 10} unit="g" />
            <NutrientBox label="Vocht" value={totals.fluid} unit="ml" />
          </div>
        </div>
      )}

      {/* Save as favorite toggle */}
      {items.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              onClick={() => setSaveAsFavorite(!saveAsFavorite)}
              className={`flex h-6 w-6 items-center justify-center rounded-md border transition-all ${
                saveAsFavorite ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
              }`}
            >
              {saveAsFavorite && <Star className="h-3.5 w-3.5" />}
            </button>
            <span className="text-sm font-medium text-foreground">Opslaan als favoriet</span>
          </label>
          {saveAsFavorite && (
            <Input
              placeholder="Naam (bijv. 'Standaard ontbijt')"
              value={favoriteName}
              onChange={e => setFavoriteName(e.target.value)}
              className="mt-2 h-10 rounded-xl text-sm"
            />
          )}
        </div>
      )}

      {/* Save button */}
      {items.length > 0 && (
        <Button
          onClick={handleSave}
          disabled={saving || (mealType === 'custom' && !customName.trim())}
          className="h-12 w-full rounded-xl text-base font-semibold"
        >
          {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
          Maaltijd opslaan ({items.length} items)
        </Button>
      )}
    </div>
  );
}

function NutrientBox({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-lg bg-muted px-1 py-2">
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      <p className="text-sm font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{unit}</p>
    </div>
  );
}

/** Inline food picker used within the meal composer */
function FoodPicker({ onSelect, onBack }: { onSelect: (food: FoodRow, grams: number) => void; onBack: () => void }) {
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodRow | null>(null);
  const [amount, setAmount] = useState(100);
  const { results: unifiedResults, loading } = useUnifiedSearch(query);
  const searchResults = useMemo(() => {
    console.log('[MealComposer] Unified search results for query:', query, '→', unifiedResults.length, 'results', unifiedResults.map(r => `${r.display_name} (${r.result_type})`));
    return unifiedResults.map(unifiedResultToFoodRow);
  }, [unifiedResults, query]);
  const { foods: recentFoods } = useRecentFoods();
  const { foods: mostUsedFoods } = useMostUsedFoods();

  const showResults = query.trim().length > 0;

  if (selectedFood) {
    const factor = amount / 100;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedFood(null)}>← Terug</Button>
          <h2 className="font-display text-lg font-semibold text-foreground">Hoeveelheid</h2>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div>
            <p className="font-semibold text-foreground">{foodDisplayName(selectedFood)}</p>
            <p className="text-xs text-muted-foreground">{selectedFood.portion_description} · {selectedFood.category}</p>
          </div>
          <AmountInput food={selectedFood} grams={amount} onGramsChange={setAmount} />
          {amount > 0 && (
            <div className="grid grid-cols-5 gap-1 text-center">
              <MiniNutrient label="K" value={Math.round(selectedFood.potassium_mg * factor)} unit="mg" />
              <MiniNutrient label="F" value={Math.round(selectedFood.phosphate_mg * factor)} unit="mg" />
              <MiniNutrient label="Na" value={Math.round(selectedFood.sodium_mg * factor)} unit="mg" />
              <MiniNutrient label="E" value={Math.round(selectedFood.protein_g * factor * 10) / 10} unit="g" />
              <MiniNutrient label="V" value={Math.round(selectedFood.fluid_ml * factor)} unit="ml" />
            </div>
          )}
        </div>
        <Button
          onClick={() => onSelect(selectedFood, amount)}
          disabled={amount <= 0}
          className="h-12 w-full rounded-xl text-base font-semibold"
        >
          <Plus className="mr-2 h-5 w-5" />
          Toevoegen aan maaltijd
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>← Terug</Button>
        <h2 className="font-display text-lg font-semibold text-foreground">Product zoeken</h2>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Zoek voedingsmiddel..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="h-12 rounded-xl pl-10 pr-10 text-base"
          autoFocus
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showResults ? (
        <div className="space-y-1.5">
          {searchResults.map(food => {
            const isUnmatched = (food as any).nevoMatched === false;
            return (
              <button
                key={food.id}
                onClick={() => { if (!isUnmatched) { setSelectedFood(food); setAmount(food.portion_grams || 100); } }}
                disabled={isUnmatched}
                className={`flex w-full items-center justify-between rounded-xl border bg-card p-3 text-left shadow-sm ${
                  isUnmatched ? 'border-border/50 opacity-60 cursor-not-allowed' : 'border-border hover:bg-secondary/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{foodDisplayName(food)}</p>
                  <p className="text-xs text-muted-foreground">
                    {isUnmatched ? '⚠️ Geen betrouwbare voedingswaarden' : `${food.portion_description} · ${food.category}`}
                  </p>
                </div>
                {!isUnmatched && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground ml-2" />}
              </button>
            );
          })}
          {loading && <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
          {!loading && searchResults.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">Geen resultaten voor "{query}"</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {mostUsedFoods.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">⭐ Meest gebruikt</h3>
              <div className="space-y-1.5">
                {mostUsedFoods.map(food => (
                  <button
                    key={food.id}
                    onClick={() => { setSelectedFood(food); setAmount(food.portion_grams || 100); }}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left shadow-sm hover:bg-secondary/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{foodDisplayName(food)}</p>
                      <p className="text-xs text-muted-foreground">{food.portion_description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {recentFoods.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">🕐 Recent gebruikt</h3>
              <div className="space-y-1.5">
                {recentFoods.map(food => (
                  <button
                    key={food.id}
                    onClick={() => { setSelectedFood(food); setAmount(food.portion_grams || 100); }}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left shadow-sm hover:bg-secondary/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{foodDisplayName(food)}</p>
                      <p className="text-xs text-muted-foreground">{food.portion_description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniNutrient({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-md bg-muted px-1 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-bold text-foreground">{value}</p>
    </div>
  );
}
