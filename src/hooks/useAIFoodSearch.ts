import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FoodRow } from './useFoods';

export interface AIFoodResult {
  brand: string;
  product_type: string;
  is_drink: boolean;
  nevo_search_terms: string[];
  display_message: string;
  matches: FoodRow[];
  loading: boolean;
  error: string | null;
}

const DEBOUNCE_MS = 600;

export function useAIFoodSearch(query: string) {
  const [result, setResult] = useState<AIFoodResult | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (query.trim().length < 3) {
      setResult(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    let cancelled = false;

    debounceRef.current = setTimeout(async () => {
      try {
        // Step 1: AI interpretation
        const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-food-search', {
          body: { query: query.trim() },
        });

        if (cancelled) return;

        if (aiError || aiData?.error) {
          setResult(null);
          setLoading(false);
          return;
        }

        const { brand, product_type, is_drink, nevo_search_terms, display_message } = aiData;

        // Step 2: Search NEVO with each term until we find results
        let matches: FoodRow[] = [];
        const terms = nevo_search_terms || [product_type];

        for (const term of terms) {
          const { data } = await supabase.rpc(
            is_drink ? 'search_foods_by_type' : 'search_foods_ranked',
            is_drink
              ? { search_query: term, is_drink: true, page_size: 5, page_offset: 0 }
              : { search_query: term, page_size: 5, page_offset: 0 }
          );
          if (cancelled) return;
          if (data && data.length > 0) {
            matches = data as FoodRow[];
            break;
          }
        }

        if (cancelled) return;

        setResult({
          brand: brand || '',
          product_type,
          is_drink,
          nevo_search_terms: terms,
          display_message,
          matches,
          loading: false,
          error: matches.length === 0 ? 'Geen betrouwbare voedingswaarden gevonden voor dit product.' : null,
        });
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('[AI Food Search] Error:', err);
          setResult(null);
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return { result, loading };
}
