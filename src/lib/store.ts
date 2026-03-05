// Simple localStorage-based store for dialysis patient data

export interface FoodEntry {
  id: string;
  timestamp: string;
  name: string;
  potassium: number; // mg
  phosphate: number; // mg
  sodium: number; // mg
  fluid: number; // ml
}

export interface SymptomEntry {
  id: string;
  timestamp: string;
  type: SymptomType;
  severity: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export type SymptomType = 'vermoeidheid' | 'misselijkheid' | 'jeuk' | 'zwelling' | 'duizeligheid' | 'krampen';

export const SYMPTOM_LABELS: Record<SymptomType, string> = {
  vermoeidheid: 'Vermoeidheid',
  misselijkheid: 'Misselijkheid',
  jeuk: 'Jeuk',
  zwelling: 'Zwelling',
  duizeligheid: 'Duizeligheid',
  krampen: 'Krampen',
};

export interface DialysisSession {
  id: string;
  date: string;
  type: string;
  weightBefore: number;
  weightAfter: number;
  fluidRemoved: number;
  notes?: string;
}

export interface FluidEntry {
  id: string;
  timestamp: string;
  amount: number; // ml
  description: string;
}

export interface DailyLimits {
  potassium: number; // mg - typically 2000-3000
  phosphate: number; // mg - typically 800-1200
  sodium: number; // mg - typically 1500-2300
  fluid: number; // ml - typically 500-1500
}

const DEFAULT_LIMITS: DailyLimits = {
  potassium: 2500,
  phosphate: 1000,
  sodium: 2000,
  fluid: 1000,
};

function getFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function getLimits(): DailyLimits {
  return getFromStorage('dialysis_limits', DEFAULT_LIMITS);
}

export function saveLimits(limits: DailyLimits): void {
  saveToStorage('dialysis_limits', limits);
}

export function getFoodEntries(): FoodEntry[] {
  return getFromStorage('dialysis_food', []);
}

export function addFoodEntry(entry: Omit<FoodEntry, 'id' | 'timestamp'>): FoodEntry {
  const entries = getFoodEntries();
  const newEntry: FoodEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  entries.push(newEntry);
  saveToStorage('dialysis_food', entries);
  return newEntry;
}

export function getSymptomEntries(): SymptomEntry[] {
  return getFromStorage('dialysis_symptoms', []);
}

export function addSymptomEntry(entry: Omit<SymptomEntry, 'id' | 'timestamp'>): SymptomEntry {
  const entries = getSymptomEntries();
  const newEntry: SymptomEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  entries.push(newEntry);
  saveToStorage('dialysis_symptoms', entries);
  return newEntry;
}

export function getDialysisSessions(): DialysisSession[] {
  return getFromStorage('dialysis_sessions', []);
}

export function addDialysisSession(entry: Omit<DialysisSession, 'id'>): DialysisSession {
  const sessions = getDialysisSessions();
  const newSession: DialysisSession = {
    ...entry,
    id: crypto.randomUUID(),
  };
  sessions.push(newSession);
  saveToStorage('dialysis_sessions', sessions);
  return newSession;
}

export function getFluidEntries(): FluidEntry[] {
  return getFromStorage('dialysis_fluids', []);
}

export function addFluidEntry(entry: Omit<FluidEntry, 'id' | 'timestamp'>): FluidEntry {
  const entries = getFluidEntries();
  const newEntry: FluidEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  entries.push(newEntry);
  saveToStorage('dialysis_fluids', entries);
  return newEntry;
}

// Get today's totals
export function getTodayTotals() {
  const today = new Date().toISOString().split('T')[0];
  const foods = getFoodEntries().filter(f => f.timestamp.startsWith(today));
  const fluids = getFluidEntries().filter(f => f.timestamp.startsWith(today));

  const foodFluid = foods.reduce((sum, f) => sum + f.fluid, 0);
  const drinkFluid = fluids.reduce((sum, f) => sum + f.amount, 0);

  return {
    potassium: foods.reduce((sum, f) => sum + f.potassium, 0),
    phosphate: foods.reduce((sum, f) => sum + f.phosphate, 0),
    sodium: foods.reduce((sum, f) => sum + f.sodium, 0),
    fluid: foodFluid + drinkFluid,
  };
}

export function getStatusColor(current: number, limit: number): 'safe' | 'warning' | 'danger' {
  const ratio = current / limit;
  if (ratio < 0.7) return 'safe';
  if (ratio < 0.9) return 'warning';
  return 'danger';
}

export function getStatusLabel(status: 'safe' | 'warning' | 'danger'): string {
  switch (status) {
    case 'safe': return 'Veilig';
    case 'warning': return 'Let op';
    case 'danger': return 'Te hoog';
  }
}

// Risk analysis
export function analyzeRisks() {
  const totals = getTodayTotals();
  const limits = getLimits();
  const warnings: string[] = [];

  if (totals.potassium > limits.potassium * 0.9) {
    warnings.push('Waarschuwing: uw kaliuminname vandaag is mogelijk te hoog.');
  }
  if (totals.phosphate > limits.phosphate * 0.9) {
    warnings.push('Let op: uw fosfaatinname ligt boven de aanbevolen hoeveelheid.');
  }
  if (totals.sodium > limits.sodium * 0.9) {
    warnings.push('Let op: uw natriuminname is hoog vandaag.');
  }
  if (totals.fluid > limits.fluid * 0.9) {
    warnings.push('Let op: uw vochtinname ligt boven de aanbevolen hoeveelheid.');
  }
  if (totals.potassium > limits.potassium * 0.8) {
    const symptoms = getSymptomEntries();
    const today = new Date().toISOString().split('T')[0];
    const todaySymptoms = symptoms.filter(s => s.timestamp.startsWith(today));
    const hasRelatedSymptoms = todaySymptoms.some(s => 
      ['krampen', 'misselijkheid', 'zwelling'].includes(s.type)
    );
    if (hasRelatedSymptoms) {
      warnings.push('Waarschuwing: mogelijk verhoogd risico op een te hoog kaliumgehalte.');
    }
  }

  // Weight gain between sessions
  const sessions = getDialysisSessions();
  if (sessions.length >= 2) {
    const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
    const lastSession = sorted[0];
    const weightGain = totals.fluid / 1000; // rough estimate
    if (weightGain > 2) {
      warnings.push('Let op: uw gewichtstoename is hoger dan normaal voor een dialysedag.');
    }
  }

  return warnings;
}

// Common foods database (Dutch)
export interface FoodItem {
  name: string;
  potassium: number;
  phosphate: number;
  sodium: number;
  fluid: number;
  portion: string;
}

export const COMMON_FOODS: FoodItem[] = [
  { name: 'Witte boterham', potassium: 50, phosphate: 40, sodium: 200, fluid: 10, portion: '1 snee' },
  { name: 'Bruine boterham', potassium: 80, phosphate: 70, sodium: 210, fluid: 10, portion: '1 snee' },
  { name: 'Ei (gekookt)', potassium: 65, phosphate: 100, sodium: 70, fluid: 30, portion: '1 stuk' },
  { name: 'Kaas (jong)', potassium: 25, phosphate: 130, sodium: 250, fluid: 5, portion: '1 plak' },
  { name: 'Kipfilet', potassium: 250, phosphate: 200, sodium: 65, fluid: 50, portion: '100g' },
  { name: 'Rijst (gekookt)', potassium: 35, phosphate: 40, sodium: 1, fluid: 60, portion: '100g' },
  { name: 'Aardappelen (gekookt)', potassium: 330, phosphate: 40, sodium: 5, fluid: 75, portion: '100g' },
  { name: 'Broccoli', potassium: 310, phosphate: 65, sodium: 30, fluid: 85, portion: '100g' },
  { name: 'Appel', potassium: 110, phosphate: 10, sodium: 1, fluid: 85, portion: '1 stuk' },
  { name: 'Banaan', potassium: 360, phosphate: 25, sodium: 1, fluid: 75, portion: '1 stuk' },
  { name: 'Sinaasappel', potassium: 180, phosphate: 15, sodium: 0, fluid: 85, portion: '1 stuk' },
  { name: 'Tomaat', potassium: 240, phosphate: 25, sodium: 5, fluid: 90, portion: '1 stuk' },
  { name: 'Melk (halfvol)', potassium: 150, phosphate: 95, sodium: 45, fluid: 200, portion: '1 glas' },
  { name: 'Yoghurt', potassium: 190, phosphate: 120, sodium: 55, fluid: 150, portion: '1 bakje' },
  { name: 'Koffie (zwart)', potassium: 50, phosphate: 5, sodium: 2, fluid: 150, portion: '1 kopje' },
  { name: 'Thee', potassium: 20, phosphate: 2, sodium: 1, fluid: 200, portion: '1 kopje' },
  { name: 'Water', potassium: 0, phosphate: 0, sodium: 0, fluid: 200, portion: '1 glas' },
  { name: 'Chocolade', potassium: 400, phosphate: 200, sodium: 25, fluid: 2, portion: '1 reep' },
  { name: 'Noten (gemengd)', potassium: 650, phosphate: 450, sodium: 5, fluid: 3, portion: '50g' },
  { name: 'Witvis', potassium: 300, phosphate: 180, sodium: 80, fluid: 60, portion: '100g' },
];

// Recipes
export interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  potassium: number;
  phosphate: number;
  sodium: number;
  servings: number;
}

export const RECIPES: Recipe[] = [
  {
    id: '1',
    name: 'Kip met rijst en courgette',
    description: 'Een lichte en voedzame maaltijd met weinig kalium.',
    ingredients: ['150g kipfilet', '100g witte rijst', '100g courgette', '1 eetlepel olijfolie', 'Kruiden naar smaak'],
    steps: ['Kook de rijst volgens de verpakking.', 'Snijd de kipfilet in stukjes en bak in olijfolie.', 'Snijd de courgette in plakjes en voeg toe.', 'Kruid naar smaak en serveer met de rijst.'],
    potassium: 380,
    phosphate: 270,
    sodium: 120,
    servings: 1,
  },
  {
    id: '2',
    name: 'Pasta met roomsaus en paprika',
    description: 'Romige pasta die arm is aan kalium.',
    ingredients: ['100g pasta', '50ml room', '1 paprika', '1 ui', 'Peper en zout'],
    steps: ['Kook de pasta al dente.', 'Snijd paprika en ui en bak zacht.', 'Voeg room toe en laat inkoken.', 'Meng met de pasta.'],
    potassium: 290,
    phosphate: 180,
    sodium: 200,
    servings: 1,
  },
  {
    id: '3',
    name: 'Ei op toast met komkommer',
    description: 'Eenvoudig ontbijt dat goed past bij een dialysedieet.',
    ingredients: ['2 eieren', '2 sneden wit brood', '½ komkommer', 'Boter'],
    steps: ['Kook of bak de eieren.', 'Toast het brood.', 'Snijd de komkommer.', 'Beleg de toast met ei en komkommer.'],
    potassium: 200,
    phosphate: 250,
    sodium: 450,
    servings: 1,
  },
  {
    id: '4',
    name: 'Wortelsoep',
    description: 'Milde soep die geschikt is voor dialysepatiënten.',
    ingredients: ['300g wortelen', '1 ui', '500ml water', '1 eetlepel boter', 'Nootmuskaat'],
    steps: ['Schil en snijd de wortelen.', 'Fruit de ui in boter.', 'Voeg wortelen en water toe en kook 20 minuten.', 'Pureer en kruid met nootmuskaat.'],
    potassium: 320,
    phosphate: 60,
    sodium: 100,
    servings: 2,
  },
  {
    id: '5',
    name: 'Pannenkoeken',
    description: 'Lekker en eenvoudig, met beperkt fosfaat.',
    ingredients: ['100g bloem', '1 ei', '200ml water', 'Snufje zout', 'Beetje olie'],
    steps: ['Meng bloem, ei, water en zout tot glad beslag.', 'Verhit olie in een pan.', 'Schep beslag in de pan en bak goudbruin.', 'Serveer met wat fruit.'],
    potassium: 150,
    phosphate: 140,
    sodium: 300,
    servings: 2,
  },
];
