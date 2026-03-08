import { useState } from 'react';
import { Input } from '@/components/ui/input';
import type { FoodRow } from '@/hooks/useFoods';

interface AmountInputProps {
  food: FoodRow;
  /** Amount in grams (used for calculation as factor = grams / 100) */
  grams: number;
  onGramsChange: (grams: number) => void;
}

/** Quick-pick options shown as big tap targets */
const QUICK_COUNTS = [0.5, 1, 1.5, 2, 3];

/**
 * Smart amount input that supports portion-based or gram-based entry.
 * - Shows quick-select portion buttons when the food has a portion_description
 * - Uses grams as default for solids, ml only for liquid drink categories
 * - Converts portions ↔ grams automatically
 */
export default function AmountInput({ food, grams, onGramsChange }: AmountInputProps) {
  const isDrink = ['dranken', 'alcohol'].includes(food.category);
  const unit = isDrink ? 'ml' : 'g';
  const portionGrams = food.portion_grams || 100;
  const hasPortion = !!food.portion_description;

  const [mode, setMode] = useState<'portion' | 'unit'>(hasPortion ? 'portion' : 'unit');
  const [portionCount, setPortionCount] = useState(() =>
    hasPortion ? Math.max(0.5, Math.round((grams / portionGrams) * 2) / 2) : 1
  );

  const handlePortionSelect = (count: number) => {
    setPortionCount(count);
    setMode('portion');
    onGramsChange(Math.round(count * portionGrams));
  };

  const handleUnitChange = (value: number) => {
    setMode('unit');
    onGramsChange(value);
  };

  const switchToUnit = () => {
    setMode('unit');
  };

  const switchToPortion = () => {
    setMode('portion');
    const count = Math.max(0.5, Math.round((grams / portionGrams) * 2) / 2);
    setPortionCount(count);
    onGramsChange(Math.round(count * portionGrams));
  };

  /** Format portion label: "1 stuk", "2 stuks", "½ stuk" etc. */
  const formatCount = (n: number) => {
    if (n === 0.5) return '½';
    if (n === 1.5) return '1½';
    return String(n);
  };

  return (
    <div className="space-y-2.5">
      {hasPortion ? (
        <>
          {/* Portion description header */}
          <p className="text-xs font-medium text-muted-foreground">
            {food.portion_description} = {portionGrams}{unit}
          </p>

          {/* Quick-select portion buttons */}
          <div className="grid grid-cols-5 gap-1.5">
            {QUICK_COUNTS.map(count => {
              const isSelected = mode === 'portion' && portionCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => handlePortionSelect(count)}
                  className={`flex flex-col items-center rounded-xl border py-2.5 px-1 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5'
                  }`}
                >
                  <span className={`text-lg font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {formatCount(count)}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                    {Math.round(count * portionGrams)}{unit}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Toggle to manual gram input */}
          {mode === 'portion' ? (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                = {Math.round(portionCount * portionGrams)} {unit}
              </p>
              <button
                type="button"
                onClick={switchToUnit}
                className="text-xs text-primary font-medium hover:underline"
              >
                Aantal {unit} invoeren
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={grams}
                  onChange={e => handleUnitChange(parseFloat(e.target.value) || 0)}
                  className="h-10 w-24 rounded-lg text-sm"
                  autoFocus
                />
                <span className="text-sm text-muted-foreground">{unit}</span>
                <button
                  type="button"
                  onClick={switchToPortion}
                  className="ml-auto text-xs text-primary font-medium hover:underline"
                >
                  Porties kiezen
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* No portion info — plain unit input */
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">Hoeveelheid:</label>
          <Input
            type="number"
            min="1"
            step="1"
            value={grams}
            onChange={e => handleUnitChange(parseFloat(e.target.value) || 0)}
            className="h-10 w-24 rounded-lg text-sm"
          />
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
      )}
    </div>
  );
}
