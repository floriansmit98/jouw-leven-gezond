import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UnifiedSearchResult {
  result_id: string;
  result_type: 'food' | 'meal' | 'branded_product';
  display_name: string;
  category: string;
  brand: string | null;
  food_id: string | null;
  potassium_mg: number;
  phosphate_mg: number;
  sodium_mg: number;
  protein_g: number;
  fluid_ml: number;
  portion_description: string;
  portion_grams: number;
  rank_score: number;
}

export interface CommonMealItem {
  id: string;
  meal_id: string;
  food_id: string;
  amount_grams: number;
  amount_ml: number;
  portion_count: number;
  food?: {
    id: string;
    name: string;
    display_name: string | null;
    portion_description: string;
    portion_grams: number;
    potassium_mg: number;
    phosphate_mg: number;
    sodium_mg: number;
    protein_g: number;
    fluid_ml: number;
    category: string;
    dialysis_risk_label: string;
  };
}

const PAGE_SIZE = 20;

export function useUnifiedSearch(query: string) {
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [query]);

  useEffect(() => {
    let cancelled = false;
    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    setLoading(true);

    supabase
      .rpc('search_all_foods', {
        search_query: trimmed,
        page_size: PAGE_SIZE,
        page_offset: page * PAGE_SIZE,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Unified search error:', error);
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as UnifiedSearchResult[];
        if (page === 0) {
          setResults(rows);
        } else {
          setResults(prev => [...prev, ...rows]);
        }
        setHasMore(rows.length === PAGE_SIZE);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [query, page]);

  const loadMore = () => setPage(p => p + 1);

  return { results, loading, hasMore, loadMore };
}

export async function fetchCommonMealItems(mealId: string): Promise<CommonMealItem[]> {
  const { data, error } = await supabase
    .from('common_meal_items' as any)
    .select('*, food:foods(*)')
    .eq('meal_id', mealId);

  if (error) {
    console.error('Error fetching meal items:', error);
    return [];
  }
  return (data ?? []) as unknown as CommonMealItem[];
}

export async function logMissingSearch(
  searchTerm: string,
  resultType: 'not_found' | 'weak_match',
  suggestedMatch?: string,
  userId?: string
) {
  try {
    await supabase.from('missing_searches' as any).insert({
      search_term: searchTerm,
      normalized_search_term: searchTerm.trim().toLowerCase(),
      result_type: resultType,
      suggested_match: suggestedMatch || null,
      user_id: userId || null,
    });
  } catch {
    // Silent fail
  }
}
