import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type NutritionSource = 'exact' | 'estimated' | 'unknown' | 'needs_estimation';

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
  nutrition_source: NutritionSource;
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

/** Estimate nutrients for a product with missing values using median of similar products */
async function estimateNutrients(
  category: string,
  displayName: string
): Promise<{ potassium_mg: number; phosphate_mg: number; sodium_mg: number; protein_g: number; fluid_ml: number; nutrition_source: NutritionSource }> {
  try {
    const { data, error } = await supabase.rpc('estimate_nutrients', {
      p_category: category,
      p_display_name: displayName,
    });
    if (error || !data || data.length === 0) {
      return { potassium_mg: 0, phosphate_mg: 0, sodium_mg: 0, protein_g: 0, fluid_ml: 0, nutrition_source: 'unknown' };
    }
    const est = (data as any[])[0];
    if (est.nutrition_source === 'estimated') {
      return {
        potassium_mg: Math.round(est.est_potassium_mg ?? 0),
        phosphate_mg: Math.round(est.est_phosphate_mg ?? 0),
        sodium_mg: Math.round(est.est_sodium_mg ?? 0),
        protein_g: Math.round((est.est_protein_g ?? 0) * 10) / 10,
        fluid_ml: Math.round(est.est_fluid_ml ?? 0),
        nutrition_source: 'estimated',
      };
    }
    return { potassium_mg: 0, phosphate_mg: 0, sodium_mg: 0, protein_g: 0, fluid_ml: 0, nutrition_source: 'unknown' };
  } catch {
    return { potassium_mg: 0, phosphate_mg: 0, sodium_mg: 0, protein_g: 0, fluid_ml: 0, nutrition_source: 'unknown' };
  }
}

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
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Unified search error:', error);
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as UnifiedSearchResult[];
        console.log('[UnifiedSearch] Raw results:', rows.length, 'for query:', trimmed);

        // Show results immediately, then enrich in background
        const initial = rows.map(row => ({
          ...row,
          nutrition_source: (row.nutrition_source || 'exact') as NutritionSource,
        }));

        if (page === 0) {
          setResults(initial);
        } else {
          setResults(prev => [...prev, ...initial]);
        }
        setHasMore(initial.length === PAGE_SIZE);
        setLoading(false);

        // Enrich items that need estimation (non-blocking)
        const needsEstimation = initial.filter(r => r.nutrition_source === 'needs_estimation');
        if (needsEstimation.length > 0) {
          try {
            const estimates = await Promise.all(
              needsEstimation.map(async (row) => {
                const est = await estimateNutrients(row.category, row.display_name);
                return { result_id: row.result_id, ...est };
              })
            );
            if (cancelled) return;
            setResults(prev => prev.map(r => {
              const est = estimates.find(e => e.result_id === r.result_id);
              if (est) {
                return { ...r, potassium_mg: est.potassium_mg, phosphate_mg: est.phosphate_mg, sodium_mg: est.sodium_mg, protein_g: est.protein_g, fluid_ml: est.fluid_ml, nutrition_source: est.nutrition_source };
              }
              return r;
            }));
          } catch (e) {
            console.warn('[UnifiedSearch] Estimation failed, showing results without estimates:', e);
          }
        }
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
