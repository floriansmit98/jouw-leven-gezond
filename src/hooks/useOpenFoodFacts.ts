import { useState, useEffect, useRef } from 'react';
import type { FoodRow } from './useFoods';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 400;

export interface OFFProduct {
  code: string;
  product_name: string;
  brands: string;
  nutriments: Record<string, number | undefined>;
  categories_tags?: string[];
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

function offToFoodRow(product: OFFProduct): FoodRow {
  const n = product.nutriments || {};

  const toMg = (valG: number | undefined): number => {
    if (valG === undefined || valG === null) return 0;
    // OFF stores in g; if < 10 it's grams, convert to mg
    return valG < 10 ? Math.round(valG * 1000) : Math.round(valG);
  };

  const sodiumMg = toMg(n.sodium_100g ?? n.sodium_value);
  const potassiumMg = toMg(n.potassium_100g ?? n.potassium_value);
  const phosphorusMg = toMg(n.phosphorus_100g ?? n.phosphorus_value);
  const proteinG = n.proteins_100g ?? n.proteins_value ?? 0;

  const brand = product.brands ? ` (${product.brands.split(',')[0].trim()})` : '';

  return {
    id: `off-${product.code}`,
    name: `${product.product_name || 'Onbekend'}${brand}`,
    category: isDrinkProduct(product) ? 'dranken' : 'supermarkt',
    portion_description: 'per 100g',
    portion_grams: 100,
    potassium_mg: potassiumMg,
    phosphate_mg: phosphorusMg,
    sodium_mg: sodiumMg,
    protein_g: Math.round(proteinG * 10) / 10,
    fluid_ml: 0,
    dialysis_risk_label: potassiumMg > 300 ? 'hoog' : potassiumMg > 150 ? 'gemiddeld' : 'laag',
  };
}

export function useOFFSearch(search: string, filterDrinks?: boolean) {
  const [products, setProducts] = useState<FoodRow[]>([]);
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

    // Show loading immediately but debounce the actual fetch
    setLoading(true);
    setNoResults(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    let cancelled = false;

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams({
        search_terms: search.trim(),
        search_simple: '1',
        action: 'process',
        json: '1',
        page_size: String(PAGE_SIZE),
        page: String(page),
        fields: 'code,product_name,brands,nutriments,categories_tags',
        lc: 'nl',
      });

      fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`)
        .then(res => res.json())
        .then(data => {
          if (cancelled) return;
          console.log('[OFF] Search results for:', search, '→', data.count, 'total,', (data.products || []).length, 'on page');
          const rawProducts = (data.products || []) as OFFProduct[];

          // Only filter out products without a name
          let filtered = rawProducts.filter(p => p.product_name && p.product_name.trim() !== '');

          // Optionally filter by drink/food category
          if (filterDrinks === true) {
            filtered = filtered.filter(p => isDrinkProduct(p));
          } else if (filterDrinks === false) {
            filtered = filtered.filter(p => !isDrinkProduct(p));
          }

          const rows = filtered.map(offToFoodRow);

          if (page === 1) {
            setProducts(rows);
            setNoResults(rows.length === 0);
          } else {
            setProducts(prev => {
              const combined = [...prev, ...rows];
              setNoResults(combined.length === 0);
              return combined;
            });
          }
          setHasMore(rawProducts.length === PAGE_SIZE);
          setLoading(false);
        })
        .catch((err) => {
          if (!cancelled) {
            console.error('[OFF] API error:', err);
            setLoading(false);
            setNoResults(true);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, page, filterDrinks]);

  const loadMore = () => setPage(p => p + 1);

  return { products, loading, hasMore, loadMore, noResults };
}
