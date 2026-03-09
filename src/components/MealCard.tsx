import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type MealWithItems, mealTotals, duplicateMeal, toggleMealFavorite } from '@/hooks/useMeals';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MEAL_TYPE_LABELS: Record<string, string> = {
  ontbijt: '🌅 Ontbijt',
  lunch: '☀️ Lunch',
  avondeten: '🌙 Avondeten',
  tussendoortje: '🍪 Tussendoortje',
  custom: '🍽️',
};

interface MealCardProps {
  meal: MealWithItems;
  onRefresh: () => void;
  showActions?: boolean;
}

export default function MealCard({ meal, onRefresh, showActions = true }: MealCardProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const totals = mealTotals(meal.items);

  const typeLabel = MEAL_TYPE_LABELS[meal.meal_type] || '🍽️';
  const displayName = meal.meal_type === 'custom' ? meal.name : `${typeLabel}`;
  const time = new Date(meal.logged_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

  const handleDuplicate = async () => {
    if (!user) return;
    setDuplicating(true);
    try {
      await duplicateMeal(user.id, meal);
      toast.success(`${meal.name} opnieuw gelogd!`);
      onRefresh();
    } catch {
      toast.error('Kon maaltijd niet dupliceren.');
    }
    setDuplicating(false);
  };

  const handleToggleFavorite = async () => {
    try {
      await toggleMealFavorite(meal.id, !meal.is_favorite, meal.favorite_name || meal.name);
      toast.success(meal.is_favorite ? 'Verwijderd uit favorieten' : 'Opgeslagen als favoriet!');
      onRefresh();
    } catch {
      toast.error('Kon favoriet niet wijzigen.');
    }
  };

  const handleDelete = async () => {
    try {
      // Delete food entries first (cascade should handle but be safe)
      await supabase.from('food_entries').delete().eq('meal_id', meal.id);
      await supabase.from('meals').delete().eq('id', meal.id);
      toast.success('Maaltijd verwijderd');
      onRefresh();
    } catch {
      toast.error('Kon maaltijd niet verwijderen.');
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {displayName} {meal.meal_type === 'custom' && meal.name}
            </span>
            {meal.is_favorite && <Star className="h-3.5 w-3.5 text-primary fill-primary" />}
          </div>
          <p className="text-xs text-muted-foreground">
            {time} · {meal.items.length} item{meal.items.length !== 1 ? 's' : ''}
            {' · '}K: {totals.potassium}mg · Na: {totals.sodium}mg
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
          {/* Items */}
          {meal.items.map(item => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground truncate flex-1 mr-2">{item.name}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                K:{item.potassium_mg} · F:{item.phosphate_mg} · Na:{item.sodium_mg}
              </span>
            </div>
          ))}

          {/* Totals */}
          <div className="grid grid-cols-5 gap-1 text-center mt-2 pt-2 border-t border-border">
            <MiniTotal label="K" value={totals.potassium} unit="mg" />
            <MiniTotal label="F" value={totals.phosphate} unit="mg" />
            <MiniTotal label="Na" value={totals.sodium} unit="mg" />
            <MiniTotal label="E" value={Math.round(totals.protein * 10) / 10} unit="g" />
            <MiniTotal label="V" value={totals.fluid} unit="ml" />
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex gap-2 mt-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDuplicate}
                disabled={duplicating}
                className="flex-1 rounded-lg text-xs"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Opnieuw loggen
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleFavorite}
                className="rounded-lg text-xs"
              >
                <Star className={`mr-1.5 h-3.5 w-3.5 ${meal.is_favorite ? 'fill-primary text-primary' : ''}`} />
                {meal.is_favorite ? 'Unfavoriet' : 'Favoriet'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="rounded-lg text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniTotal({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-md bg-muted px-1 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-bold text-foreground">{value}</p>
    </div>
  );
}
