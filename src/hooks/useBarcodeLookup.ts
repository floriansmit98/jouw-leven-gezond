import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FoodRow } from './useFoods';
import { foodDisplayName } from './useFoods';

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
      // Step 1: Look up barcode in Open Food Facts to get product info
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,generic_name,brands,categories_tags,image_front_url`
      );
      const json = await res.json();

      if (json.status !== 1 || !json.product) {
        setError('Geen product gevonden voor deze barcode.');
        setLoading(false);
        return null;
      }

      const p = json.product;
      const offName = p.product_name || '';
      const offBrand = p.brands || '';
      const genericName = p.generic_name || '';
      const categoryTags: string[] = p.categories_tags || [];

      if (!offName.trim() && !genericName.trim()) {
        setError('Product herkend maar geen naam beschikbaar.');
        setLoading(false);
        return null;
      }

      // Step 2: Search NEVO database using multiple strategies
      const searchTerms = buildSearchTerms(offName, offBrand, genericName, categoryTags);
      let nevoMatch: FoodRow | null = null;

      for (const term of searchTerms) {
        if (!term.trim()) continue;
        // Try unified search first (includes branded_products), then ranked
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

      const barcodeResult: BarcodeResult = {
        barcode,
        offName,
        offBrand,
        imageUrl: p.image_front_url || undefined,
        nevoMatch,
        isUsable: nevoMatch !== null,
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

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { lookup, result, loading, error, reset };
}

/**
 * Build an array of search terms to try against NEVO, from most specific to least.
 * E.g. "Stroopwafel" from brand "Lotus" → ["Stroopwafel Lotus", "Stroopwafel", "stroopwafel"]
 */
function buildSearchTerms(name: string, brand: string): string[] {
  const terms: string[] = [];
  const cleanName = name.replace(/[®™©]/g, '').trim();

  // Try full name + brand
  if (brand) {
    terms.push(`${cleanName} ${brand.split(',')[0].trim()}`);
  }
  // Try just the product name
  terms.push(cleanName);
  // Try first word only (for compound products like "Stroopwafel original")
  const firstWord = cleanName.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 3 && firstWord !== cleanName) {
    terms.push(firstWord);
  }
  return terms;
}
