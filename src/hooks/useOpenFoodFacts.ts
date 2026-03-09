import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FoodRow } from './useFoods';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 400;

export interface OFFProduct {
  code: string;
  product_name: string;
  brands: string;
  nutriments: Record<string, number | undefined>;
  categories_tags?: string[];
  generic_name?: string;
}

/** Extended FoodRow that tracks whether it was matched to NEVO */
export interface OFFMatchedFood extends FoodRow {
  /** true = nutrition from NEVO, false = no reliable data */
  nevoMatched: boolean;
  /** Original OFF branded name for display */
  offBrandedName: string;
}

function isDrinkProduct(product: OFFProduct): boolean {
  const cats = product.categories_tags || [];
  const name = (product.product_name || '').toLowerCase();
  const brand = (product.brands || '').toLowerCase();
  const combined = `${name} ${brand}`;
  const drinkKeywords = ['drank', 'drink', 'sap', 'juice', 'water', 'melk', 'milk', 'thee', 'tea', 'koffie', 'coffee', 'bier', 'beer', 'wijn', 'wine', 'cola', 'limonade', 'frisdrank', 'soda', 'smoothie', 'fanta', 'sprite', 'pepsi', 'ice tea', 'icetea', 'energy', 'sinaasappelsap', 'appelsap', 'tonic', 'bitter lemon'];
  return cats.some(c => c.includes('beverage') || c.includes('drink') || c.includes('boisson')) ||
    drinkKeywords.some(kw => combined.includes(kw));
}

/**
 * Map of common branded product terms to NEVO generic names.
 * Used as search queries to find the best NEVO match.
 */
const BRAND_TO_GENERIC: Record<string, string> = {
  'pindakaas': 'pindakaas',
  'peanut butter': 'pindakaas',
  'tortilla chips': 'tortillachips',
  'tortillachips': 'tortillachips',
  'nacho': 'tortillachips',
  'cola': 'cola',
  'coca-cola': 'cola',
  'coca cola': 'cola',
  'pepsi': 'cola',
  'fanta': 'frisdrank sinaasappel',
  'sprite': 'frisdrank citroen',
  '7up': 'frisdrank citroen',
  'ice tea': 'ijsthee',
  'ice-tea': 'ijsthee',
  'lipton': 'ijsthee',
  'chocomel': 'chocolademelk',
  'chocolademelk': 'chocolademelk',
  'mayo': 'mayonaise',
  'mayonaise': 'mayonaise',
  'mayonnaise': 'mayonaise',
  'ketchup': 'ketchup',
  'curry': 'currysaus',
  'mosterd': 'mosterd',
  'hagelslag': 'hagelslag',
  'hagel': 'hagelslag',
  'nutella': 'chocoladepasta',
  'jam': 'jam',
  'boter': 'boter',
  'margarine': 'margarine',
  'yoghurt': 'yoghurt',
  'kwark': 'kwark',
  'chips': 'chips',
  'cornflakes': 'cornflakes',
  'muesli': 'muesli',
  'crackers': 'crackers',
  'biscuit': 'biscuit',
  'koek': 'koek',
  'kaas': 'kaas',
  'worst': 'worst',
  'ham': 'ham',
  'tonijn': 'tonijn',
  'zalm': 'zalm',
  'soep': 'soep',
  'noodles': 'noedels',
  'pasta': 'pasta',
  'rijst': 'rijst',
  'brood': 'brood',
  'beschuit': 'beschuit',
  'cracker': 'cracker',
  'roomboter': 'roomboter',
  'halvarine': 'halvarine',
  'leverworst': 'leverworst',
  'filet americain': 'filet americain',
  'hummus': 'hummus',
  'sap': 'vruchtensap',
  'jus': 'vruchtensap',
  'appelsap': 'appelsap',
  'sinaasappelsap': 'sinaasappelsap',
  'tomatensap': 'tomatensap',
  'energy drink': 'energiedrank',
  'red bull': 'energiedrank',
  'monster': 'energiedrank',
};

/**
 * Extract a generic search term from an OFF product for NEVO matching.
 * Uses: generic_name, product_name (without brand), and keyword lookup.
 */
function extractGenericTerms(product: OFFProduct): string[] {
  const terms: string[] = [];
  const brandLower = (product.brands || '').toLowerCase().trim();
  const nameLower = (product.product_name || '').toLowerCase().trim();
  const genericLower = (product.generic_name || '').toLowerCase().trim();

  // 1. Use generic_name if available (e.g. "Pindakaas")
  if (genericLower && genericLower.length > 2) {
    terms.push(genericLower);
  }

  // 2. Product name without brand prefix
  let cleanName = nameLower;
  if (brandLower && cleanName.startsWith(brandLower)) {
    cleanName = cleanName.slice(brandLower.length).trim();
  }
  // Also remove brand anywhere in name
  if (brandLower) {
    cleanName = cleanName.replace(new RegExp(brandLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
  }
  if (cleanName.length > 2) {
    terms.push(cleanName);
  }

  // 3. Check brand-to-generic mapping
  const allText = `${nameLower} ${genericLower}`;
  for (const [keyword, generic] of Object.entries(BRAND_TO_GENERIC)) {
    if (allText.includes(keyword)) {
      terms.push(generic);
    }
  }

  // 4. Use brand itself as last resort (e.g. "Nesquik" might match in NEVO aliases)
  if (brandLower && brandLower.length > 2) {
    terms.push(brandLower);
  }

  // Deduplicate
  return [...new Set(terms)];
}

/**
 * Try to find a NEVO match for an OFF product.
 * Returns the best-matching FoodRow or null.
 */
async function findNevoMatch(product: OFFProduct, isDrink: boolean): Promise<FoodRow | null> {
  const terms = extractGenericTerms(product);
  
  for (const term of terms) {
    const { data } = await supabase.rpc(
      isDrink ? 'search_foods_by_type' : 'search_foods_ranked',
      isDrink
        ? { search_query: term, is_drink: true, page_size: 3, page_offset: 0 }
        : { search_query: term, page_size: 3, page_offset: 0 }
    );
    if (data && data.length > 0) {
      return data[0] as FoodRow;
    }
  }
  return null;
}

function buildBrandedName(product: OFFProduct): string {
  const brand = product.brands ? product.brands.split(',')[0].trim() : '';
  const name = product.product_name || 'Onbekend';
  return brand ? `${name} (${brand})` : name;
}

export function useOFFSearch(search: string, filterDrinks?: boolean) {
  const [products, setProducts] = useState<OFFMatchedFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setProducts([]);
      setLoading(false);
      setHasMore(false);
      setNoResults(false);
      return;
    }

    setLoading(true);
    setNoResults(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    let cancelled = false;

    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          search_terms: search.trim(),
          search_simple: '1',
          action: 'process',
          json: '1',
          page_size: String(PAGE_SIZE),
          page: String(page),
          fields: 'code,product_name,brands,nutriments,categories_tags,generic_name',
          lc: 'nl',
        });

        const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`);
        const data = await res.json();
        if (cancelled) return;

        const rawProducts = (data.products || []) as OFFProduct[];

        // Filter: must have a name
        let filtered = rawProducts.filter(p => p.product_name && p.product_name.trim() !== '');

        // Optionally filter by drink/food category
        if (filterDrinks === true) {
          filtered = filtered.filter(p => isDrinkProduct(p));
        } else if (filterDrinks === false) {
          filtered = filtered.filter(p => !isDrinkProduct(p));
        }

        // Deduplicate by product name + brand
        const seen = new Set<string>();
        filtered = filtered.filter(p => {
          const key = `${(p.product_name || '').toLowerCase()}-${(p.brands || '').toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // For each product, try to find a NEVO match
        const matched = await Promise.all(
          filtered.slice(0, 10).map(async (product): Promise<OFFMatchedFood> => {
            const isDrink = isDrinkProduct(product);
            const nevoMatch = await findNevoMatch(product, isDrink);
            const brandedName = buildBrandedName(product);

            if (nevoMatch) {
              // Use NEVO nutrition + branded display name
              return {
                ...nevoMatch,
                id: `off-${product.code}`,
                display_name: brandedName,
                nevoMatched: true,
                offBrandedName: brandedName,
              };
            } else {
              // No NEVO match — show but mark as unusable
              return {
                id: `off-${product.code}`,
                name: brandedName,
                display_name: brandedName,
                category: isDrink ? 'dranken' : 'supermarkt',
                portion_description: 'per 100g',
                portion_grams: 100,
                potassium_mg: 0,
                phosphate_mg: 0,
                sodium_mg: 0,
                protein_g: 0,
                fluid_ml: 0,
                dialysis_risk_label: 'onbekend',
                nevoMatched: false,
                offBrandedName: brandedName,
              };
            }
          })
        );

        if (cancelled) return;

        if (page === 1) {
          setProducts(matched);
          setNoResults(matched.length === 0);
        } else {
          setProducts(prev => {
            const combined = [...prev, ...matched];
            setNoResults(combined.length === 0);
            return combined;
          });
        }
        setHasMore(rawProducts.length === PAGE_SIZE);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('[OFF] API error:', err);
          setLoading(false);
          setNoResults(true);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, page, filterDrinks]);

  const loadMore = () => setPage(p => p + 1);

  return { products, loading, hasMore, loadMore, noResults };
}
