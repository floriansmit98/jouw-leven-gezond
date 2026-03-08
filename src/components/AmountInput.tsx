import { useState } from 'react';
import { Input } from '@/components/ui/input';
import type { FoodRow } from '@/hooks/useFoods';

interface AmountInputProps {
  food: FoodRow;
  /** Amount in grams (used for calculation as factor = grams / 100) */
  grams: number;
  onGramsChange: (grams: number) => void;
}

/**
 * Smart amount input that supports portion-based or gram-based entry.
 * - Shows portion selector when the food has a meaningful portion_description
 * - Uses grams as default for solids, ml only for liquid drink categories
 * - Converts portions ↔ grams automatically
 */
export default function AmountInput({ food, grams, onGramsChange }: AmountInputProps) {
  const isDrink = ['dranken', 'alcohol'].includes(food.category);
  const unit = isDrink ? 'ml' : 'g';
  const portionGrams = food.portion_grams || 100;
  const hasPortion = portionGrams !== 100 && !!food.portion_description;

  const [mode, setMode] = useState<'portion' | 'unit'>(hasPortion ? 'portion' : 'unit');
  const [portionCount, setPortionCount] = useState(() =>
    hasPortion ? Math.max(1, Math.round((grams / portionGrams) * 10) / 10) : 1
  );

  const handleModeToggle = (newMode: 'portion' | 'unit') => {
    setMode(newMode);
    if (newMode === 'portion') {
      const count = Math.max(0.5, Math.round((grams / portionGrams) * 2) / 2);
      setPortionCount(count);
      onGramsChange(Math.round(count * portionGrams));
    }
  };

  const handlePortionChange = (count: number) => {
    setPortionCount(count);
    onGramsChange(Math.round(count * portionGrams));
  };

  const handleUnitChange = (value: number) => {
    onGramsChange(value);
  };

  return (
    <div className="space-y-2">
      {/* Mode toggle - only show if portion info available */}
      {hasPortion && (
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => handleModeToggle('portion')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'portion'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            Porties
          </button>
          <button
            type="button"
            onClick={() => handleModeToggle('unit')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'unit'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {unit === 'ml' ? 'Milliliter' : 'Gram'}
          </button>
        </div>
      )}

      {mode === 'portion' && hasPortion ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">Aantal:</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => portionCount > 0.5 && handlePortionChange(portionCount - 0.5)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted font-bold text-lg"
              >
                −
              </button>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={portionCount}
                onChange={e => handlePortionChange(parseFloat(e.target.value) || 0.5)}
                className="h-9 w-16 rounded-lg text-sm text-center"
              />
              <button
                type="button"
                onClick={() => handlePortionChange(portionCount + 0.5)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted font-bold text-lg"
              >
                +
              </button>
            </div>
            <span className="text-sm text-muted-foreground truncate">
              × {food.portion_description}
            </span>
          </div>
          <p className="text-xs text-muted-foreground ml-14">
            = {Math.round(portionCount * portionGrams)} {unit}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">Hoeveelheid:</label>
          <Input
            type="number"
            min="1"
            step="1"
            value={grams}
            onChange={e => handleUnitChange(parseFloat(e.target.value) || 0)}
            className="h-9 w-24 rounded-lg text-sm"
          />
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
      )}
    </div>
  );
}
