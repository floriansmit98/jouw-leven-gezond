import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface FoodRow {
  id: string;
  name: string;
  display_name: string | null;
  category: string;
  portion_description: string;
  portion_grams: number;
  potassium_mg: number;
  phosphate_mg: number;
  sodium_mg: number;
  protein_g: number;
  fluid_ml: number;
  dialysis_risk_label: string;
}

/** Returns the user-friendly display name, falling back to the raw name */
export function foodDisplayName(food: FoodRow): string {
  return food.display_name || food.name;
}

export interface FoodEntryRow {
  id: string;
  food_id: string | null;
  name: string;
  potassium_mg: number;
  phosphate_mg: number;
  sodium_mg: number;
  protein_g: number;
  fluid_ml: number;
  portions: number;
  logged_at: string;
  meal_type: string | null;
}

const PAGE_SIZE = 20;

/** Shared helper: search via unified_food_search and map results to FoodRow */
export async function searchFoodsUnified(
  query: string,
  pageSize = 20,
  pageOffset = 0
): Promise<FoodRow[]> {
  const { data, error } = await supabase.rpc('search_all_foods', {
    search_query: query,
    page_size: pageSize,
    page_offset: pageOffset,
  });
  if (error) {
    console.error('[searchFoodsUnified] error:', error);
    return [];
  }
  return ((data ?? []) as any[]).map(row => ({
    id: row.food_id || row.result_id,
    name: row.display_name,
    display_name: row.display_name,
    category: row.category || 'overig',
    portion_description: row.portion_description || '100g',
    portion_grams: row.portion_grams || 100,
    potassium_mg: row.potassium_mg ?? 0,
    phosphate_mg: row.phosphate_mg ?? 0,
    sodium_mg: row.sodium_mg ?? 0,
    protein_g: row.protein_g ?? 0,
    fluid_ml: row.fluid_ml ?? 0,
    dialysis_risk_label: 'laag',
  }));
}

export function useFoodSearch(search: string, _isDrink?: boolean) {
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const trimmed = search.trim();

    if (!trimmed) {
      setFoods([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    setLoading(true);
    const offset = page * PAGE_SIZE;

    searchFoodsUnified(trimmed, PAGE_SIZE, offset).then(rows => {
      if (cancelled) return;
      if (page === 0) {
        setFoods(rows);
      } else {
        setFoods(prev => [...prev, ...rows]);
      }
      setHasMore(rows.length === PAGE_SIZE);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [search, page]);

  const loadMore = () => setPage(p => p + 1);

  return { foods, loading, hasMore, loadMore };
}

export function useTodayEntries() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<FoodEntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = async () => {
    if (!user) { setEntries([]); setLoading(false); return; }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('food_entries')
      .select('*')
      .gte('logged_at', startOfDay.toISOString())
      .lte('logged_at', endOfDay.toISOString())
      .order('logged_at', { ascending: false });

    if (!error) setEntries((data ?? []) as FoodEntryRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, [user]);

  return { entries, loading, refetch: fetchEntries };
}

export function useTodayTotals() {
  const { entries } = useTodayEntries();

  return {
    potassium: entries.reduce((s, e) => s + Number(e.potassium_mg), 0),
    phosphate: entries.reduce((s, e) => s + Number(e.phosphate_mg), 0),
    sodium: entries.reduce((s, e) => s + Number(e.sodium_mg), 0),
    protein: entries.reduce((s, e) => s + Number(e.protein_g), 0),
    fluid: entries.reduce((s, e) => s + Number(e.fluid_ml), 0),
  };
}

export function useRecentFoods() {
  const { user } = useAuth();
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setFoods([]); setLoading(false); return; }
    supabase
      .rpc('get_recent_foods', { p_user_id: user.id, p_limit: 8 })
      .then(({ data, error }) => {
        if (!error) setFoods((data ?? []) as FoodRow[]);
        setLoading(false);
      });
  }, [user]);

  return { foods, loading };
}

export function useMostUsedFoods() {
  const { user } = useAuth();
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setFoods([]); setLoading(false); return; }
    supabase
      .rpc('get_most_used_foods', { p_user_id: user.id, p_limit: 8 })
      .then(({ data, error }) => {
        if (!error) setFoods((data ?? []) as FoodRow[]);
        setLoading(false);
      });
  }, [user]);

  return { foods, loading };
}

export async function addFoodEntryDB(userId: string, food: FoodRow, portions: number, mealType?: string) {
  const { error } = await supabase.from('food_entries').insert({
    user_id: userId,
    food_id: food.id,
    name: food.display_name || food.name,
    potassium_mg: Math.round(food.potassium_mg * portions),
    phosphate_mg: Math.round(food.phosphate_mg * portions),
    sodium_mg: Math.round(food.sodium_mg * portions),
    protein_g: Math.round(food.protein_g * portions),
    fluid_ml: Math.round(food.fluid_ml * portions),
    portions,
    meal_type: mealType || null,
  } as any);
  if (error) throw error;
}
