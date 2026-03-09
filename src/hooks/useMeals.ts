import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { FoodRow } from './useFoods';

export interface MealRow {
  id: string;
  user_id: string;
  name: string;
  meal_type: string;
  logged_at: string;
  is_favorite: boolean;
  favorite_name: string | null;
  created_at: string;
}

export interface MealWithItems extends MealRow {
  items: MealItemEntry[];
}

export interface MealItemEntry {
  id: string;
  food_id: string | null;
  name: string;
  potassium_mg: number;
  phosphate_mg: number;
  sodium_mg: number;
  protein_g: number;
  fluid_ml: number;
  portions: number;
}

/** Items being composed before saving */
export interface MealDraftItem {
  food: FoodRow;
  amountGrams: number;
}

export function useTodayMeals() {
  const { user } = useAuth();
  const [meals, setMeals] = useState<MealWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMeals = async () => {
    if (!user) { setMeals([]); setLoading(false); return; }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data: mealRows, error } = await supabase
      .from('meals')
      .select('*')
      .gte('logged_at', startOfDay.toISOString())
      .lte('logged_at', endOfDay.toISOString())
      .order('logged_at', { ascending: false });

    if (error) { console.error(error); setLoading(false); return; }

    // Fetch items for each meal
    const mealIds = (mealRows ?? []).map((m: any) => m.id);
    let itemsByMeal: Record<string, MealItemEntry[]> = {};

    if (mealIds.length > 0) {
      const { data: items } = await supabase
        .from('food_entries')
        .select('id, food_id, name, potassium_mg, phosphate_mg, sodium_mg, protein_g, fluid_ml, portions, meal_id')
        .in('meal_id', mealIds);

      for (const item of (items ?? []) as any[]) {
        if (!itemsByMeal[item.meal_id]) itemsByMeal[item.meal_id] = [];
        itemsByMeal[item.meal_id].push(item);
      }
    }

    setMeals((mealRows ?? []).map((m: any) => ({
      ...m,
      items: itemsByMeal[m.id] || [],
    })));
    setLoading(false);
  };

  useEffect(() => { fetchMeals(); }, [user]);

  return { meals, loading, refetch: fetchMeals };
}

export function useFavoriteMeals() {
  const { user } = useAuth();
  const [meals, setMeals] = useState<MealWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = async () => {
    if (!user) { setMeals([]); setLoading(false); return; }

    const { data: mealRows } = await supabase
      .from('meals')
      .select('*')
      .eq('is_favorite', true)
      .order('created_at', { ascending: false });

    const mealIds = (mealRows ?? []).map((m: any) => m.id);
    let itemsByMeal: Record<string, MealItemEntry[]> = {};

    if (mealIds.length > 0) {
      const { data: items } = await supabase
        .from('food_entries')
        .select('id, food_id, name, potassium_mg, phosphate_mg, sodium_mg, protein_g, fluid_ml, portions, meal_id')
        .in('meal_id', mealIds);

      for (const item of (items ?? []) as any[]) {
        if (!itemsByMeal[item.meal_id]) itemsByMeal[item.meal_id] = [];
        itemsByMeal[item.meal_id].push(item);
      }
    }

    setMeals((mealRows ?? []).map((m: any) => ({
      ...m,
      items: itemsByMeal[m.id] || [],
    })));
    setLoading(false);
  };

  useEffect(() => { fetchFavorites(); }, [user]);

  return { meals, loading, refetch: fetchFavorites };
}

export function useRecentMeals() {
  const { user } = useAuth();
  const [meals, setMeals] = useState<MealWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setMeals([]); setLoading(false); return; }

    supabase
      .from('meals')
      .select('*')
      .order('logged_at', { ascending: false })
      .limit(10)
      .then(async ({ data: mealRows }) => {
        const mealIds = (mealRows ?? []).map((m: any) => m.id);
        let itemsByMeal: Record<string, MealItemEntry[]> = {};

        if (mealIds.length > 0) {
          const { data: items } = await supabase
            .from('food_entries')
            .select('id, food_id, name, potassium_mg, phosphate_mg, sodium_mg, protein_g, fluid_ml, portions, meal_id')
            .in('meal_id', mealIds);

          for (const item of (items ?? []) as any[]) {
            if (!itemsByMeal[item.meal_id]) itemsByMeal[item.meal_id] = [];
            itemsByMeal[item.meal_id].push(item);
          }
        }

        setMeals((mealRows ?? []).map((m: any) => ({
          ...m,
          items: itemsByMeal[m.id] || [],
        })));
        setLoading(false);
      });
  }, [user]);

  return { meals, loading };
}

export function mealTotals(items: MealItemEntry[]) {
  return {
    potassium: items.reduce((s, i) => s + Number(i.potassium_mg), 0),
    phosphate: items.reduce((s, i) => s + Number(i.phosphate_mg), 0),
    sodium: items.reduce((s, i) => s + Number(i.sodium_mg), 0),
    protein: items.reduce((s, i) => s + Number(i.protein_g), 0),
    fluid: items.reduce((s, i) => s + Number(i.fluid_ml), 0),
  };
}

export function draftTotals(items: MealDraftItem[]) {
  return {
    potassium: items.reduce((s, i) => s + Math.round(i.food.potassium_mg * i.amountGrams / 100), 0),
    phosphate: items.reduce((s, i) => s + Math.round(i.food.phosphate_mg * i.amountGrams / 100), 0),
    sodium: items.reduce((s, i) => s + Math.round(i.food.sodium_mg * i.amountGrams / 100), 0),
    protein: items.reduce((s, i) => s + Math.round(i.food.protein_g * i.amountGrams / 100 * 10) / 10, 0),
    fluid: items.reduce((s, i) => s + Math.round(i.food.fluid_ml * i.amountGrams / 100), 0),
  };
}

export async function saveMeal(
  userId: string,
  name: string,
  mealType: string,
  items: MealDraftItem[],
  isFavorite: boolean = false,
  favoriteName?: string,
) {
  // 1. Create meal
  const { data: meal, error: mealErr } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      name,
      meal_type: mealType,
      is_favorite: isFavorite,
      favorite_name: favoriteName || null,
    })
    .select()
    .single();

  if (mealErr || !meal) throw mealErr || new Error('Maaltijd kon niet worden aangemaakt');

  // 2. Insert food entries linked to meal
  const entries = items.map(item => {
    const factor = item.amountGrams / 100;
    return {
      user_id: userId,
      food_id: item.food.id,
      meal_id: (meal as any).id,
      name: item.food.display_name || item.food.name,
      potassium_mg: Math.round(item.food.potassium_mg * factor),
      phosphate_mg: Math.round(item.food.phosphate_mg * factor),
      sodium_mg: Math.round(item.food.sodium_mg * factor),
      protein_g: Math.round(item.food.protein_g * factor * 10) / 10,
      fluid_ml: Math.round(item.food.fluid_ml * factor),
      portions: factor,
    };
  });

  const { error: entriesErr } = await supabase.from('food_entries').insert(entries);
  if (entriesErr) throw entriesErr;

  return meal;
}

export async function duplicateMeal(userId: string, sourceMeal: MealWithItems) {
  // Create a new meal with same items
  const { data: meal, error: mealErr } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      name: sourceMeal.name,
      meal_type: sourceMeal.meal_type,
      is_favorite: false,
    })
    .select()
    .single();

  if (mealErr || !meal) throw mealErr || new Error('Maaltijd kon niet worden gedupliceerd');

  const entries = sourceMeal.items.map(item => ({
    user_id: userId,
    food_id: item.food_id,
    meal_id: (meal as any).id,
    name: item.name,
    potassium_mg: item.potassium_mg,
    phosphate_mg: item.phosphate_mg,
    sodium_mg: item.sodium_mg,
    protein_g: item.protein_g,
    fluid_ml: item.fluid_ml,
    portions: item.portions,
  }));

  const { error: entriesErr } = await supabase.from('food_entries').insert(entries);
  if (entriesErr) throw entriesErr;

  return meal;
}

export async function toggleMealFavorite(mealId: string, isFavorite: boolean, favoriteName?: string) {
  const { error } = await supabase
    .from('meals')
    .update({ is_favorite: isFavorite, favorite_name: favoriteName || null })
    .eq('id', mealId);
  if (error) throw error;
}
