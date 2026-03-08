import { useState } from 'react';

export interface OpenFoodFactsProduct {
  barcode: string;
  name: string;
  brand: string;
  image_url?: string;
  nutriments: {
    potassium_mg: number | null;
    phosphorus_mg: number | null;
    sodium_mg: number | null;
    proteins_g: number | null;
    water_ml: number | null;
  };
  isComplete: boolean;
  missingFields: string[];
}

const NUTRIENT_LABELS: Record<string, string> = {
  potassium_mg: 'Kalium',
  phosphorus_mg: 'Fosfaat',
  sodium_mg: 'Natrium',
  proteins_g: 'Eiwit',
  water_ml: 'Vocht',
};

export function useOpenFoodFactsLookup() {
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<OpenFoodFactsProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (barcode: string) => {
    setLoading(true);
    setError(null);
    setProduct(null);

    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,brands,image_front_url,nutriments`);
      const json = await res.json();

      if (json.status !== 1 || !json.product) {
        setError('Geen product gevonden voor deze barcode.');
        setLoading(false);
        return null;
      }

      const p = json.product;
      const n = p.nutriments || {};

      const potassium_mg = parseNutrient(n['potassium_100g'], n['potassium_unit']);
      const phosphorus_mg = parseNutrient(n['phosphorus_100g'], n['phosphorus_unit']);
      const sodium_mg = parseNutrient(n['sodium_100g'], n['sodium_unit']);
      const proteins_g = n['proteins_100g'] != null ? Number(n['proteins_100g']) : null;
      // Water: OFF doesn't always have water; try to estimate from moisture or use null
      const water_ml = n['water_100g'] != null ? Number(n['water_100g']) : null;

      const nutriments = { potassium_mg, phosphorus_mg, sodium_mg, proteins_g, water_ml };

      const missingFields: string[] = [];
      if (potassium_mg == null) missingFields.push(NUTRIENT_LABELS.potassium_mg);
      if (phosphorus_mg == null) missingFields.push(NUTRIENT_LABELS.phosphorus_mg);
      if (sodium_mg == null) missingFields.push(NUTRIENT_LABELS.sodium_mg);
      if (proteins_g == null) missingFields.push(NUTRIENT_LABELS.proteins_g);
      if (water_ml == null) missingFields.push(NUTRIENT_LABELS.water_ml);

      const result: OpenFoodFactsProduct = {
        barcode,
        name: p.product_name || 'Onbekend product',
        brand: p.brands || '',
        image_url: p.image_front_url || undefined,
        nutriments,
        isComplete: missingFields.length === 0,
        missingFields,
      };

      setProduct(result);
      setLoading(false);
      return result;
    } catch {
      setError('Kon product niet opzoeken. Controleer uw internetverbinding.');
      setLoading(false);
      return null;
    }
  };

  const reset = () => {
    setProduct(null);
    setError(null);
  };

  return { lookup, product, loading, error, reset };
}

function parseNutrient(value: unknown, unit?: string): number | null {
  if (value == null || value === '') return null;
  let num = Number(value);
  if (isNaN(num)) return null;
  // Convert to mg if given in g
  if (unit === 'g') num *= 1000;
  return Math.round(num * 100) / 100;
}
