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
 * Uses product name, generic name, and OFF category tags for better matching.
 */
function buildSearchTerms(name: string, brand: string, genericName: string, categoryTags: string[]): string[] {
  const terms: string[] = [];
  const cleanName = name.replace(/[®™©]/g, '').trim();

  // Try full name + brand
  if (brand) {
    terms.push(`${cleanName} ${brand.split(',')[0].trim()}`);
  }
  // Try just the product name
  if (cleanName) terms.push(cleanName);

  // Try generic name from OFF (e.g. "Stroopwafels" instead of "AH Stroopwafels roomboter")
  const cleanGeneric = genericName.replace(/[®™©]/g, '').trim();
  if (cleanGeneric && cleanGeneric !== cleanName) {
    terms.push(cleanGeneric);
  }

  // Try individual meaningful words from the product name (skip short/common words)
  const STOP_WORDS = new Set(['de', 'het', 'een', 'van', 'met', 'en', 'in', 'op', 'voor', 'uit', 'bij', 'tot', 'aan', 'om', 'als', 'maar', 'dan', 'nog', 'wel', 'niet', 'al', 'er', 'die', 'dat', 'dit', 'was', 'is', 'are', 'the', 'and', 'or', 'with', 'from', 'pure', 'original', 'naturel', 'light', 'bio', 'organic']);
  const words = cleanName.split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));
  
  // Try each significant word individually
  for (const word of words) {
    if (word !== cleanName && word !== cleanGeneric) {
      terms.push(word);
    }
  }

  // Extract Dutch food names from OFF category tags (e.g. "en:stroopwafels" → "stroopwafels")
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
