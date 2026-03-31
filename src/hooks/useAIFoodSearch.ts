import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FoodRow } from './useFoods';

export interface AIFoodComponent {
  name: string;
  search_terms: string[];
  is_drink: boolean;
  match: FoodRow | null;
}

export interface AIFoodResult {
  brand: string;
  product_type: string;
  is_drink: boolean;
  is_compound: boolean;
  nevo_search_terms: string[];
  display_message: string;
  matches: FoodRow[];
  components: AIFoodComponent[];
  match_quality: 'exact' | 'alias' | 'weak' | 'none';
  loading: boolean;
  error: string | null;
}

const DEBOUNCE_MS = 600;

async function logSearch(query: string, matched: boolean, matchQuality: string, matchedFoodId?: string, userId?: string) {
  try {
    await supabase.from('search_logs').insert({
      query: query.trim().toLowerCase(),
      matched,
      match_quality: matchQuality,
      matched_food_id: matchedFoodId || null,
      user_id: userId || null,
    } as any);
  } catch {
    // Silent fail
  }
}

async function searchNevo(terms: string[], _isDrink: boolean): Promise<FoodRow | null> {
  for (const term of terms) {
    const results = await searchFoodsUnified(term, 3, 0);
    if (results.length > 0) {
      return results[0];
    }
  }
  return null;
}

async function searchNevoMultiple(terms: string[], isDrink: boolean): Promise<FoodRow[]> {
  for (const term of terms) {
    const { data } = await supabase.rpc(
      isDrink ? 'search_foods_by_type' : 'search_foods_ranked',
      isDrink
        ? { search_query: term, is_drink: true, page_size: 5, page_offset: 0 }
        : { search_query: term, page_size: 5, page_offset: 0 }
    );
    if (data && data.length > 0) {
      return data as FoodRow[];
    }
  }
  return [];
}

function determineMatchQuality(query: string, matches: FoodRow[]): 'exact' | 'alias' | 'weak' | 'none' {
  if (matches.length === 0) return 'none';
  const q = query.trim().toLowerCase();
  const first = matches[0];
  
  if (
    (first.display_name && first.display_name.toLowerCase() === q) ||
    first.name.toLowerCase() === q
  ) return 'exact';
  
  if (
    (first.display_name && first.display_name.toLowerCase().includes(q)) ||
    first.name.toLowerCase().includes(q)
  ) return 'exact';

  return 'alias';
}

export function useAIFoodSearch(query: string, userId?: string) {
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
          logSearch(query, false, 'none', undefined, userId);
          setResult(null);
          setLoading(false);
          return;
        }

        const { brand, product_type, is_drink, is_compound, nevo_search_terms, display_message, components: aiComponents } = aiData;

        let matches: FoodRow[] = [];
        let resolvedComponents: AIFoodComponent[] = [];
        const terms = nevo_search_terms || [product_type];

        if (is_compound && aiComponents && aiComponents.length > 0) {
          // Compound food: first try full query match, then resolve components
          matches = await searchNevoMultiple(terms, is_drink);
          
          // Resolve each component in parallel
          const componentPromises = aiComponents.map(async (comp: any) => {
            const match = await searchNevo(comp.search_terms || [comp.name], comp.is_drink || false);
            return {
              name: comp.name,
              search_terms: comp.search_terms || [comp.name],
              is_drink: comp.is_drink || false,
              match,
            } as AIFoodComponent;
          });
          
          if (cancelled) return;
          resolvedComponents = await Promise.all(componentPromises);
          if (cancelled) return;

          // If no full match found, use component matches as the display results
          if (matches.length === 0) {
            matches = resolvedComponents
              .filter(c => c.match !== null)
              .map(c => c.match!);
          }
        } else {
          // Single product search
          matches = await searchNevoMultiple(terms, is_drink);
          if (cancelled) return;
        }

        const matchQuality = is_compound && resolvedComponents.length > 0
          ? (resolvedComponents.every(c => c.match) ? 'exact' : 'alias')
          : determineMatchQuality(query, matches);
        
        logSearch(
          query,
          matches.length > 0 || resolvedComponents.some(c => c.match),
          matchQuality,
          matches.length > 0 ? matches[0].id : undefined,
          userId
        );

        setResult({
          brand: brand || '',
          product_type,
          is_drink,
          is_compound: is_compound || false,
          nevo_search_terms: terms,
          display_message,
          matches,
          components: resolvedComponents,
          match_quality: matchQuality,
          loading: false,
          error: matches.length === 0 && resolvedComponents.every(c => !c.match) 
            ? 'Geen betrouwbare voedingswaarden gevonden voor dit product.' 
            : null,
        });
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('[AI Food Search] Error:', err);
          logSearch(query, false, 'none', undefined, userId);
          setResult(null);
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, userId]);

  return { result, loading };
}
