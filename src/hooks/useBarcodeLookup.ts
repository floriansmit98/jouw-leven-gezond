import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FoodRow } from './useFoods';

export interface BarcodeResult {
  barcode: string;
  /** Product name from Open Food Facts */
  offName: string;
  /** Brand from Open Food Facts */
  offBrand: string;
  /** Product image from Open Food Facts */
  imageUrl?: string;
  /** Matched NEVO food (if found) */
  nevoMatch: FoodRow | null;
  /** Whether we have a usable match with complete nutrition */
  isUsable: boolean;
  /** Whether the product was found in OFF at all */
  productFound: boolean;
  /** Whether the match came from a saved barcode mapping */
  fromMapping: boolean;
  /** Search suggestions based on product name (for no-match / incomplete cases) */
  searchSuggestions: FoodRow[];
}

export function useBarcodeLookup() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BarcodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (barcode: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Step 0: Check saved barcode mappings first
      const { data: mapping } = await supabase
        .from('barcode_mappings')
        .select('food_id, product_name, brand')
        .eq('barcode', barcode)
        .maybeSingle();

      if (mapping) {
        // Fetch the full food row
        const { data: foodData } = await supabase
          .from('foods')
          .select('*')
          .eq('id', mapping.food_id)
          .single();

        if (foodData) {
          const barcodeResult: BarcodeResult = {
            barcode,
            offName: mapping.product_name || foodData.display_name || foodData.name,
            offBrand: mapping.brand || '',
            nevoMatch: foodData as FoodRow,
            isUsable: true,
            productFound: true,
            fromMapping: true,
            searchSuggestions: [],
          };
          setResult(barcodeResult);
          setLoading(false);
          return barcodeResult;
        }
      }

      // Step 1: Look up barcode in Open Food Facts
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,generic_name,brands,categories_tags,image_front_url`
      );
      const json = await res.json();

      if (json.status !== 1 || !json.product) {
        // Outcome 3: Barcode not found at all
        const barcodeResult: BarcodeResult = {
          barcode,
          offName: '',
          offBrand: '',
          nevoMatch: null,
          isUsable: false,
          productFound: false,
          fromMapping: false,
          searchSuggestions: [],
        };
        setResult(barcodeResult);
        setLoading(false);
        return barcodeResult;
      }

      const p = json.product;
      const offName = p.product_name || '';
      const offBrand = p.brands || '';
      const genericName = p.generic_name || '';
      const categoryTags: string[] = p.categories_tags || [];

      if (!offName.trim() && !genericName.trim()) {
        const barcodeResult: BarcodeResult = {
          barcode,
          offName: '',
          offBrand: offBrand,
          imageUrl: p.image_front_url || undefined,
          nevoMatch: null,
          isUsable: false,
          productFound: false,
          fromMapping: false,
          searchSuggestions: [],
        };
        setResult(barcodeResult);
        setLoading(false);
        return barcodeResult;
      }

      // Step 2: Search NEVO database
      const searchTerms = buildSearchTerms(offName, offBrand, genericName, categoryTags);
      let nevoMatch: FoodRow | null = null;

      for (const term of searchTerms) {
        if (!term.trim()) continue;
        const { data } = await supabase.rpc('search_foods_ranked', {
          search_query: term,
          page_size: 5,
          page_offset: 0,
        });
        if (data && data.length > 0) {
          nevoMatch = data[0] as FoodRow;
          break;
        }
      }

      // Step 3: Get search suggestions for fallback UI
      // Check if the match has incomplete dialysis-relevant nutrients
      // Consider incomplete if ANY key nutrient (potassium, phosphate, sodium) is missing (0)
      const hasIncompleteNutrition = nevoMatch
        ? (nevoMatch.potassium_mg === 0 || nevoMatch.phosphate_mg === 0 || nevoMatch.sodium_mg === 0)
        : true;

      let searchSuggestions: FoodRow[] = [];
      if (!nevoMatch || hasIncompleteNutrition) {
        // Try broader search for suggestions
        const mainTerm = genericName.trim() || offName.trim();
        if (mainTerm) {
          const { data } = await supabase.rpc('search_foods_ranked', {
            search_query: mainTerm.split(/\s+/).slice(0, 2).join(' '),
            page_size: 8,
            page_offset: 0,
          });
          searchSuggestions = (data ?? []) as FoodRow[];
        }
        // If still no suggestions, try individual words
        if (searchSuggestions.length === 0) {
          const words = offName.split(/\s+/).filter(w => w.length >= 3);
          for (const word of words.slice(0, 3)) {
            const { data } = await supabase.rpc('search_foods_ranked', {
              search_query: word,
              page_size: 4,
              page_offset: 0,
            });
            if (data && data.length > 0) {
              searchSuggestions = [...searchSuggestions, ...(data as FoodRow[])];
            }
          }
          // Deduplicate
          const seen = new Set<string>();
          searchSuggestions = searchSuggestions.filter(f => {
            if (seen.has(f.id)) return false;
            seen.add(f.id);
            return true;
          }).slice(0, 8);
        }
      }

      const barcodeResult: BarcodeResult = {
        barcode,
        offName,
        offBrand,
        imageUrl: p.image_front_url || undefined,
        nevoMatch,
        isUsable: nevoMatch !== null && !hasIncompleteNutrition,
        productFound: true,
        fromMapping: false,
        searchSuggestions,
      };

      setResult(barcodeResult);
      setLoading(false);
      return barcodeResult;
    } catch {
      setError('Kon product niet opzoeken. Controleer uw internetverbinding.');
      setLoading(false);
      return null;
    }
  };

  const saveMapping = async (barcode: string, foodId: string, productName?: string, brand?: string) => {
    const { error } = await supabase.from('barcode_mappings').upsert(
      {
        barcode,
        food_id: foodId,
        product_name: productName || null,
        brand: brand || null,
      },
      { onConflict: 'barcode' }
    );
    return !error;
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { lookup, result, loading, error, reset, saveMapping };
}

/**
 * Build an array of search terms to try against NEVO, from most specific to least.
 */
function buildSearchTerms(name: string, brand: string, genericName: string, categoryTags: string[]): string[] {
  const terms: string[] = [];
  const cleanName = name.replace(/[®™©]/g, '').trim();

  if (brand) {
    terms.push(`${cleanName} ${brand.split(',')[0].trim()}`);
  }
  if (cleanName) terms.push(cleanName);

  const cleanGeneric = genericName.replace(/[®™©]/g, '').trim();
  if (cleanGeneric && cleanGeneric !== cleanName) {
    terms.push(cleanGeneric);
  }

  const STOP_WORDS = new Set(['de', 'het', 'een', 'van', 'met', 'en', 'in', 'op', 'voor', 'uit', 'bij', 'tot', 'aan', 'om', 'als', 'maar', 'dan', 'nog', 'wel', 'niet', 'al', 'er', 'die', 'dat', 'dit', 'was', 'is', 'are', 'the', 'and', 'or', 'with', 'from', 'pure', 'original', 'naturel', 'light', 'bio', 'organic']);
  const words = cleanName.split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));
  
  for (const word of words) {
    if (word !== cleanName && word !== cleanGeneric) {
      terms.push(word);
    }
  }

  for (const tag of categoryTags) {
    const match = tag.match(/^(?:nl|en):(.+)$/);
    if (match) {
      const catName = match[1].replace(/-/g, ' ');
      if (catName.length >= 3 && !terms.includes(catName)) {
        terms.push(catName);
      }
    }
  }

  return terms;
}
