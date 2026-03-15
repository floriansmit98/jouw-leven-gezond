import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { Camera, Upload, Loader2, Plus, X, Search, Check, Pencil, ChevronRight, ScanBarcode, UtensilsCrossed, Star, Clock, History, Sparkles, Bot, ShoppingBag, CookingPot, Crown } from 'lucide-react';
import { usePremium } from '@/contexts/PremiumContext';
import { useNavigate } from 'react-router-dom';
import SuggestedMealBuilder from '@/components/SuggestedMealBuilder';
import { useOFFSearch, type OFFMatchedFood } from '@/hooks/useOpenFoodFacts';
import { useAIFoodSearch } from '@/hooks/useAIFoodSearch';
import { useMealPatterns } from '@/hooks/useMealPatterns';
import { useUnifiedSearch, fetchCommonMealItems, logMissingSearch, type UnifiedSearchResult } from '@/hooks/useUnifiedSearch';
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
import { getFoodFlags, SearchWarningBadges, SearchWarningDetail } from '@/components/SearchNutrientWarning';
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
  const { isPremium } = usePremium();
  const navigate = useNavigate();
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

  const handleAddBarcodeProduct = async (food?: FoodRow, saveMapping?: boolean) => {
    if (!user) return;
    const nevo = food || barcodeLookup.result?.nevoMatch;
    if (!nevo) return;
    setSaving(true);
    try {
      const factor = barcodeAmount / 100;
      await addFoodEntryDB(user.id, nevo, factor);
      // Save barcode mapping if requested
      if (saveMapping && barcodeLookup.result) {
        await barcodeLookup.saveMapping(
          barcodeLookup.result.barcode,
          nevo.id,
          barcodeLookup.result.offName || undefined,
          barcodeLookup.result.offBrand || undefined
        );
      }
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
          mascotMessage="Wat heeft u gegeten?"
        />

        {/* Hidden file inputs */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

        {/* Step 1: Capture */}
        {step === 'capture' && (
          <>
            {/* Free actions: Slim zoeken & Barcode side by side */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep('manual')}
                className="flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-lg transition-transform active:scale-[0.98]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/20">
                  <Search className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold font-display">Slim zoeken</span>
                  <p className="text-xs text-primary-foreground/75">Zoek voeding</p>
                </div>
              </button>
              <button
                onClick={() => setStep('barcode')}
                className="flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-lg transition-transform active:scale-[0.98]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/20">
                  <ScanBarcode className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold font-display">Barcode</span>
                  <p className="text-xs text-primary-foreground/75">Scan product</p>
                </div>
              </button>
            </div>

            {/* Premium actions: Foto & Galerij */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  if (isPremium) {
                    cameraInputRef.current?.click();
                  } else {
                    navigate('/premium');
                  }
                }}
                className="relative flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20"
              >
                {!isPremium && (
                  <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow">
                    <Crown className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
                <Camera className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Foto maken</span>
              </button>
              <button
                onClick={() => {
                  if (isPremium) {
                    fileInputRef.current?.click();
                  } else {
                    navigate('/premium');
                  }
                }}
                className="relative flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20"
              >
                {!isPremium && (
                  <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow">
                    <Crown className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
                <Upload className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Galerij</span>
              </button>
            </div>

            {/* Additional actions */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setStep('meal-compose')}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20"
              >
                <UtensilsCrossed className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">Maaltijd samenstellen</span>
              </button>
              <button
                onClick={() => setStep('meal-history')}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20"
              >
                <History className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">Geschiedenis</span>
              </button>
            </div>

            {/* Photo preview (when captured) */}
            {preview && (
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

// --- AI-Assisted Smart Search Panel ---
function ManualSearchPanel({ onAddFood, onAddFoodDirect, onBack, saving }: {
  onAddFood?: (food: FoodRow) => void;
  onAddFoodDirect?: (food: FoodRow, amountGrams: number) => Promise<void>;
  onBack: () => void;
  saving?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodRow | null>(null);
  const [amount, setAmount] = useState(100);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [mealItems, setMealItems] = useState<Record<string, any[]>>({});
  
  const { user: searchUser } = useAuth();
  const { result: aiResult, loading: aiLoading } = useAIFoodSearch(query, searchUser?.id);
  const { match: patternMatch, loading: patternLoading } = useMealPatterns(query);
  const { results: unifiedResults, loading: unifiedLoading } = useUnifiedSearch(query);
  const { foods: nevoResults, loading: nevoLoading } = useFoodSearch(query);
  const { foods: recentFoods } = useRecentFoods();
  const { foods: mostUsedFoods } = useMostUsedFoods();
  const { searches: recentSearches, addSearch, clearSearches } = useRecentSearches();

  const showResults = query.trim().length > 0;
  
  // Merge: show unified results (meals, branded, foods) first, then AI/NEVO fallback
  const hasUnifiedResults = unifiedResults.length > 0;
  const hasMealPattern = !!patternMatch && patternMatch.components.some(c => c.food);
  const isLoading = unifiedLoading || patternLoading || aiLoading || (nevoLoading && !aiResult && !hasUnifiedResults);

  // Log missing/weak searches for database improvement
  useEffect(() => {
    if (!showResults || isLoading) return;
    const noResults = !hasUnifiedResults && (!aiResult?.matches || aiResult.matches.length === 0) && (!aiResult?.is_compound || !aiResult.components.every(c => !c.match));
    const weakMatch = hasUnifiedResults && unifiedResults[0]?.rank_score < 60;
    if (noResults) {
      logMissingSearch(query, 'not_found', undefined, searchUser?.id);
    } else if (weakMatch) {
      logMissingSearch(query, 'weak_match', unifiedResults[0]?.display_name, searchUser?.id);
    }
  }, [showResults, isLoading, hasUnifiedResults, query]);

  const handleSelectFood = (food: FoodRow) => {
    addSearch(query);
    if (onAddFood) {
      onAddFood(food);
    } else {
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

  const handleRecentSearchClick = (term: string) => {
    setQuery(term);
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

        {aiResult?.display_message && (
          <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/20 p-3">
            <Bot className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">{aiResult.display_message}</p>
          </div>
        )}

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

          {amount > 0 && (
            <div className="grid grid-cols-5 gap-1 text-center">
              <NutrientMini label="K" value={Math.round(selectedFood.potassium_mg * factor)} unit="mg" />
              <NutrientMini label="F" value={Math.round(selectedFood.phosphate_mg * factor)} unit="mg" />
              <NutrientMini label="Na" value={Math.round(selectedFood.sodium_mg * factor)} unit="mg" />
              <NutrientMini label="E" value={Math.round(selectedFood.protein_g * factor * 10) / 10} unit="g" />
              <NutrientMini label="V" value={Math.round(selectedFood.fluid_ml * factor)} unit="ml" />
            </div>
          )}

          {warnings.length > 0 && (
            <div className="space-y-1.5">
              <WarningBadges warnings={warnings} />
              <WarningMessages warnings={warnings} />
            </div>
          )}

          <SearchWarningDetail flags={getFoodFlags({
            potassium_mg: selectedFood.potassium_mg,
            phosphate_mg: selectedFood.phosphate_mg,
            sodium_mg: selectedFood.sodium_mg,
            portion_grams: amount,
          })} />
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
        <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Slim zoeken
        </h2>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Zoek op product, maaltijd of ingrediënt..."
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

      {/* AI insight message */}
      {showResults && aiResult?.display_message && (
        <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/20 p-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <Bot className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-foreground">{aiResult.display_message}</p>
            {aiResult.brand && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Merk: {aiResult.brand} → {aiResult.product_type}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {showResults && isLoading && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Even denken...</p>
            <p className="text-xs text-muted-foreground">Ik zoek het beste resultaat voor u</p>
          </div>
        </div>
      )}

      {/* Search results */}
      {showResults && !isLoading && (
        <div className="space-y-1.5">
          {/* Suggested meal builder: prefer meal_patterns, fallback to AI compound */}
          {(hasMealPattern || (aiResult?.is_compound && aiResult.components.length > 0 && aiResult.components.some(c => c.match))) && (
            <SuggestedMealBuilder
              query={query}
              patternMatch={hasMealPattern ? patternMatch! : undefined}
              components={!hasMealPattern && aiResult?.is_compound ? aiResult.components : undefined}
              displayMessage={hasMealPattern
                ? `Voorgestelde maaltijd: ${patternMatch!.patternName}`
                : aiResult?.display_message
              }
              onAddAll={async (items) => {
                if (onAddFoodDirect) {
                  for (const item of items) {
                    await onAddFoodDirect(item.food, item.amountGrams);
                  }
                } else if (onAddFood) {
                  for (const item of items) {
                    onAddFood(item.food);
                  }
                }
              }}
              onAddSingle={(food, amount) => {
                if (onAddFoodDirect) {
                  onAddFoodDirect(food, amount);
                } else if (onAddFood) {
                  onAddFood(food);
                }
              }}
              saving={saving}
            />
          )}

          {/* Unified search results grouped by type */}
          {hasUnifiedResults && (() => {
            const filteredResults = unifiedResults.filter(r => {
              const isComponent = aiResult?.is_compound && aiResult.components.some(c => c.match?.id === r.food_id);
              return !isComponent;
            });

            // Re-rank: boost results matching more query words, penalize weak single-word matches
            const queryWords = query.trim().toLowerCase().split(/\s+/).filter(w => w.length > 1);
            const isMultiWord = queryWords.length > 1;

            // Compute debug scores
            const scoredResults = filteredResults.map(r => {
              const name = r.display_name.toLowerCase();
              const matchCount = queryWords.filter(w => name.includes(w)).length;
              const exactBonus = name === query.trim().toLowerCase() ? 1000 : 0;
              const allWordsBonus = matchCount === queryWords.length ? 500 : 0;
              // For multi-word queries, heavily penalize single-word-only matches
              const penalty = isMultiWord && matchCount <= 1 ? -500 : 0;
              // Also check meal items for keyword matches (if loaded)
              let itemsBonus = 0;
              if (r.result_type === 'meal' && mealItems[r.result_id]) {
                const itemNames = mealItems[r.result_id]
                  .filter((item: any) => item.food)
                  .map((item: any) => (item.food.display_name || item.food.name || '').toLowerCase());
                const itemMatches = queryWords.filter(w => itemNames.some((n: string) => n.includes(w))).length;
                itemsBonus = itemMatches * 80;
              }
              const finalScore = exactBonus + allWordsBonus + matchCount * 100 + penalty + itemsBonus + (r.rank_score || 0);
              return { ...r, _debugScore: finalScore };
            });

            // Sort by computed score
            const reranked = scoredResults.sort((a, b) => b._debugScore - a._debugScore);

            // Filter out meal results — hide unreliable meal section for now
            // Only keep a meal if it's an exact match for the query
            const queryLower = query.trim().toLowerCase();
            const allResults = reranked.filter(r => {
              if (r.result_type === 'meal') {
                // Only show meal if exact name match
                return r.display_name.toLowerCase() === queryLower;
              }
              return true;
            });

            const bestMatch = allResults[0];
            const restResults = allResults.slice(1);

            return (
              <div className="space-y-4">
                {/* Beste match highlight */}
                {bestMatch && !aiResult?.is_compound && !hasMealPattern && (
                  <SearchResultCard
                    result={bestMatch}
                    isBestMatch
                    expandedMeal={expandedMeal}
                    mealItems={mealItems}
                    onSelectFood={handleSelectFood}
                    onToggleMeal={(id) => {
                      if (expandedMeal === id) { setExpandedMeal(null); return; }
                      setExpandedMeal(id);
                      if (!mealItems[id]) {
                        fetchCommonMealItems(id).then(items => {
                          setMealItems(prev => ({ ...prev, [id]: items }));
                        });
                      }
                    }}
                    onAddFoodDirect={onAddFoodDirect}
                    onAddFood={onAddFood}
                    saving={saving}
                  />
                )}

                {/* Producten */}
                {restResults.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Producten</h3>
                    </div>
                    <div className="space-y-1.5">
                      {restResults.map(result => (
                        <SearchResultCard
                          key={`${result.result_type}-${result.result_id}`}
                          result={result}
                          expandedMeal={expandedMeal}
                          mealItems={mealItems}
                          onSelectFood={handleSelectFood}
                          onToggleMeal={(id) => {
                            if (expandedMeal === id) { setExpandedMeal(null); return; }
                            setExpandedMeal(id);
                            if (!mealItems[id]) {
                              fetchCommonMealItems(id).then(items => {
                                setMealItems(prev => ({ ...prev, [id]: items }));
                              });
                            }
                          }}
                          onAddFoodDirect={onAddFoodDirect}
                          onAddFood={onAddFood}
                          saving={saving}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}


          {/* Fallback: AI results not in unified */}
          {!hasUnifiedResults && aiResult?.matches && aiResult.matches.length > 0 && aiResult.matches.map((food, idx) => {
            const isComponent = aiResult?.is_compound && aiResult.components.some(c => c.match?.id === food.id);
            if (isComponent) return null;
            return (
              <button
                key={food.id}
                onClick={() => handleSelectFood(food)}
                className={`flex w-full items-center justify-between rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-secondary/50 ${
                  idx === 0 ? 'border-primary/30 bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {idx === 0 && <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Beste match</span>}
                    <p className="font-semibold text-foreground text-sm truncate">{foodDisplayName(food)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{food.portion_description} · {food.category}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground ml-2" />
              </button>
            );
          })}

          {/* No results at all */}
          {!hasUnifiedResults && (!aiResult?.matches || aiResult.matches.length === 0) && (!aiResult?.is_compound || !aiResult.components.some(c => c.match)) && (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-4">
              <Bot className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Geen resultaten gevonden</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Deze zoekopdracht is opgeslagen voor toekomstige verbetering. Probeer een andere term.
                </p>
              </div>
            </div>
          )}

          {hasUnifiedResults && aiResult?.match_quality === 'alias' && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border p-2.5 mt-1">
              <Bot className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Dit is het best beschikbare resultaat. Probeer een specifiekere zoekterm als dit niet klopt.
              </p>
            </div>
          )}
        </div>
      )}

      {/* When not searching: show recent searches, recent & most used */}
      {!showResults && (
        <>
          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  Recente zoekopdrachten
                </h3>
                <button onClick={clearSearches} className="text-xs text-muted-foreground hover:text-foreground">
                  Wissen
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term, i) => (
                  <button
                    key={i}
                    onClick={() => handleRecentSearchClick(term)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hint */}
          <div className="flex items-start gap-2.5 rounded-xl bg-muted/50 border border-border p-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Typ een product, maaltijd of ingrediënt — ook met merknaam. Probeer bijv. "broodje zalm", "tosti ham kaas" of "Calvé pindakaas".
            </p>
          </div>

          {mostUsedFoods.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground flex items-center gap-1.5">
                ⭐ Meest gebruikt
              </h3>
              <div className="space-y-1.5">
                {mostUsedFoods.map(food => (
                  <button
                    key={food.id}
                    onClick={() => handleSelectFood(food)}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left shadow-sm hover:bg-secondary/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{foodDisplayName(food)}</p>
                      <p className="text-xs text-muted-foreground">{food.portion_description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground ml-2" />
                  </button>
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
                  <button
                    key={food.id}
                    onClick={() => handleSelectFood(food)}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left shadow-sm hover:bg-secondary/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{foodDisplayName(food)}</p>
                      <p className="text-xs text-muted-foreground">{food.portion_description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {recentFoods.length === 0 && mostUsedFoods.length === 0 && recentSearches.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">Typ om te zoeken in 2300+ voedingsmiddelen en maaltijden</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Grouped Search Result Card ---
function SearchResultCard({
  result,
  isBestMatch,
  expandedMeal,
  mealItems,
  onSelectFood,
  onToggleMeal,
  onAddFoodDirect,
  onAddFood,
  saving,
}: {
  result: UnifiedSearchResult & { _debugScore?: number };
  isBestMatch?: boolean;
  expandedMeal: string | null;
  mealItems: Record<string, any[]>;
  onSelectFood: (food: FoodRow) => void;
  onToggleMeal: (mealId: string) => void;
  onAddFoodDirect?: (food: FoodRow, amountGrams: number) => Promise<void>;
  onAddFood?: (food: FoodRow) => void;
  saving?: boolean;
}) {
  const isMeal = result.result_type === 'meal';
  const isBranded = result.result_type === 'branded_product';
  const isExpanded = expandedMeal === result.result_id;

  const portionLabel = result.portion_description
    ? `${result.portion_description}${result.portion_grams ? ` (${result.portion_grams} g)` : ''}`
    : `per 100 g`;

  // Build meal components for SuggestedMealBuilder when expanded
  const loadedItems = mealItems[result.result_id];
  const mealComponentItems = isExpanded && loadedItems
    ? loadedItems
        .filter((item: any) => item.food)
        .map((item: any) => ({
          food: item.food as FoodRow,
          amountGrams: item.amount_grams || item.food.portion_grams || 100,
        }))
    : [];
  const isMealLoading = isMeal && isExpanded && !loadedItems;

  return (
    <div>
      <button
        onClick={() => {
          if (isMeal && !result.food_id) {
            onToggleMeal(result.result_id);
          } else {
            const foodRow: FoodRow = {
              id: result.food_id || result.result_id,
              name: result.display_name,
              display_name: result.display_name,
              category: result.category,
              portion_description: result.portion_description,
              portion_grams: result.portion_grams || 100,
              potassium_mg: result.potassium_mg,
              phosphate_mg: result.phosphate_mg,
              sodium_mg: result.sodium_mg,
              protein_g: result.protein_g,
              fluid_ml: result.fluid_ml,
              dialysis_risk_label: '',
            };
            onSelectFood(foodRow);
          }
        }}
        className={`flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-secondary/50 ${
          isBestMatch ? 'border-primary/30 bg-primary/5' : 'border-border'
        }`}
      >
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
          isMeal ? 'bg-primary/10' : isBranded ? 'bg-accent/20' : 'bg-muted'
        }`}>
          {isMeal ? (
            <CookingPot className="h-4 w-4 text-primary" />
          ) : isBranded ? (
            <ShoppingBag className="h-4 w-4 text-accent-foreground" />
          ) : (
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isBestMatch && (
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Beste match</span>
            )}
            <p className="font-semibold text-foreground text-sm truncate">{result.display_name}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              isMeal ? 'bg-primary/10 text-primary' : isBranded ? 'bg-accent/10 text-accent-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {isMeal ? 'Maaltijd' : isBranded ? (result.brand || 'Merk') : 'Product'}
            </span>
            <span className="text-xs text-muted-foreground truncate">{portionLabel}</span>
          </div>
          {!isMeal && (
            <SearchWarningBadges flags={getFoodFlags({
              potassium_mg: result.potassium_mg,
              phosphate_mg: result.phosphate_mg,
              sodium_mg: result.sodium_mg,
              portion_grams: result.portion_grams,
            })} />
          )}
        </div>

        {isMeal && !result.food_id ? (
          <ChevronRight className={`h-5 w-5 shrink-0 text-primary ml-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        ) : (
          <Plus className="h-5 w-5 shrink-0 text-primary ml-2" />
        )}
      </button>

      {/* Expanded meal content */}
      {isMeal && isExpanded && (
        <div className="mt-1.5">
          {isMealLoading && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Onderdelen laden...</p>
            </div>
          )}

          {loadedItems && mealComponentItems.length > 0 && (
            <SuggestedMealBuilder
              query={result.display_name}
              components={mealComponentItems.map((item) => ({
                name: item.food.display_name || item.food.name,
                search_terms: [item.food.name],
                is_drink: item.food.category === 'dranken',
                match: item.food,
              }))}
              displayMessage={result.display_name}
              onAddAll={async (items) => {
                if (onAddFoodDirect) {
                  for (const item of items) {
                    await onAddFoodDirect(item.food, item.amountGrams);
                  }
                } else if (onAddFood) {
                  for (const item of items) {
                    onAddFood(item.food);
                  }
                }
              }}
              onAddSingle={(food, amount) => {
                if (onAddFoodDirect) {
                  onAddFoodDirect(food, amount);
                } else if (onAddFood) {
                  onAddFood(food);
                }
              }}
              saving={saving}
            />
          )}

          {/* Fallback: meal loaded but has no components — show simple add button */}
          {loadedItems && mealComponentItems.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Deze maaltijd heeft geen bewerkbare onderdelen.
              </p>
              <Button
                onClick={() => {
                  const foodRow: FoodRow = {
                    id: result.food_id || result.result_id,
                    name: result.display_name,
                    display_name: result.display_name,
                    category: result.category,
                    portion_description: result.portion_description,
                    portion_grams: result.portion_grams || 100,
                    potassium_mg: result.potassium_mg,
                    phosphate_mg: result.phosphate_mg,
                    sodium_mg: result.sodium_mg,
                    protein_g: result.protein_g,
                    fluid_ml: result.fluid_ml,
                    dialysis_risk_label: '',
                  };
                  onSelectFood(foodRow);
                }}
                className="h-10 w-full rounded-xl text-sm font-semibold"
              >
                <Plus className="mr-2 h-4 w-4" />
                Toevoegen als enkel product
              </Button>
            </div>
          )}
        </div>
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

// --- Barcode Result Card (4 outcomes) ---
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
  onAdd: (food?: FoodRow, saveMapping?: boolean) => void;
  onRescan: () => void;
  onManualSearch: () => void;
  saving: boolean;
}) {
  const [mappingFood, setMappingFood] = useState<FoodRow | null>(null);
  const [mappingSearch, setMappingSearch] = useState('');
  const [showMappingSearch, setShowMappingSearch] = useState(false);
  const { foods: mappingResults, loading: mappingLoading } = useFoodSearch(showMappingSearch ? mappingSearch : '');
  const factor = amount / 100;
  const nevo = mappingFood || result.nevoMatch;

  const handleSelectMapping = (food: FoodRow) => {
    setMappingFood(food);
    onAmountChange(food.portion_grams || 100);
    setShowMappingSearch(false);
  };

  // Shared suggestion cards UI (used in Outcome 2 & 3)
  const SuggestionCards = ({ suggestions, title }: { suggestions: FoodRow[]; title: string }) => {
    const topSuggestions = suggestions.slice(0, 3);
    if (topSuggestions.length === 0) return null;
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <div className="space-y-2">
          {topSuggestions.map(food => {
            const isSelected = mappingFood?.id === food.id;
            return (
              <button
                key={food.id}
                onClick={() => handleSelectMapping(food)}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <span className="text-lg">🍽️</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-foreground truncate">{foodDisplayName(food)}</p>
                  <p className="text-xs text-muted-foreground">{food.category} · {food.portion_description}</p>
                </div>
                {isSelected && <Check className="h-5 w-5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => { setShowMappingSearch(true); setMappingSearch(result.offName || ''); }}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Search className="h-4 w-4" />
          Ander voedingsmiddel zoeken
        </button>
      </div>
    );
  };

  // Manual search overlay (shared between Outcome 2 & 3)
  const MappingSearchPanel = () => (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowMappingSearch(false)}>← Terug</Button>
        <p className="text-sm font-medium text-foreground">Zoek voedingsmiddel</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Zoek generiek voedingsmiddel..."
          value={mappingSearch}
          onChange={e => setMappingSearch(e.target.value)}
          className="h-10 rounded-xl pl-9 text-sm"
          autoFocus
        />
      </div>
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {mappingResults.slice(0, 8).map(food => (
          <button
            key={food.id}
            onClick={() => handleSelectMapping(food)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-muted transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{foodDisplayName(food)}</p>
              <p className="text-xs text-muted-foreground">{food.category}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ))}
        {mappingLoading && <Loader2 className="mx-auto h-4 w-4 animate-spin text-primary" />}
      </div>
    </div>
  );

  // Outcome 3: Barcode not found in OFF at all
  if (!result.productFound) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="rounded-lg bg-muted p-3 text-center">
          <p className="text-base font-semibold text-foreground">Barcode niet gevonden</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Dit product is niet bekend. Kies een vergelijkbaar voedingsmiddel.
          </p>
        </div>

        {showMappingSearch ? (
          <MappingSearchPanel />
        ) : (
          <SuggestionCards suggestions={result.searchSuggestions} title="Vergelijkbare producten:" />
        )}

        {/* If user selected a mapping food, show it */}
        {mappingFood && (
          <SelectedMappingCard
            food={mappingFood}
            amount={amount}
            onAmountChange={onAmountChange}
            onAdd={() => onAdd(mappingFood, true)}
            saving={saving}
            factor={factor}
          />
        )}

        <Button onClick={onRescan} variant="outline" className="h-12 w-full rounded-xl text-base font-semibold">
          Opnieuw scannen
        </Button>
      </div>
    );
  }

  // Check if the matched food has incomplete dialysis-relevant nutrition
  // Any key nutrient being 0 = incomplete
  const hasIncompleteNutrition = nevo
    ? (nevo.potassium_mg === 0 || nevo.phosphate_mg === 0 || nevo.sodium_mg === 0)
    : false;

  // Product was found in OFF
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Product info */}
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
          {result.fromMapping && (
            <p className="text-xs text-safe mt-1">✓ Eerder gekoppeld</p>
          )}
        </div>
      </div>

      {nevo && !hasIncompleteNutrition && !mappingFood ? (
        <>
          {/* Outcome 1: Complete match — normal flow */}
          <div className="rounded-lg bg-safe/10 border border-safe/30 p-3">
            <p className="text-sm font-medium text-safe">
              ✓ Gekoppeld aan database: {foodDisplayName(nevo)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Voedingswaarden komen uit de betrouwbare NEVO-database.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Voedingswaarden per 100g:</p>
            <div className="grid grid-cols-5 gap-1 text-center">
              <NutrientMini label="K" value={nevo.potassium_mg} unit="mg" />
              <NutrientMini label="F" value={nevo.phosphate_mg} unit="mg" />
              <NutrientMini label="Na" value={nevo.sodium_mg} unit="mg" />
              <NutrientMini label="E" value={Math.round(nevo.protein_g * 10) / 10} unit="g" />
              <NutrientMini label="V" value={nevo.fluid_ml} unit="ml" />
            </div>
          </div>

          <AmountInput food={nevo} grams={amount} onGramsChange={onAmountChange} />

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

          <div className="flex gap-3">
            <Button onClick={onRescan} variant="outline" className="h-12 flex-1 rounded-xl text-base font-semibold">
              Opnieuw scannen
            </Button>
            <Button
              onClick={() => onAdd(undefined, false)}
              disabled={saving || amount <= 0}
              className="h-12 flex-1 rounded-xl text-base font-semibold"
            >
              {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
              Toevoegen
            </Button>
          </div>
        </>
      ) : mappingFood ? (
        <>
          {/* User selected a mapping food — show confirmation */}
          <SelectedMappingCard
            food={mappingFood}
            amount={amount}
            onAmountChange={onAmountChange}
            onAdd={() => onAdd(mappingFood, true)}
            saving={saving}
            factor={factor}
          />
          <Button onClick={onRescan} variant="outline" className="h-12 w-full rounded-xl text-base font-semibold">
            Opnieuw scannen
          </Button>
        </>
      ) : (
        <>
          {/* Outcome 2: Product found but incomplete dialysis nutrition — show 3 suggestions */}
          <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
            <p className="text-sm font-medium text-warning">
              ⚠ Voedingsgegevens onvolledig
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Dialyse-relevante voedingswaarden ontbreken. Kies het best passende alternatief.
            </p>
          </div>

          {showMappingSearch ? (
            <MappingSearchPanel />
          ) : (
            <SuggestionCards suggestions={result.searchSuggestions} title="Beste alternatieven:" />
          )}

          <button
            onClick={onManualSearch}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Search className="h-4 w-4" />
            Handmatig zoeken
          </button>

          <Button onClick={onRescan} variant="outline" className="h-12 w-full rounded-xl text-base font-semibold">
            Opnieuw scannen
          </Button>
        </>
      )}
    </div>
  );
}

/** Card shown when user selects a mapping food for a barcode */
function SelectedMappingCard({
  food,
  amount,
  onAmountChange,
  onAdd,
  saving,
  factor,
}: {
  food: FoodRow;
  amount: number;
  onAmountChange: (amount: number) => void;
  onAdd: () => void;
  saving: boolean;
  factor: number;
}) {
  return (
    <div className="rounded-xl border border-safe/30 bg-safe/5 p-4 space-y-3">
      <div className="rounded-lg bg-safe/10 border border-safe/30 p-2">
        <p className="text-sm font-medium text-safe">
          ✓ Gekoppeld aan: {foodDisplayName(food)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Deze koppeling wordt opgeslagen voor toekomstige scans.
        </p>
      </div>

      <AmountInput food={food} grams={amount} onGramsChange={onAmountChange} />

      {amount > 0 && (
        <div className="grid grid-cols-5 gap-1 text-center">
          <NutrientMini label="K" value={Math.round(food.potassium_mg * factor)} unit="mg" />
          <NutrientMini label="F" value={Math.round(food.phosphate_mg * factor)} unit="mg" />
          <NutrientMini label="Na" value={Math.round(food.sodium_mg * factor)} unit="mg" />
          <NutrientMini label="E" value={Math.round(food.protein_g * factor * 10) / 10} unit="g" />
          <NutrientMini label="V" value={Math.round(food.fluid_ml * factor)} unit="ml" />
        </div>
      )}

      <Button
        onClick={onAdd}
        disabled={saving || amount <= 0}
        className="h-12 w-full rounded-xl text-base font-semibold"
      >
        {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
        Toevoegen & koppeling opslaan
      </Button>
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

