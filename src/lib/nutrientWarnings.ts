import type { FoodRow } from '@/hooks/useFoods';
import { getLimits, type DailyLimits } from '@/lib/store';

export type RiskLevel = 'laag' | 'letop' | 'hoog';

export interface NutrientWarning {
  nutrient: string;
  label: string;
  level: RiskLevel;
  message: string;
}

/**
 * Per-portion thresholds for dialysis patients.
 * "per portion" means per the food's portion_grams (or per 100g if no portion).
 * These are conservative clinical thresholds.
 */
const PORTION_THRESHOLDS = {
  potassium:  { letop: 150, hoog: 300 },  // mg per portion
  phosphate:  { letop: 100, hoog: 200 },  // mg per portion
  sodium:     { letop: 200, hoog: 400 },  // mg per portion
  fluid:      { letop: 150, hoog: 300 },  // ml per portion
  protein:    { letop: 10,  hoog: 20  },  // g per portion (high = good info, not danger)
};

/** Classify a single nutrient value against thresholds */
function classify(value: number, thresholds: { letop: number; hoog: number }): RiskLevel {
  if (value >= thresholds.hoog) return 'hoog';
  if (value >= thresholds.letop) return 'letop';
  return 'laag';
}

/**
 * Analyze a single food item and return per-nutrient warnings.
 * Values are scaled to the given amount in grams.
 */
export function analyzeFoodWarnings(food: FoodRow, amountGrams: number): NutrientWarning[] {
  const factor = amountGrams / 100;
  const warnings: NutrientWarning[] = [];

  const nutrients: {
    key: keyof typeof PORTION_THRESHOLDS;
    nutrient: string;
    label: string;
    value: number;
    messages: Record<RiskLevel, string>;
  }[] = [
    {
      key: 'potassium',
      nutrient: 'kalium',
      label: 'Kalium',
      value: food.potassium_mg * factor,
      messages: {
        hoog: 'Dit product bevat relatief veel kalium. Past minder goed binnen een kaliumbeperkt dieet.',
        letop: 'Dit product bevat een matige hoeveelheid kalium.',
        laag: '',
      },
    },
    {
      key: 'phosphate',
      nutrient: 'fosfaat',
      label: 'Fosfaat',
      value: food.phosphate_mg * factor,
      messages: {
        hoog: 'Dit product bevat relatief veel fosfaat.',
        letop: 'Dit product bevat een matige hoeveelheid fosfaat.',
        laag: '',
      },
    },
    {
      key: 'sodium',
      nutrient: 'natrium',
      label: 'Natrium',
      value: food.sodium_mg * factor,
      messages: {
        hoog: 'Dit product bevat relatief veel natrium (zout).',
        letop: 'Dit product bevat een matige hoeveelheid natrium.',
        laag: '',
      },
    },
    {
      key: 'fluid',
      nutrient: 'vocht',
      label: 'Vocht',
      value: food.fluid_ml * factor,
      messages: {
        hoog: 'Let op met dit product bij vochtbeperking.',
        letop: 'Dit product bevat een behoorlijke hoeveelheid vocht.',
        laag: '',
      },
    },
    {
      key: 'protein',
      nutrient: 'eiwit',
      label: 'Eiwit',
      value: food.protein_g * factor,
      messages: {
        hoog: 'Dit product is eiwitrijk — goed voor uw eiwitdoel.',
        letop: 'Dit product bevat een matige hoeveelheid eiwit.',
        laag: '',
      },
    },
  ];

  for (const n of nutrients) {
    const level = classify(n.value, PORTION_THRESHOLDS[n.key]);
    if (level !== 'laag') {
      warnings.push({
        nutrient: n.nutrient,
        label: level === 'hoog'
          ? (n.key === 'protein' ? 'Eiwitrijk' : `Hoog in ${n.nutrient}`)
          : (n.key === 'protein' ? 'Matig eiwit' : `Let op ${n.nutrient}`),
        level,
        message: n.messages[level],
      });
    }
  }

  return warnings;
}

/** Daily total thresholds as percentage of limit */
const DAILY_THRESHOLDS = { letop: 0.7, hoog: 0.9 };

export interface DailyWarning {
  level: RiskLevel;
  title: string;
  subtitle: string;
  message: string;
}

/**
 * Analyze daily totals against user limits and return combined warnings.
 */
export function analyzeDailyWarnings(totals: {
  potassium: number;
  phosphate: number;
  sodium: number;
  protein: number;
  fluid: number;
}, limits?: DailyLimits): DailyWarning[] {
  const l = limits || getLimits();
  const warnings: DailyWarning[] = [];

  const LABELS: Record<string, string> = {
    kalium: 'Kalium',
    fosfaat: 'Fosfaat',
    natrium: 'Natrium',
    vocht: 'Vocht',
  };

  const checks: { name: string; current: number; limit: number }[] = [
    { name: 'kalium', current: totals.potassium, limit: l.potassium },
    { name: 'fosfaat', current: totals.phosphate, limit: l.phosphate },
    { name: 'natrium', current: totals.sodium, limit: l.sodium },
    { name: 'vocht', current: totals.fluid, limit: l.fluid },
  ];

  for (const c of checks) {
    const ratio = c.current / c.limit;
    const pct = `${Math.round(ratio * 100)}% van limiet`;
    if (ratio >= DAILY_THRESHOLDS.hoog) {
      warnings.push({
        level: 'hoog',
        title: `${LABELS[c.name]} te hoog`,
        subtitle: pct,
        message: `${LABELS[c.name]} te hoog (${pct})`,
      });
    } else if (ratio >= DAILY_THRESHOLDS.letop) {
      warnings.push({
        level: 'letop',
        title: `${LABELS[c.name]} let op`,
        subtitle: pct,
        message: `${LABELS[c.name]} let op (${pct})`,
      });
    }
  }

  // Protein is a goal, not a limit — warn if too low
  const proteinRatio = totals.protein / l.protein;
  if (proteinRatio < 0.4) {
    warnings.push({
      level: 'letop',
      title: 'Eiwit te laag',
      subtitle: `${Math.round(proteinRatio * 100)}% van doel`,
      message: `Eiwit te laag (${Math.round(proteinRatio * 100)}% van doel)`,
    });
  }

  return warnings;
}

/** Analyze what adding a food would do to daily totals */
export function analyzeMealImpactWarnings(
  food: FoodRow,
  amountGrams: number,
  currentTotals: { potassium: number; phosphate: number; sodium: number; protein: number; fluid: number },
  limits?: DailyLimits
): DailyWarning[] {
  const l = limits || getLimits();
  const factor = amountGrams / 100;
  const warnings: DailyWarning[] = [];

  const newTotals = {
    potassium: currentTotals.potassium + food.potassium_mg * factor,
    phosphate: currentTotals.phosphate + food.phosphate_mg * factor,
    sodium: currentTotals.sodium + food.sodium_mg * factor,
    fluid: currentTotals.fluid + food.fluid_ml * factor,
  };

  const LABELS: Record<string, string> = {
    kalium: 'Kalium', fosfaat: 'Fosfaat', natrium: 'Natrium', vocht: 'Vocht',
  };

  const checks: { name: string; newVal: number; limit: number }[] = [
    { name: 'kalium', newVal: newTotals.potassium, limit: l.potassium },
    { name: 'fosfaat', newVal: newTotals.phosphate, limit: l.phosphate },
    { name: 'natrium', newVal: newTotals.sodium, limit: l.sodium },
    { name: 'vocht', newVal: newTotals.fluid, limit: l.fluid },
  ];

  for (const c of checks) {
    const ratio = c.newVal / c.limit;
    const pct = `${Math.round(ratio * 100)}% van limiet`;
    if (ratio >= 0.9) {
      warnings.push({
        level: 'hoog',
        title: `${LABELS[c.name]} te hoog`,
        subtitle: pct,
        message: `${LABELS[c.name]} te hoog (${pct})`,
      });
    } else if (ratio >= 0.7) {
      warnings.push({
        level: 'letop',
        title: `${LABELS[c.name]} let op`,
        subtitle: pct,
        message: `${LABELS[c.name]} let op (${pct})`,
      });
    }
  }

  return warnings;
}

/** Visual config for risk levels */
export const RISK_STYLES = {
  laag: {
    bg: 'bg-safe/10',
    border: 'border-safe/30',
    text: 'text-safe',
    dot: 'bg-safe',
  },
  letop: {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    text: 'text-warning',
    dot: 'bg-warning',
  },
  hoog: {
    bg: 'bg-danger/10',
    border: 'border-danger/30',
    text: 'text-danger',
    dot: 'bg-danger',
  },
} as const;
