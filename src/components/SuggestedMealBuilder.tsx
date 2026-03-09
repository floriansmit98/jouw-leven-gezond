import { useState, useMemo, useEffect } from 'react';
import { CookingPot, X, Check, Loader2, Plus, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AmountInput from '@/components/AmountInput';
import { foodDisplayName, useFoodSearch, type FoodRow } from '@/hooks/useFoods';
import type { AIFoodComponent } from '@/hooks/useAIFoodSearch';
import type { MealPatternMatch } from '@/hooks/useMealPatterns';
import { analyzeFoodWarnings } from '@/lib/nutrientWarnings';
import { WarningBadges } from '@/components/NutrientWarnings';

interface MealIngredient {
  id: string;
  name: string;
  food: FoodRow;
  amountGrams: number;
}

interface SuggestedMealBuilderProps {
  query: string;
  /** AI-detected components */
  components?: AIFoodComponent[];
  /** Pattern-matched meal */
  patternMatch?: MealPatternMatch;
  displayMessage?: string;
  onAddAll: (items: { food: FoodRow; amountGrams: number }[]) => Promise<void>;
  onAddSingle: (food: FoodRow, amountGrams: number) => void;
  saving?: boolean;
}

export default function SuggestedMealBuilder({
  query,
  components,
  displayMessage,
  onAddAll,
  onAddSingle,
  saving,
}: SuggestedMealBuilderProps) {
  const [ingredients, setIngredients] = useState<MealIngredient[]>(() =>
    components
      .filter(c => c.match)
      .map((c, i) => ({
        id: `${i}-${c.name}`,
        name: c.name,
        food: c.match!,
        amountGrams: c.match!.portion_grams || 100,
      }))
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showNutrients, setShowNutrients] = useState(false);

  const totals = useMemo(() => {
    return ingredients.reduce(
      (acc, ing) => {
        const f = ing.amountGrams / 100;
        return {
          potassium: acc.potassium + Math.round(ing.food.potassium_mg * f),
          phosphate: acc.phosphate + Math.round(ing.food.phosphate_mg * f),
          sodium: acc.sodium + Math.round(ing.food.sodium_mg * f),
          protein: acc.protein + Math.round(ing.food.protein_g * f * 10) / 10,
          fluid: acc.fluid + Math.round(ing.food.fluid_ml * f),
        };
      },
      { potassium: 0, phosphate: 0, sodium: 0, protein: 0, fluid: 0 }
    );
  }, [ingredients]);

  const updateAmount = (id: string, grams: number) => {
    setIngredients(prev => prev.map(ing => ing.id === id ? { ...ing, amountGrams: grams } : ing));
  };

  const removeIngredient = (id: string) => {
    setIngredients(prev => prev.filter(ing => ing.id !== id));
  };

  const replaceIngredient = (id: string, newFood: FoodRow) => {
    setIngredients(prev =>
      prev.map(ing =>
        ing.id === id
          ? { ...ing, food: newFood, amountGrams: newFood.portion_grams || 100 }
          : ing
      )
    );
    setReplacingId(null);
    setReplaceQuery('');
  };

  const handleAddAll = async () => {
    await onAddAll(ingredients.map(ing => ({ food: ing.food, amountGrams: ing.amountGrams })));
  };

  if (ingredients.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-primary/5 to-primary/10 p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
          <CookingPot className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Voorgestelde maaltijd</p>
          {displayMessage && (
            <p className="text-xs text-muted-foreground truncate">{displayMessage}</p>
          )}
        </div>
      </div>

      {/* Ingredients list */}
      <div className="space-y-2">
        {ingredients.map((ing) => {
          const isExpanded = expandedId === ing.id;
          const isReplacing = replacingId === ing.id;
          const factor = ing.amountGrams / 100;

          return (
            <div key={ing.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              {/* Ingredient row */}
              <div
                className="flex items-center gap-2.5 p-3 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : ing.id)}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {ingredients.indexOf(ing) + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {foodDisplayName(ing.food)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {ing.name} · {ing.amountGrams}{ing.food.category === 'dranken' ? ' ml' : ' g'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); removeIngredient(ing.id); }}
                    className="rounded-lg p-1.5 hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Expanded: amount + replace */}
              {isExpanded && (
                <div className="border-t border-border p-3 space-y-3 bg-muted/30">
                  <AmountInput
                    food={ing.food}
                    grams={ing.amountGrams}
                    onGramsChange={(g) => updateAmount(ing.id, g)}
                  />

                  {/* Nutrient preview for this ingredient */}
                  <div className="grid grid-cols-5 gap-1 text-center">
                    <NutrientPill label="K" value={Math.round(ing.food.potassium_mg * factor)} unit="mg" />
                    <NutrientPill label="F" value={Math.round(ing.food.phosphate_mg * factor)} unit="mg" />
                    <NutrientPill label="Na" value={Math.round(ing.food.sodium_mg * factor)} unit="mg" />
                    <NutrientPill label="E" value={Math.round(ing.food.protein_g * factor * 10) / 10} unit="g" />
                    <NutrientPill label="V" value={Math.round(ing.food.fluid_ml * factor)} unit="ml" />
                  </div>

                  <button
                    onClick={() => { setReplacingId(isReplacing ? null : ing.id); setReplaceQuery(ing.name); }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {isReplacing ? 'Annuleer vervangen' : 'Vervang ingrediënt'}
                  </button>

                  {isReplacing && (
                    <ReplaceSearch
                      query={replaceQuery}
                      onQueryChange={setReplaceQuery}
                      onSelect={(food) => replaceIngredient(ing.id, food)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Nutrient totals */}
      <button
        onClick={() => setShowNutrients(!showNutrients)}
        className="flex w-full items-center justify-between rounded-lg bg-card border border-border p-2.5"
      >
        <span className="text-xs font-semibold text-foreground">Totale voedingswaarden</span>
        {showNutrients ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {showNutrients && (
        <div className="grid grid-cols-5 gap-1 text-center">
          <NutrientPill label="K" value={totals.potassium} unit="mg" highlight />
          <NutrientPill label="F" value={totals.phosphate} unit="mg" highlight />
          <NutrientPill label="Na" value={totals.sodium} unit="mg" highlight />
          <NutrientPill label="E" value={totals.protein} unit="g" highlight />
          <NutrientPill label="V" value={totals.fluid} unit="ml" highlight />
        </div>
      )}

      {/* Add all button */}
      <Button
        onClick={handleAddAll}
        disabled={saving || ingredients.length === 0}
        className="h-12 w-full rounded-xl text-base font-semibold"
      >
        {saving ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <Check className="mr-2 h-5 w-5" />
        )}
        Volledige maaltijd toevoegen ({ingredients.length})
      </Button>
    </div>
  );
}

function NutrientPill({ label, value, unit, highlight }: { label: string; value: number; unit: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md px-1 py-1.5 ${highlight ? 'bg-primary/10' : 'bg-muted'}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-xs font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function ReplaceSearch({ query, onQueryChange, onSelect }: {
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (food: FoodRow) => void;
}) {
  const { foods, loading } = useFoodSearch(query);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Zoek alternatief..."
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          className="h-8 rounded-lg pl-8 text-xs"
          autoFocus
        />
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto">
        {foods.slice(0, 5).map(f => (
          <button
            key={f.id}
            onClick={() => onSelect(f)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted transition-colors"
          >
            <span className="text-foreground truncate">{foodDisplayName(f)}</span>
            <Plus className="h-3 w-3 text-primary shrink-0 ml-1" />
          </button>
        ))}
        {loading && <Loader2 className="mx-auto h-3 w-3 animate-spin text-primary" />}
      </div>
    </div>
  );
}
