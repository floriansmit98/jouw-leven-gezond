import { useState, useEffect } from 'react';
import type { FoodRow } from './useFoods';

const PAGE_SIZE = 10;

export interface OFFProduct {
  code: string;
  product_name: string;
  brands: string;
  nutriments: {
    sodium_100g?: number;
    'sodium_value'?: number;
    proteins_100g?: number;
    'proteins_value'?: number;
    potassium_100g?: number;
    'potassium_value'?: number;
    phosphorus_100g?: number;
    'phosphorus_value'?: number;
    // water is rarely available in OFF
  };
  categories_tags?: string[];
  image_small_url?: string;
}

function isDrinkProduct(product: OFFProduct): boolean {
  const cats = product.categories_tags || [];
  const name = (product.product_name || '').toLowerCase();
  const drinkKeywords = ['drank', 'drink', 'sap', 'juice', 'water', 'melk', 'milk', 'thee', 'tea', 'koffie', 'coffee', 'bier', 'beer', 'wijn', 'wine', 'cola', 'limonade', 'frisdrank', 'soda', 'smoothie'];
  return cats.some(c => c.includes('beverage') || c.includes('drink') || c.includes('boisson')) ||
    drinkKeywords.some(kw => name.includes(kw));
}

function offToFoodRow(product: OFFProduct): FoodRow {
  const n = product.nutriments || {};
  // OFF reports sodium in g per 100g, we need mg
  const sodiumG = n.sodium_100g ?? n.sodium_value ?? 0;
  const sodiumMg = sodiumG < 10 ? Math.round(sodiumG * 1000) : Math.round(sodiumG);

  const potassiumG = n.potassium_100g ?? n.potassium_value ?? 0;
  const potassiumMg = potassiumG < 10 ? Math.round(potassiumG * 1000) : Math.round(potassiumG);

  const phosphorusG = n.phosphorus_100g ?? n.phosphorus_value ?? 0;
  const phosphorusMg = phosphorusG < 10 ? Math.round(phosphorusG * 1000) : Math.round(phosphorusG);

  const proteinG = n.proteins_100g ?? n.proteins_value ?? 0;

  const brand = product.brands ? ` (${product.brands})` : '';

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

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setProducts([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      search_terms: search.trim(),
      json: '1',
      page_size: String(PAGE_SIZE),
      page: String(page),
      fields: 'code,product_name,brands,nutriments,categories_tags',
      countries_tags_en: 'netherlands',
    });

    fetch(`https://nl.openfoodfacts.org/cgi/search.pl?${params}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        const rawProducts = (data.products || []) as OFFProduct[];

        // Filter out products without a name
        let filtered = rawProducts.filter(p => p.product_name && p.product_name.trim() !== '');

        // Filter by drink/food if specified
        if (filterDrinks === true) {
          filtered = filtered.filter(p => isDrinkProduct(p));
        } else if (filterDrinks === false) {
          filtered = filtered.filter(p => !isDrinkProduct(p));
        }

        const rows = filtered.map(offToFoodRow);

        if (page === 1) {
          setProducts(rows);
        } else {
          setProducts(prev => [...prev, ...rows]);
        }
        setHasMore(rawProducts.length === PAGE_SIZE);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [search, page, filterDrinks]);

  const loadMore = () => setPage(p => p + 1);

  return { products, loading, hasMore, loadMore };
}
