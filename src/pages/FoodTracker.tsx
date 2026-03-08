import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, Loader2, Plus, X, Search, Check, Pencil, ChevronRight, ScanBarcode } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFoodSearch, useTodayEntries, addFoodEntryDB, useRecentFoods, useMostUsedFoods, type FoodRow } from '@/hooks/useFoods';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useOpenFoodFactsLookup, type OpenFoodFactsProduct } from '@/hooks/useBarcodeLookup';

interface DetectedFood {
  naam: string;
  hoeveelheid_gram: number;
  is_drank: boolean;
  // After NEVO lookup
  matched?: FoodRow;
  amount: number; // user-editable grams
  confirmed: boolean;
}

type Step = 'capture' | 'analyzing' | 'confirm' | 'manual' | 'barcode' | 'barcode-result';

export default function FoodTracker() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('capture');
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [detectedFoods, setDetectedFoods] = useState<DetectedFood[]>([]);
  const [saving, setSaving] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [barcodeAmount, setBarcodeAmount] = useState(100);

  const { entries, refetch } = useTodayEntries();
  const { foods: searchResults, loading: searchLoading } = useFoodSearch(manualSearch);
  const barcodeLookup = useOpenFoodFactsLookup();

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

  // --- Add manual food to the detected list ---
  const addManualFood = (food: FoodRow) => {
    setDetectedFoods(prev => [
      ...prev,
      { naam: food.name, hoeveelheid_gram: 100, is_drank: false, matched: food, amount: 100, confirmed: true },
    ]);
    setManualSearch('');
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
    setManualSearch('');
    setBarcodeAmount(100);
    barcodeLookup.reset();
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    setStep('barcode-result');
    setBarcodeAmount(100);
    await barcodeLookup.lookup(barcode);
  }, [barcodeLookup]);

  const handleAddBarcodeProduct = async () => {
    if (!user || !barcodeLookup.product || !barcodeLookup.product.isComplete) return;
    setSaving(true);
    try {
      const p = barcodeLookup.product;
      const factor = barcodeAmount / 100;
      const { error } = await supabase.from('food_entries').insert({
        user_id: user.id,
        name: `${p.name}${p.brand ? ` (${p.brand})` : ''}`,
        potassium_mg: Math.round((p.nutriments.potassium_mg ?? 0) * factor),
        phosphate_mg: Math.round((p.nutriments.phosphorus_mg ?? 0) * factor),
        sodium_mg: Math.round((p.nutriments.sodium_mg ?? 0) * factor),
        protein_g: Math.round((p.nutriments.proteins_g ?? 0) * factor * 10) / 10,
        fluid_ml: Math.round((p.nutriments.water_ml ?? 0) * factor),
        portions: factor,
      });
      if (error) throw error;
      toast.success('Product toegevoegd!');
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

            {/* Manual search fallback */}
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
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(detectedFoods.length > 0 ? 'confirm' : 'capture')}>
                ← Terug
              </Button>
              <h2 className="font-display text-lg font-semibold text-foreground">Zoeken</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Zoek voedingsmiddel..."
                value={manualSearch}
                onChange={e => setManualSearch(e.target.value)}
                className="h-12 rounded-xl pl-10 text-base"
                autoFocus
              />
            </div>
            {manualSearch.trim() !== '' && (
              <div className="space-y-2">
                {searchResults.map(food => (
                  <button
                    key={food.id}
                    onClick={() => addManualFood(food)}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{food.name}</p>
                      <p className="text-xs text-muted-foreground">{food.portion_description} · {food.category}</p>
                    </div>
                    <Plus className="h-5 w-5 shrink-0 text-primary" />
                  </button>
                ))}
                {searchLoading && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                {!searchLoading && searchResults.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">Geen resultaten gevonden.</p>
                )}
              </div>
            )}
          </div>
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

            {barcodeLookup.product && (
              <BarcodeProductCard
                product={barcodeLookup.product}
                amount={barcodeAmount}
                onAmountChange={setBarcodeAmount}
                onAdd={handleAddBarcodeProduct}
                onRescan={() => { barcodeLookup.reset(); setStep('barcode'); }}
                saving={saving}
              />
            )}
          </div>
        )}

        {/* Today's entries */}
        {entries.length > 0 && step !== 'manual' && step !== 'barcode' && (
          <div>
            <h2 className="mb-3 font-display text-lg font-semibold">Vandaag gegeten</h2>
            <div className="space-y-2">
              {entries.map(entry => (
                <div key={entry.id} className="rounded-xl border border-border bg-card p-3">
                  <p className="font-medium text-foreground">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(entry.portions * 100)}g · K: {entry.potassium_mg}mg · F: {entry.phosphate_mg}mg · Na: {entry.sodium_mg}mg · E: {entry.protein_g}g · Vocht: {entry.fluid_ml}ml
                  </p>
                </div>
              ))}
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
                <p className="font-semibold text-foreground">{food.matched.name}</p>
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
        <span className="text-sm text-muted-foreground">{food.is_drank ? 'ml' : 'g'}</span>
      </div>

      {/* Nutrient preview from NEVO */}
      {food.matched && food.amount > 0 && (
        <div className="mt-2 grid grid-cols-5 gap-1 text-center">
          <NutrientMini label="K" value={Math.round(food.matched.potassium_mg * factor)} unit="mg" />
          <NutrientMini label="F" value={Math.round(food.matched.phosphate_mg * factor)} unit="mg" />
          <NutrientMini label="Na" value={Math.round(food.matched.sodium_mg * factor)} unit="mg" />
          <NutrientMini label="E" value={Math.round(food.matched.protein_g * factor * 10) / 10} unit="g" />
          <NutrientMini label="V" value={Math.round(food.matched.fluid_ml * factor)} unit="ml" />
        </div>
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
                <span className="text-foreground">{r.name}</span>
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

function NutrientMini({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-md bg-muted px-1 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-bold text-foreground">{value}</p>
    </div>
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

// --- Barcode Product Card ---
function BarcodeProductCard({
  product,
  amount,
  onAmountChange,
  onAdd,
  onRescan,
  saving,
}: {
  product: OpenFoodFactsProduct;
  amount: number;
  onAmountChange: (amount: number) => void;
  onAdd: () => void;
  onRescan: () => void;
  saving: boolean;
}) {
  const factor = amount / 100;
  const n = product.nutriments;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Product info */}
      <div className="flex gap-3">
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-20 w-20 rounded-lg object-contain border border-border bg-white"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">{product.name}</p>
          {product.brand && (
            <p className="text-sm text-muted-foreground">{product.brand}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Barcode: {product.barcode}</p>
        </div>
      </div>

      {/* Nutrient values per 100g */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">Voedingswaarden per 100g/ml:</p>
        <div className="grid grid-cols-5 gap-1 text-center">
          <NutrientMiniBarcode label="K" value={n.potassium_mg} unit="mg" />
          <NutrientMiniBarcode label="F" value={n.phosphorus_mg} unit="mg" />
          <NutrientMiniBarcode label="Na" value={n.sodium_mg} unit="mg" />
          <NutrientMiniBarcode label="E" value={n.proteins_g} unit="g" />
          <NutrientMiniBarcode label="V" value={n.water_ml} unit="ml" />
        </div>
      </div>

      {product.isComplete ? (
        <>
          {/* Amount input */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">Hoeveelheid:</label>
            <Input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={e => onAmountChange(parseFloat(e.target.value) || 0)}
              className="h-9 w-24 rounded-lg text-sm"
            />
            <span className="text-sm text-muted-foreground">g/ml</span>
          </div>

          {/* Calculated values */}
          {amount > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Berekend voor {amount}g/ml:</p>
              <div className="grid grid-cols-5 gap-1 text-center">
                <NutrientMini label="K" value={Math.round((n.potassium_mg ?? 0) * factor)} unit="mg" />
                <NutrientMini label="F" value={Math.round((n.phosphorus_mg ?? 0) * factor)} unit="mg" />
                <NutrientMini label="Na" value={Math.round((n.sodium_mg ?? 0) * factor)} unit="mg" />
                <NutrientMini label="E" value={Math.round((n.proteins_g ?? 0) * factor * 10) / 10} unit="g" />
                <NutrientMini label="V" value={Math.round((n.water_ml ?? 0) * factor)} unit="ml" />
              </div>
            </div>
          )}

          {/* Add button */}
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
          {/* Incomplete product warning */}
          <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
            <p className="text-sm font-medium text-warning">
              Dit product kan niet worden toegevoegd omdat niet alle benodigde voedingswaarden beschikbaar zijn.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ontbrekend: {product.missingFields.join(', ')}
            </p>
          </div>
          <Button onClick={onRescan} variant="outline" className="h-12 w-full rounded-xl text-base font-semibold">
            Ander product scannen
          </Button>
        </>
      )}
    </div>
  );
}

function NutrientMiniBarcode({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className={`rounded-md px-1 py-1.5 ${value != null ? 'bg-muted' : 'bg-warning/10'}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-bold text-foreground">
        {value != null ? `${Math.round(value)}` : '—'}
      </p>
    </div>
  );
}
