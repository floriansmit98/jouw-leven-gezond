import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { RECIPES } from '@/lib/store';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Recipes() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const recipe = RECIPES.find(r => r.id === selectedId);

  if (recipe) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="mx-auto max-w-lg px-4 pt-6">
          <Button variant="ghost" onClick={() => setSelectedId(null)} className="mb-4 gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Terug
          </Button>
          <h1 className="mb-2 font-display text-2xl font-bold text-foreground">{recipe.name}</h1>
          <p className="mb-4 text-sm text-muted-foreground">{recipe.description}</p>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-card border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground">Kalium</p>
              <p className="text-lg font-bold text-foreground">{recipe.potassium} mg</p>
            </div>
            <div className="rounded-xl bg-card border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground">Fosfaat</p>
              <p className="text-lg font-bold text-foreground">{recipe.phosphate} mg</p>
            </div>
            <div className="rounded-xl bg-card border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground">Natrium</p>
              <p className="text-lg font-bold text-foreground">{recipe.sodium} mg</p>
            </div>
            <div className="rounded-xl bg-card border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground">Eiwit</p>
              <p className="text-lg font-bold text-foreground">{recipe.protein} g</p>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 font-display font-semibold">Ingrediënten</h3>
            <ul className="space-y-1">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {ing}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 font-display font-semibold">Bereiding</h3>
            <ol className="space-y-2">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader title="Recepten" mascotMood="happy" mascotMessage="Ontdek niervriendelijke recepten!" />
        <div className="space-y-3">
          {RECIPES.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left shadow-sm hover:bg-secondary/50 transition-colors"
            >
              <div>
                <p className="font-semibold text-foreground">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.description}</p>
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  <span>K: {r.potassium}mg</span>
                  <span>F: {r.phosphate}mg</span>
                  <span>Na: {r.sodium}mg</span>
                  <span>E: {r.protein}g</span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
