import { useState, useRef, useCallback, useMemo } from 'react';
import { Camera, Upload, Loader2, Plus, X, Search, Check, Pencil, ChevronRight, ScanBarcode, UtensilsCrossed, Star, Clock, History, Sparkles, Bot } from 'lucide-react';
import { useOFFSearch, type OFFMatchedFood } from '@/hooks/useOpenFoodFacts';
import { useAIFoodSearch } from '@/hooks/useAIFoodSearch';
import AmountInput from '@/components/AmountInput';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFoodSearch, useTodayEntries, addFoodEntryDB, useRecentFoods, useMostUsedFoods, foodDisplayName, type FoodRow } from '@/hooks/useFoods';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useBarcodeLookup, type BarcodeResult } from '@/hooks/useBarcodeLookup';
import { analyzeFoodWarnings, analyzeDailyWarnings, analyzeMealImpactWarnings } from '@/lib/nutrientWarnings';
import { WarningBadges, WarningMessages, DailyWarningAlerts } from '@/components/NutrientWarnings';
import { getLimits } from '@/lib/store';
import MealComposer from '@/components/MealComposer';
import MealCard from '@/components/MealCard';
import { useTodayMeals, useFavoriteMeals, useRecentMeals, duplicateMeal, type MealWithItems } from '@/hooks/useMeals';

interface DetectedFood {
  naam: string;
  hoeveelheid_gram: number;
  is_drank: boolean;
  // After NEVO lookup
  matched?: FoodRow;
  amount: number; // user-editable grams
  confirmed: boolean;
}

type Step = 'capture' | 'analyzing' | 'confirm' | 'manual' | 'barcode' | 'barcode-result' | 'meal-compose' | 'meal-history';

export default function FoodTracker() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('capture');
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [detectedFoods, setDetectedFoods] = useState<DetectedFood[]>([]);
  const [saving, setSaving] = useState(false);
  const [barcodeAmount, setBarcodeAmount] = useState(100);

  const { entries, refetch } = useTodayEntries();
  const { meals: todayMeals, refetch: refetchMeals } = useTodayMeals();
  const barcodeLookup = useBarcodeLookup();

  const refetchAll = () => { refetch(); refetchMeals(); };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // --- Photo capture ---
  const handleCapture = useCallback((file: File) => {
    setCapturedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    setStep('capture');
    setDetectedFoods([]);
  }, []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCapture(file);
    e.target.value = '';
  }, [handleCapture]);

  // --- AI Analysis ---
  const handleAnalyze = useCallback(async () => {
    if (!capturedFile) return;
    setStep('analyzing');
    try {
      const base64 = await fileToBase64(capturedFile);
      const { data, error } = await supabase.functions.invoke('analyze-meal', {
        body: { imageBase64: base64 },
      });
      if (error) throw new Error(error.message || 'Analyse mislukt');
      if (data.error) throw new Error(data.error);

      const aiItems: { naam: string; hoeveelheid_gram: number; is_drank: boolean }[] = data.foods || [];

      // Look up each food in NEVO
      const matched = await Promise.all(
        aiItems.map(async (item) => {
          const { data: nevoResults } = await supabase.rpc('search_foods_by_type', {
            search_query: item.naam,
            is_drink: item.is_drank,
            page_size: 1,
            page_offset: 0,
          });
          const match = nevoResults?.[0] as FoodRow | undefined;
          return {
            ...item,
            matched: match || undefined,
            amount: item.hoeveelheid_gram,
            confirmed: !!match,
          };
        })
      );

      setDetectedFoods(matched);
      setStep('confirm');
    } catch (err: any) {
      toast.error(err.message || 'Er ging iets mis bij de analyse.');
      setStep('capture');
    }
  }, [capturedFile]);

  // --- Edit detected food ---
  const updateAmount = (index: number, amount: number) => {
    setDetectedFoods(prev => prev.map((f, i) => i === index ? { ...f, amount } : f));
  };

  const removeFood = (index: number) => {
    setDetectedFoods(prev => prev.filter((_, i) => i !== index));
  };

  const replaceFood = (index: number, nevoFood: FoodRow) => {
    setDetectedFoods(prev => prev.map((f, i) =>
      i === index ? { ...f, matched: nevoFood, confirmed: true } : f
    ));
  };

  // --- Add manual food directly (save immediately) ---
  const addManualFoodDirect = async (food: FoodRow, amountGrams: number) => {
    if (!user) return;
    setSaving(true);
    try {
      const factor = amountGrams / 100;
      await addFoodEntryDB(user.id, food, factor);
      toast.success(`${foodDisplayName(food)} toegevoegd!`);
      refetch();
      // If we came from confirm step (AI detection), go back there
      if (detectedFoods.length > 0) {
        setStep('confirm');
      } else {
        setStep('capture');
      }
    } catch {
      toast.error('Kon voeding niet opslaan.');
    }
    setSaving(false);
  };

  // --- Add manual food to detected list (used from confirm step "add more") ---
  const addManualFood = (food: FoodRow) => {
    setDetectedFoods(prev => [
      ...prev,
      { naam: food.name, hoeveelheid_gram: food.portion_grams || 100, is_drank: false, matched: food, amount: food.portion_grams || 100, confirmed: true },
    ]);
    setStep('confirm');
  };

  // --- Save all confirmed foods ---
  const handleSaveAll = async () => {
    if (!user) return;
    const toSave = detectedFoods.filter(f => f.confirmed && f.matched && f.amount > 0);
    if (toSave.length === 0) {
      toast.error('Geen bevestigde voedingsmiddelen om op te slaan.');
      return;
    }
    setSaving(true);
    try {
      for (const item of toSave) {
        const factor = item.amount / 100;
        await addFoodEntryDB(user.id, item.matched!, factor);
      }
      toast.success(`${toSave.length} voedingsmiddel${toSave.length > 1 ? 'en' : ''} toegevoegd!`);
      handleReset();
      refetch();
    } catch {
      toast.error('Kon voeding niet opslaan.');
    }
    setSaving(false);
  };

  const handleReset = () => {
    setStep('capture');
    setPreview(null);
    setCapturedFile(null);
    setDetectedFoods([]);
    // search state is local to ManualSearchPanel
    setBarcodeAmount(100);
    barcodeLookup.reset();
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    setStep('barcode-result');
    const barcodeResult = await barcodeLookup.lookup(barcode);
    if (barcodeResult?.nevoMatch) {
      setBarcodeAmount(barcodeResult.nevoMatch.portion_grams || 100);
    } else {
      setBarcodeAmount(100);
    }
  }, [barcodeLookup]);

  const handleAddBarcodeProduct = async () => {
    if (!user || !barcodeLookup.result || !barcodeLookup.result.nevoMatch) return;
    setSaving(true);
    try {
      const nevo = barcodeLookup.result.nevoMatch;
      const factor = barcodeAmount / 100;
      await addFoodEntryDB(user.id, nevo, factor);
      toast.success(`${foodDisplayName(nevo)} toegevoegd!`);
      handleReset();
      refetch();
    } catch {
      toast.error('Kon product niet opslaan.');
    }
    setSaving(false);
  };

  const confirmedCount = detectedFoods.filter(f => f.confirmed && f.matched).length;

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader
          title="Voeding & Vocht"
          mascotMood="happy"
          mascotMessage={step === 'capture' ? 'Maak een foto van uw maaltijd!' : step === 'confirm' ? 'Controleer de herkende voedingsmiddelen.' : 'Even geduld...'}
        />

        {/* Hidden file inputs */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

        {/* Step 1: Capture */}
        {step === 'capture' && (
          <>
            {!preview ? (
              <div className="mb-6 grid grid-cols-2 gap-3">
                <Button onClick={() => cameraInputRef.current?.click()} variant="outline" className="h-28 flex-col gap-2 rounded-xl border-2 border-dashed text-base">
                  <Camera className="h-10 w-10 text-primary" />
                  <span className="text-sm font-medium">Foto maken</span>
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-28 flex-col gap-2 rounded-xl border-2 border-dashed text-base">
                  <Upload className="h-10 w-10 text-primary" />
                  <span className="text-sm font-medium">Foto kiezen</span>
                </Button>
              </div>
            ) : (
              <div className="mb-6">
                <div className="overflow-hidden rounded-xl border border-border shadow-sm">
                  <img src={preview} alt="Maaltijd foto" className="w-full object-cover" />
                </div>
                <div className="mt-3 flex gap-3">
                  <Button onClick={handleReset} variant="outline" className="h-12 flex-1 rounded-xl text-base font-semibold">
                    <Camera className="mr-2 h-5 w-5" />
                    Nieuwe foto
                  </Button>
                  <Button onClick={handleAnalyze} className="h-12 flex-1 rounded-xl text-base font-semibold">
                    Herken voeding
                  </Button>
                </div>
              </div>
            )}

            {/* Manual search and barcode buttons */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep('manual')}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Search className="h-4 w-4" />
                Handmatig zoeken
              </button>
              <button
                onClick={() => setStep('barcode')}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <ScanBarcode className="h-4 w-4" />
                Barcode scannen
              </button>
            </div>

            {/* Meal buttons */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Button
                onClick={() => setStep('meal-compose')}
                variant="outline"
                className="h-14 flex-col gap-1 rounded-xl border-2 border-dashed"
              >
                <UtensilsCrossed className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Maaltijd samenstellen</span>
              </Button>
              <Button
                onClick={() => setStep('meal-history')}
                variant="outline"
                className="h-14 flex-col gap-1 rounded-xl border-2 border-dashed"
              >
                <History className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Maaltijdgeschiedenis</span>
              </Button>
            </div>
          </>
        )}

        {/* Step: Analyzing */}
        {step === 'analyzing' && (
          <div className="mb-6">
            {preview && (
              <div className="mb-4 overflow-hidden rounded-xl border border-border shadow-sm opacity-60">
                <img src={preview} alt="Maaltijd foto" className="w-full object-cover" />
              </div>
            )}
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-base font-medium text-foreground">Voedingsmiddelen worden herkend...</p>
              <p className="text-sm text-muted-foreground">Dit kan even duren</p>
            </div>
          </div>
        )}

        {/* Step: Confirm detected foods */}
        {step === 'confirm' && (
          <div className="mb-6 space-y-4">
            {preview && (
              <div className="overflow-hidden rounded-xl border border-border shadow-sm">
                <img src={preview} alt="Maaltijd foto" className="h-32 w-full object-cover" />
              </div>
            )}

            <div>
              <h2 className="mb-2 font-display text-lg font-semibold text-foreground">Herkende voedingsmiddelen</h2>
              <p className="mb-3 text-sm text-muted-foreground">Controleer, pas aan of verwijder items. Voedingswaarden komen uit de NEVO-database.</p>
            </div>

            {detectedFoods.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">Geen voedingsmiddelen herkend. Voeg handmatig toe.</p>
              </div>
            )}

            {detectedFoods.map((food, index) => (
              <DetectedFoodCard
                key={index}
                food={food}
                index={index}
                onUpdateAmount={updateAmount}
                onRemove={removeFood}
                onReplace={replaceFood}
              />
            ))}

            {/* Add more */}
            <button
              onClick={() => setStep('manual')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Voedingsmiddel toevoegen
            </button>

            {/* Save */}
            <div className="flex gap-3">
              <Button onClick={handleReset} variant="outline" className="h-12 flex-1 rounded-xl text-base font-semibold">
                Opnieuw
              </Button>
              <Button
                onClick={handleSaveAll}
                disabled={saving || confirmedCount === 0}
                className="h-12 flex-1 rounded-xl text-base font-semibold"
              >
                {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                Opslaan ({confirmedCount})
              </Button>
            </div>
          </div>
        )}

        {/* Step: Manual search */}
        {step === 'manual' && (
          <ManualSearchPanel
            onAddFood={detectedFoods.length > 0 ? addManualFood : undefined}
            onAddFoodDirect={detectedFoods.length === 0 ? addManualFoodDirect : undefined}
            onBack={() => setStep(detectedFoods.length > 0 ? 'confirm' : 'capture')}
            saving={saving}
          />
        )}

        {/* Step: Barcode scanner */}
        {step === 'barcode' && (
          <BarcodeScanner
            onScan={handleBarcodeScan}
            onClose={() => setStep('capture')}
          />
        )}

        {/* Step: Barcode result */}
        {step === 'barcode-result' && (
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleReset}>
                ← Terug
              </Button>
              <h2 className="font-display text-lg font-semibold text-foreground">Barcode resultaat</h2>
            </div>

            {barcodeLookup.loading && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-base font-medium text-foreground">Product opzoeken...</p>
              </div>
            )}

            {barcodeLookup.error && (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">{barcodeLookup.error}</p>
                <Button onClick={() => setStep('barcode')} variant="outline" className="mt-4">
                  Opnieuw scannen
                </Button>
              </div>
            )}

            {barcodeLookup.result && (
              <BarcodeResultCard
                result={barcodeLookup.result}
                amount={barcodeAmount}
                onAmountChange={setBarcodeAmount}
                onAdd={handleAddBarcodeProduct}
                onRescan={() => { barcodeLookup.reset(); setStep('barcode'); }}
                onManualSearch={() => setStep('manual')}
                saving={saving}
              />
            )}
          </div>
        )}

        {/* Step: Meal composer */}
        {step === 'meal-compose' && (
          <MealComposer
            onSaved={() => { handleReset(); refetchAll(); }}
            onCancel={() => setStep('capture')}
          />
        )}

        {/* Step: Meal history */}
        {step === 'meal-history' && (
          <MealHistoryPanel onBack={() => setStep('capture')} onRefresh={refetchAll} />
        )}

        {/* Today's meals */}
        {todayMeals.length > 0 && step !== 'manual' && step !== 'barcode' && step !== 'meal-compose' && step !== 'meal-history' && (
          <div className="mb-4">
            <h2 className="mb-3 font-display text-lg font-semibold">Maaltijden vandaag</h2>
            <div className="space-y-2">
              {todayMeals.map(meal => (
                <MealCard key={meal.id} meal={meal} onRefresh={refetchAll} />
              ))}
            </div>
          </div>
        )}

        {/* Today's individual entries with daily warnings */}
        {entries.length > 0 && step !== 'manual' && step !== 'barcode' && step !== 'meal-compose' && step !== 'meal-history' && (
          <div>
            <h2 className="mb-3 font-display text-lg font-semibold">Vandaag gegeten</h2>

            {/* Daily total warnings */}
            <DailyTotalWarnings entries={entries} />

            <div className="space-y-2">
              {entries.map(entry => {
                const entryWarnings = analyzeFoodWarnings(
                  { potassium_mg: entry.potassium_mg / entry.portions, phosphate_mg: entry.phosphate_mg / entry.portions, sodium_mg: entry.sodium_mg / entry.portions, protein_g: entry.protein_g / entry.portions, fluid_ml: entry.fluid_ml / entry.portions, portion_grams: 100, portion_description: '', name: entry.name, display_name: null, id: entry.id, category: '', dialysis_risk_label: '' } as FoodRow,
                  entry.portions * 100
                );
                return (
                  <div key={entry.id} className="rounded-xl border border-border bg-card p-3">
                    <p className="font-medium text-foreground">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">
                      K: {entry.potassium_mg}mg · F: {entry.phosphate_mg}mg · Na: {entry.sodium_mg}mg · E: {entry.protein_g}g · Vocht: {entry.fluid_ml}ml
                    </p>
                    {entryWarnings.length > 0 && (
                      <div className="mt-1.5">
                        <WarningBadges warnings={entryWarnings} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Detected Food Card ---
function DetectedFoodCard({
  food,
  index,
  onUpdateAmount,
  onRemove,
  onReplace,
}: {
  food: DetectedFood;
  index: number;
  onUpdateAmount: (i: number, amount: number) => void;
  onRemove: (i: number) => void;
  onReplace: (i: number, nevoFood: FoodRow) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { foods: replacements, loading } = useFoodSearch(editing ? searchQuery : '', food.is_drank);

  const factor = food.amount / 100;

  return (
    <div className={`rounded-xl border bg-card p-4 shadow-sm ${food.matched ? 'border-border' : 'border-warning/50 bg-warning/5'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {food.matched ? (
            <>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-safe shrink-0" />
                <p className="font-semibold text-foreground">{foodDisplayName(food.matched)}</p>
              </div>
              <p className="ml-6 text-xs text-muted-foreground">
                NEVO · {food.matched.category}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-foreground">{food.naam}</p>
              <p className="text-xs text-warning">Niet gevonden in NEVO-database</p>
            </>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={() => { setEditing(!editing); setSearchQuery(food.naam); }} className="rounded-lg p-1.5 hover:bg-muted">
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => onRemove(index)} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Amount input */}
      {food.matched && (
        <div className="mt-3">
          <AmountInput
            food={food.matched}
            grams={food.amount}
            onGramsChange={(g) => onUpdateAmount(index, g)}
          />
        </div>
      )}
      {!food.matched && (
        <div className="mt-3 flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">Hoeveelheid:</label>
          <Input
            type="number"
            min="1"
            step="1"
            value={food.amount}
            onChange={e => onUpdateAmount(index, parseFloat(e.target.value) || 0)}
            className="h-9 w-24 rounded-lg text-sm"
          />
          <span className="text-sm text-muted-foreground">g</span>
        </div>
      )}

      {/* Nutrient preview + warnings from NEVO */}
      {food.matched && food.amount > 0 && (
        <>
          <div className="mt-2 grid grid-cols-5 gap-1 text-center">
            <NutrientMini label="K" value={Math.round(food.matched.potassium_mg * factor)} unit="mg" />
            <NutrientMini label="F" value={Math.round(food.matched.phosphate_mg * factor)} unit="mg" />
            <NutrientMini label="Na" value={Math.round(food.matched.sodium_mg * factor)} unit="mg" />
            <NutrientMini label="E" value={Math.round(food.matched.protein_g * factor * 10) / 10} unit="g" />
            <NutrientMini label="V" value={Math.round(food.matched.fluid_ml * factor)} unit="ml" />
          </div>
          {(() => {
            const warnings = analyzeFoodWarnings(food.matched!, food.amount);
            return warnings.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                <WarningBadges warnings={warnings} />
                <WarningMessages warnings={warnings} />
              </div>
            ) : null;
          })()}
        </>
      )}

      {/* Replace search */}
      {editing && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek alternatief..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 rounded-lg pl-8 text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {replacements.slice(0, 5).map(r => (
              <button
                key={r.id}
                onClick={() => { onReplace(index, r); setEditing(false); }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="text-foreground">{foodDisplayName(r)}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
            {loading && <Loader2 className="mx-auto h-4 w-4 animate-spin text-primary" />}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Manual Search Panel with recent/most-used ---
function ManualSearchPanel({ onAddFood, onAddFoodDirect, onBack, saving }: {
  onAddFood?: (food: FoodRow) => void;
  onAddFoodDirect?: (food: FoodRow, amountGrams: number) => Promise<void>;
  onBack: () => void;
  saving?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodRow | null>(null);
  const [amount, setAmount] = useState(100);
  const { foods: nevoResults, loading: nevoLoading } = useFoodSearch(query);
  const { products: offResults, loading: offLoading, noResults: offNoResults } = useOFFSearch(query, false);

  // Merge NEVO (priority) + OFF NEVO-matched results, deduplicate by id
  const searchResults = useMemo(() => {
    const seen = new Set(nevoResults.map(f => f.id));
    const merged: (FoodRow & { nevoMatched?: boolean })[] = [...nevoResults];
    for (const off of offResults) {
      if (!seen.has(off.id)) {
        seen.add(off.id);
        merged.push(off);
      }
    }
    return merged;
  }, [nevoResults, offResults]);
  const searchLoading = nevoLoading || offLoading;
  const { foods: recentFoods } = useRecentFoods();
  const { foods: mostUsedFoods } = useMostUsedFoods();

  const showResults = query.trim().length > 0;

  const handleSelectFood = (food: FoodRow) => {
    if (onAddFood) {
      // Quick-add mode (from confirm step)
      onAddFood(food);
    } else {
      // Direct-save mode: show amount picker
      setSelectedFood(food);
      setAmount(food.portion_grams || 100);
    }
  };

  const handleSaveDirect = async () => {
    if (selectedFood && onAddFoodDirect) {
      await onAddFoodDirect(selectedFood, amount);
      setSelectedFood(null);
      setQuery('');
    }
  };

  // If a food is selected, show the amount picker + save
  if (selectedFood && onAddFoodDirect) {
    const factor = amount / 100;
    const warnings = analyzeFoodWarnings(selectedFood, amount);

    return (
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedFood(null)}>
            ← Terug
          </Button>
          <h2 className="font-display text-lg font-semibold text-foreground">Hoeveelheid</h2>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div>
            <p className="font-semibold text-foreground">{foodDisplayName(selectedFood)}</p>
            <p className="text-xs text-muted-foreground">{selectedFood.portion_description} · {selectedFood.category}</p>
          </div>

          <AmountInput
            food={selectedFood}
            grams={amount}
            onGramsChange={setAmount}
          />

          {/* Nutrient preview */}
          {amount > 0 && (
            <div className="grid grid-cols-5 gap-1 text-center">
              <NutrientMini label="K" value={Math.round(selectedFood.potassium_mg * factor)} unit="mg" />
              <NutrientMini label="F" value={Math.round(selectedFood.phosphate_mg * factor)} unit="mg" />
              <NutrientMini label="Na" value={Math.round(selectedFood.sodium_mg * factor)} unit="mg" />
              <NutrientMini label="E" value={Math.round(selectedFood.protein_g * factor * 10) / 10} unit="g" />
              <NutrientMini label="V" value={Math.round(selectedFood.fluid_ml * factor)} unit="ml" />
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-1.5">
              <WarningBadges warnings={warnings} />
              <WarningMessages warnings={warnings} />
            </div>
          )}
        </div>

        <Button
          onClick={handleSaveDirect}
          disabled={saving || amount <= 0}
          className="h-12 w-full rounded-xl text-base font-semibold"
        >
          {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
          Toevoegen
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Terug
        </Button>
        <h2 className="font-display text-lg font-semibold text-foreground">Zoeken</h2>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Zoek voedingsmiddel of drank..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="h-12 rounded-xl pl-10 pr-10 text-base"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search results */}
      {showResults && (
        <div className="space-y-1.5">
          {searchResults.map(food => (
            <FoodSearchResult key={food.id} food={food} onSelect={handleSelectFood} />
          ))}
          {searchLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {!searchLoading && searchResults.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">Geen resultaten voor "{query}"</p>
              <p className="mt-1 text-xs text-muted-foreground">Probeer een andere zoekterm</p>
            </div>
          )}
        </div>
      )}

      {/* When not searching: show recent & most used */}
      {!showResults && (
        <>
          {mostUsedFoods.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground flex items-center gap-1.5">
                ⭐ Meest gebruikt
              </h3>
              <div className="space-y-1.5">
                {mostUsedFoods.map(food => (
                  <FoodSearchResult key={food.id} food={food} onSelect={handleSelectFood} />
                ))}
              </div>
            </div>
          )}

          {recentFoods.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground flex items-center gap-1.5">
                🕐 Recent gebruikt
              </h3>
              <div className="space-y-1.5">
                {recentFoods.map(food => (
                  <FoodSearchResult key={food.id} food={food} onSelect={handleSelectFood} />
                ))}
              </div>
            </div>
          )}

          {recentFoods.length === 0 && mostUsedFoods.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">Typ om te zoeken in 2300+ voedingsmiddelen</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FoodSearchResult({ food, onSelect }: { food: FoodRow & { nevoMatched?: boolean }; onSelect: (f: FoodRow) => void }) {
  const isUnmatched = food.nevoMatched === false;
  return (
    <button
      onClick={() => !isUnmatched && onSelect(food)}
      disabled={isUnmatched}
      className={`flex w-full items-center justify-between rounded-xl border bg-card p-3 text-left shadow-sm transition-colors ${
        isUnmatched ? 'border-border/50 opacity-60 cursor-not-allowed' : 'border-border hover:bg-secondary/50'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm truncate">{foodDisplayName(food)}</p>
        <p className="text-xs text-muted-foreground">
          {isUnmatched
            ? '⚠️ Geen betrouwbare voedingswaarden beschikbaar'
            : `${food.portion_description} · ${food.category}`
          }
        </p>
      </div>
      {!isUnmatched && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground ml-2" />}
    </button>
  );
}



function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- Barcode Result Card (NEVO-first approach) ---
function BarcodeResultCard({
  result,
  amount,
  onAmountChange,
  onAdd,
  onRescan,
  onManualSearch,
  saving,
}: {
  result: BarcodeResult;
  amount: number;
  onAmountChange: (amount: number) => void;
  onAdd: () => void;
  onRescan: () => void;
  onManualSearch: () => void;
  saving: boolean;
}) {
  const factor = amount / 100;
  const nevo = result.nevoMatch;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Product info from barcode */}
      <div className="flex gap-3">
        {result.imageUrl && (
          <img
            src={result.imageUrl}
            alt={result.offName}
            className="h-20 w-20 rounded-lg object-contain border border-border bg-white"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">{result.offName}</p>
          {result.offBrand && (
            <p className="text-sm text-muted-foreground">{result.offBrand}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Barcode: {result.barcode}</p>
        </div>
      </div>

      {nevo ? (
        <>
          {/* NEVO match found */}
          <div className="rounded-lg bg-safe/10 border border-safe/30 p-3">
            <p className="text-sm font-medium text-safe">
              ✓ Gekoppeld aan NEVO-database: {foodDisplayName(nevo)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Voedingswaarden komen uit de betrouwbare NEVO-database.
            </p>
          </div>

          {/* Nutrient values per 100g from NEVO */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Voedingswaarden per 100g (NEVO):</p>
            <div className="grid grid-cols-5 gap-1 text-center">
              <NutrientMini label="K" value={nevo.potassium_mg} unit="mg" />
              <NutrientMini label="F" value={nevo.phosphate_mg} unit="mg" />
              <NutrientMini label="Na" value={nevo.sodium_mg} unit="mg" />
              <NutrientMini label="E" value={Math.round(nevo.protein_g * 10) / 10} unit="g" />
              <NutrientMini label="V" value={nevo.fluid_ml} unit="ml" />
            </div>
          </div>

          {/* Amount input */}
          <AmountInput
            food={nevo}
            grams={amount}
            onGramsChange={onAmountChange}
          />

          {/* Calculated values + warnings */}
          {amount > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-1">Berekend voor {amount}{['dranken', 'alcohol'].includes(nevo.category) ? 'ml' : 'g'}:</p>
              <div className="grid grid-cols-5 gap-1 text-center">
                <NutrientMini label="K" value={Math.round(nevo.potassium_mg * factor)} unit="mg" />
                <NutrientMini label="F" value={Math.round(nevo.phosphate_mg * factor)} unit="mg" />
                <NutrientMini label="Na" value={Math.round(nevo.sodium_mg * factor)} unit="mg" />
                <NutrientMini label="E" value={Math.round(nevo.protein_g * factor * 10) / 10} unit="g" />
                <NutrientMini label="V" value={Math.round(nevo.fluid_ml * factor)} unit="ml" />
              </div>
              {(() => {
                const warnings = analyzeFoodWarnings(nevo, amount);
                return warnings.length > 0 ? (
                  <div className="space-y-1.5">
                    <WarningBadges warnings={warnings} />
                    <WarningMessages warnings={warnings} />
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <Button onClick={onRescan} variant="outline" className="h-12 flex-1 rounded-xl text-base font-semibold">
              Opnieuw scannen
            </Button>
            <Button
              onClick={onAdd}
              disabled={saving || amount <= 0}
              className="h-12 flex-1 rounded-xl text-base font-semibold"
            >
              {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
              Toevoegen
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* No NEVO match */}
          <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
            <p className="text-sm font-medium text-warning">
              Dit product is herkend, maar bevat onvoldoende voedingsgegevens voor betrouwbare dialyseberekening.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Het product kon niet worden gekoppeld aan de interne voedingsdatabase. Zoek het product handmatig op voor betrouwbare waarden.
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={onRescan} variant="outline" className="h-12 flex-1 rounded-xl text-base font-semibold">
              Opnieuw scannen
            </Button>
            <Button onClick={onManualSearch} className="h-12 flex-1 rounded-xl text-base font-semibold">
              <Search className="mr-2 h-5 w-5" />
              Handmatig zoeken
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function NutrientMini({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-md bg-muted px-1 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-bold text-foreground">{value}</p>
    </div>
  );
}

/** Daily total warnings component */
function DailyTotalWarnings({ entries }: { entries: { potassium_mg: number; phosphate_mg: number; sodium_mg: number; protein_g: number; fluid_ml: number }[] }) {
  const totals = useMemo(() => ({
    potassium: entries.reduce((s, e) => s + Number(e.potassium_mg), 0),
    phosphate: entries.reduce((s, e) => s + Number(e.phosphate_mg), 0),
    sodium: entries.reduce((s, e) => s + Number(e.sodium_mg), 0),
    protein: entries.reduce((s, e) => s + Number(e.protein_g), 0),
    fluid: entries.reduce((s, e) => s + Number(e.fluid_ml), 0),
  }), [entries]);

  const warnings = analyzeDailyWarnings(totals);
  if (warnings.length === 0) return null;

  return (
    <div className="mb-3">
      <DailyWarningAlerts warnings={warnings} />
    </div>
  );
}

/** Meal history panel with favorites and recent meals */
function MealHistoryPanel({ onBack, onRefresh }: { onBack: () => void; onRefresh: () => void }) {
  const { user } = useAuth();
  const { meals: favoriteMeals, loading: favLoading, refetch: refetchFav } = useFavoriteMeals();
  const { meals: recentMeals, loading: recentLoading } = useRecentMeals();
  const [tab, setTab] = useState<'favorieten' | 'recent'>('favorieten');
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const handleQuickAdd = async (meal: MealWithItems) => {
    if (!user) return;
    setDuplicating(meal.id);
    try {
      await duplicateMeal(user.id, meal);
      toast.success(`${meal.name} opnieuw gelogd!`);
      onRefresh();
    } catch {
      toast.error('Kon maaltijd niet dupliceren.');
    }
    setDuplicating(null);
  };

  const meals = tab === 'favorieten' ? favoriteMeals : recentMeals;
  const loading = tab === 'favorieten' ? favLoading : recentLoading;

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>← Terug</Button>
        <h2 className="font-display text-lg font-semibold text-foreground">Maaltijden</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('favorieten')}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            tab === 'favorieten' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
          }`}
        >
          <Star className="h-3.5 w-3.5" />
          Favorieten
        </button>
        <button
          onClick={() => setTab('recent')}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            tab === 'recent' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          Recent
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && meals.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {tab === 'favorieten'
              ? 'Nog geen favoriete maaltijden. Sla een maaltijd op als favoriet om deze hier te zien.'
              : 'Nog geen maaltijden gelogd.'}
          </p>
        </div>
      )}

      {!loading && meals.length > 0 && (
        <div className="space-y-2">
          {meals.map(meal => (
            <div key={meal.id} className="space-y-1">
              <MealCard meal={meal} onRefresh={() => { refetchFav(); onRefresh(); }} />
              {tab === 'favorieten' && (
                <Button
                  onClick={() => handleQuickAdd(meal)}
                  disabled={duplicating === meal.id}
                  size="sm"
                  className="w-full rounded-lg text-xs"
                >
                  {duplicating === meal.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                  Opnieuw loggen met één tik
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

