import { useState, useRef } from 'react';
import { Camera, Upload, Loader2, Plus, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { addFoodEntry } from '@/lib/store';
import { toast } from 'sonner';

interface MealItem {
  naam: string;
  portie: string;
  kalium: number;
  fosfaat: number;
  natrium: number;
  eiwit: number;
  vocht: number;
}

interface MealAnalysis {
  naam: string;
  items: MealItem[];
  totaal: {
    kalium: number;
    fosfaat: number;
    natrium: number;
    eiwit: number;
    vocht: number;
  };
  waarschuwingen: string[];
  advies: string;
}

export default function MealScanner() {
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<MealAnalysis | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setResult(null);
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Convert to base64
    setAnalyzing(true);
    try {
      const base64 = await fileToBase64(file);

      const { data, error } = await supabase.functions.invoke('analyze-meal', {
        body: { imageBase64: base64 },
      });

      if (error) {
        throw new Error(error.message || 'Analyse mislukt');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data as MealAnalysis);
    } catch (err: any) {
      toast.error(err.message || 'Er ging iets mis bij de analyse.');
    } finally {
      setAnalyzing(false);
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/...;base64, prefix
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function handleAddToLog() {
    if (!result) return;
    addFoodEntry({
      name: result.naam,
      potassium: result.totaal.kalium,
      phosphate: result.totaal.fosfaat,
      sodium: result.totaal.natrium,
      protein: result.totaal.eiwit,
      fluid: result.totaal.vocht,
    });
    toast.success(`${result.naam} toegevoegd aan uw voedingslog!`);
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader
          title="Maaltijd Scanner"
          mascotMood="happy"
          mascotMessage="Maak een foto voor een voedingsanalyse!"
        />

        {/* Upload buttons */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          <Button
            onClick={() => cameraInputRef.current?.click()}
            variant="outline"
            className="h-24 flex-col gap-2 rounded-xl border-2 border-dashed text-base"
          >
            <Camera className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium">Foto maken</span>
          </Button>

          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="h-24 flex-col gap-2 rounded-xl border-2 border-dashed text-base"
          >
            <Upload className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium">Foto kiezen</span>
          </Button>
        </div>

        {/* Preview */}
        {preview && (
          <div className="mb-6 overflow-hidden rounded-xl border border-border shadow-sm">
            <img src={preview} alt="Maaltijd foto" className="w-full object-cover" />
          </div>
        )}

        {/* Loading */}
        {analyzing && (
          <div className="mb-6 flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-base font-medium text-foreground">Maaltijd wordt geanalyseerd...</p>
            <p className="text-sm text-muted-foreground">Dit kan even duren</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 font-display text-xl font-bold text-foreground">{result.naam}</h2>

              {/* Items */}
              <div className="mb-4 space-y-2">
                {result.items.map((item, i) => (
                  <div key={i} className="rounded-lg bg-muted p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground">{item.naam}</p>
                      <p className="text-xs text-muted-foreground">{item.portie}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      K: {item.kalium}mg · F: {item.fosfaat}mg · Na: {item.natrium}mg · E: {item.eiwit}g · Vocht: {item.vocht}ml
                    </p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-primary/10 p-3">
                  <p className="text-xs text-muted-foreground">Kalium</p>
                  <p className="text-lg font-bold text-foreground">{result.totaal.kalium} mg</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3">
                  <p className="text-xs text-muted-foreground">Fosfaat</p>
                  <p className="text-lg font-bold text-foreground">{result.totaal.fosfaat} mg</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3">
                  <p className="text-xs text-muted-foreground">Natrium</p>
                  <p className="text-lg font-bold text-foreground">{result.totaal.natrium} mg</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3">
                  <p className="text-xs text-muted-foreground">Eiwit</p>
                  <p className="text-lg font-bold text-foreground">{result.totaal.eiwit} g</p>
                </div>
                <div className="col-span-2 rounded-lg bg-primary/10 p-3">
                  <p className="text-xs text-muted-foreground">Vocht</p>
                  <p className="text-lg font-bold text-foreground">{result.totaal.vocht} ml</p>
                </div>
              </div>
            </div>

            {/* Warnings */}
            {result.waarschuwingen && result.waarschuwingen.length > 0 && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <p className="font-semibold text-foreground">Let op</p>
                </div>
                <ul className="space-y-1">
                  {result.waarschuwingen.map((w, i) => (
                    <li key={i} className="text-sm text-foreground">• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Advice */}
            {result.advies && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="mb-1 text-sm font-semibold text-muted-foreground">Advies</p>
                <p className="text-base text-foreground">{result.advies}</p>
              </div>
            )}

            {/* Add to log button */}
            <Button onClick={handleAddToLog} className="h-12 w-full rounded-xl text-base font-semibold">
              <Plus className="mr-2 h-5 w-5" />
              Toevoegen aan voedingslog
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
