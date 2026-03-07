import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface FoodRow {
  id: string;
  name: string;
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
}

const PAGE_SIZE = 20;

export function useFoodSearch(search: string) {
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const offset = page * PAGE_SIZE;

    supabase
      .rpc('search_foods', {
        search_query: search.trim(),
        page_size: PAGE_SIZE,
        page_offset: offset,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Food search error:', error);
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as FoodRow[];
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

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('food_entries')
      .select('*')
      .gte('logged_at', `${today}T00:00:00`)
      .lt('logged_at', `${today}T23:59:59.999`)
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

export async function addFoodEntryDB(userId: string, food: FoodRow, portions: number) {
  const { error } = await supabase.from('food_entries').insert({
    user_id: userId,
    food_id: food.id,
    name: food.name,
    potassium_mg: Math.round(food.potassium_mg * portions),
    phosphate_mg: Math.round(food.phosphate_mg * portions),
    sodium_mg: Math.round(food.sodium_mg * portions),
    protein_g: Math.round(food.protein_g * portions),
    fluid_ml: Math.round(food.fluid_ml * portions),
    portions,
  });
  if (error) throw error;
}
