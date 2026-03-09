import { Crown, Check, BarChart3, FileText, Ban, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PageHeader from '@/components/PageHeader';
import { usePremium } from '@/contexts/PremiumContext';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const BENEFITS = [
  { icon: BarChart3, text: 'Meerdaagse overzichten en trends' },
  { icon: FileText, text: 'Rapport exporteren als PDF' },
  { icon: Ban, text: 'Geen advertenties' },
  { icon: Sparkles, text: 'Alle toekomstige functies inbegrepen' },
];

export default function Premium() {
  const { isPremium, unlock } = usePremium();
  const navigate = useNavigate();

  const handleUnlock = async () => {
    // In a real app this would go through a payment flow
    await unlock();
    toast({ title: 'Premium ontgrendeld! 🎉', description: 'U heeft nu toegang tot alle functies.' });
    navigate('/');
  };

  if (isPremium) {
    return (
      <div className="min-h-screen pb-24">
        <div className="mx-auto max-w-lg px-4 pt-6">
          <PageHeader title="Premium" mascotMessage="U heeft Premium! Bedankt voor uw vertrouwen." />
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Crown className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">Premium actief</h2>
              <p className="text-sm text-muted-foreground">
                U heeft toegang tot alle functies van de app.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <PageHeader title="Premium ontgrendelen" mascotMessage="Ontgrendel alle functies met één aankoop!" />

        <Card className="mb-6 overflow-hidden border-primary/20">
          <div className="bg-gradient-to-br from-primary to-accent p-6 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary-foreground/20 backdrop-blur-sm">
              <Crown className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="font-display text-xl font-bold text-primary-foreground">
              Premium versie
            </h2>
            <p className="mt-1 text-sm text-primary-foreground/80">
              Eenmalige aankoop · geen abonnement
            </p>
          </div>

          <CardContent className="p-5">
            <div className="mb-6 space-y-3">
              {BENEFITS.map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <b.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{b.text}</span>
                  <Check className="ml-auto h-4 w-4 text-safe" />
                </div>
              ))}
            </div>

            <div className="mb-4 rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground">Eenmalige prijs</p>
              <p className="font-display text-3xl font-bold text-foreground">€4,99</p>
            </div>

            <Button
              onClick={handleUnlock}
              size="lg"
              className="h-14 w-full gap-2 rounded-xl text-base font-semibold"
            >
              <Crown className="h-5 w-5" />
              Premium ontgrendelen
            </Button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Eénmalig betalen, voor altijd toegang. Geen abonnement.
            </p>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Wat blijft gratis?</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>✓ Voeding, vocht en symptomen registreren</li>
            <li>✓ Dagelijks overzicht bekijken</li>
            <li>✓ Dialyse risicoscore</li>
            <li>✓ Slim zoeken met waarschuwingen</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
