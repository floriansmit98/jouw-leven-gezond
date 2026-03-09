import { AlertTriangle, Info, Leaf } from 'lucide-react';
import { RISK_STYLES, type RiskLevel } from '@/lib/nutrientWarnings';

interface SearchWarningProps {
  potassium_mg: number;
  phosphate_mg: number;
  sodium_mg: number;
  portion_grams: number;
}

// Per-portion thresholds (per 100g basis) for quick display in search results
const THRESHOLDS = {
  potassium: { letop: 150, hoog: 300 },
  phosphate: { letop: 100, hoog: 200 },
  sodium: { letop: 200, hoog: 400 },
};

function classify(value: number, t: { letop: number; hoog: number }): RiskLevel {
  if (value >= t.hoog) return 'hoog';
  if (value >= t.letop) return 'letop';
  return 'laag';
}

// Safer alternatives mapped by nutrient
const ALTERNATIVES: Record<string, string[]> = {
  potassium: ['Appel', 'Druiven', 'Peer', 'Rijst'],
  phosphate: ['Witbrood', 'Rijst', 'Pasta', 'Courgette'],
  sodium: ['Verse groenten', 'Rijst', 'Ongezouten noten'],
};

const LABELS: Record<string, { label: string; desc: string }> = {
  potassium: { label: 'kalium', desc: 'veel kalium' },
  phosphate: { label: 'fosfaat', desc: 'veel fosfaat' },
  sodium: { label: 'natrium', desc: 'veel natrium (zout)' },
};

export interface NutrientFlag {
  nutrient: string;
  level: RiskLevel;
  label: string;
}

/** Get flags for a food item to show inline in search results */
export function getFoodFlags(food: SearchWarningProps): NutrientFlag[] {
  const portion = food.portion_grams || 100;
  const factor = portion / 100;
  const flags: NutrientFlag[] = [];

  const checks = [
    { key: 'potassium', value: food.potassium_mg * factor },
    { key: 'phosphate', value: food.phosphate_mg * factor },
    { key: 'sodium', value: food.sodium_mg * factor },
  ] as const;

  for (const c of checks) {
    const level = classify(c.value, THRESHOLDS[c.key]);
    if (level !== 'laag') {
      flags.push({
        nutrient: c.key,
        level,
        label: level === 'hoog'
          ? `Hoog ${LABELS[c.key].label}`
          : `Let op ${LABELS[c.key].label}`,
      });
    }
  }
  return flags;
}

/** Compact inline badges for search results */
export function SearchWarningBadges({ flags }: { flags: NutrientFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {flags.map(f => {
        const s = RISK_STYLES[f.level];
        return (
          <span
            key={f.nutrient}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${s.bg} ${s.border} ${s.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
            {f.label}
          </span>
        );
      })}
    </div>
  );
}

/** Detailed warning panel for the product detail / amount screen */
export function SearchWarningDetail({ flags }: { flags: NutrientFlag[] }) {
  const hoogFlags = flags.filter(f => f.level === 'hoog');
  if (hoogFlags.length === 0) return null;

  return (
    <div className="space-y-2">
      {hoogFlags.map(f => {
        const info = LABELS[f.nutrient];
        const alts = ALTERNATIVES[f.nutrient];
        return (
          <div key={f.nutrient} className="rounded-xl border border-warning/30 bg-warning/8 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Hoog {info.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  Dit product bevat {info.desc} voor dialysepatiënten.
                </p>
              </div>
            </div>
            {alts && alts.length > 0 && (
              <div className="ml-6">
                <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                  <Leaf className="h-3 w-3 text-safe" />
                  Alternatieven met minder {info.label}:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {alts.map(a => (
                    <span key={a} className="text-[11px] bg-safe/10 text-safe border border-safe/20 rounded-full px-2 py-0.5">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
