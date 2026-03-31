import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { searchFoodsUnified, type FoodRow } from './useFoods';

export interface MealPatternMatch {
  patternId: string;
  patternName: string;
  components: {
    name: string;
    food: FoodRow | null;
    defaultGrams: number;
  }[];
}

const DEBOUNCE_MS = 300;

/**
 * Matches a search query against the meal_patterns table.
 * If a pattern matches, resolves each food_component to an actual food record.
 */
export function useMealPatterns(query: string) {
  const [match, setMatch] = useState<MealPatternMatch | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 3) {
      setMatch(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        // Split query into words for flexible matching
        const words = trimmed.split(/\s+/).filter(w => w.length > 0);

        // Fetch all patterns (small table, cached client-side)
        const { data: patterns, error } = await supabase
          .from('meal_patterns' as any)
          .select('*');

        if (cancelled || error || !patterns) {
          if (!cancelled) setLoading(false);
          return;
        }

        // Score each pattern by how many query words match
        type ScoredPattern = {
          pattern: any;
          score: number;
        };

        const scored: ScoredPattern[] = (patterns as any[]).map(p => {
          const name = (p.normalized_pattern || p.pattern_name || '').toLowerCase();
          const patternWords = name.split(/\s+/);

          // Exact match
          if (name === trimmed) return { pattern: p, score: 1000 };

          // Count how many query words appear in pattern name
          let matchedQueryWords = 0;
          for (const qw of words) {
            if (patternWords.some((pw: string) => pw.includes(qw) || qw.includes(pw))) {
              matchedQueryWords++;
            }
          }

          // Also count how many pattern words appear in query
          let matchedPatternWords = 0;
          for (const pw of patternWords) {
            if (words.some(qw => qw.includes(pw) || pw.includes(qw))) {
              matchedPatternWords++;
            }
          }

          // Only match if ALL query words match something in pattern
          if (matchedQueryWords < words.length) return { pattern: p, score: 0 };

          // Score: bonus for matching more words from both sides
          const score = matchedQueryWords * 100 + matchedPatternWords * 50;
          return { pattern: p, score };
        });

        // Find best match
        const best = scored
          .filter(s => s.score > 0)
          .sort((a, b) => b.score - a.score)[0];

        if (!best || cancelled) {
          if (!cancelled) { setMatch(null); setLoading(false); }
          return;
        }

        const pattern = best.pattern;
        const foodComponents: string[] = pattern.food_components || [];
        const defaultPortions: number[] = pattern.default_portions || [];

        // Resolve each component to a food record
        const resolvedComponents = await Promise.all(
          foodComponents.map(async (componentName: string, idx: number) => {
            const results = await searchFoodsUnified(componentName, 1, 0);

            return {
              name: componentName,
              food: results.length > 0 ? results[0] : null,
              defaultGrams: defaultPortions[idx] || 100,
            };
          })
        );

        if (cancelled) return;

        setMatch({
          patternId: pattern.id,
          patternName: pattern.pattern_name,
          components: resolvedComponents,
        });
        setLoading(false);
      } catch (err) {
        console.error('[MealPatterns] Error:', err);
        if (!cancelled) { setMatch(null); setLoading(false); }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { match, loading };
}
