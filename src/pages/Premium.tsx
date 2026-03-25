import PageShell from "@/components/PageShell";
import { TrendingUp, BarChart3, FileText, Ban, Eye, Check, X, Shield, Clock, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePremium } from '@/contexts/PremiumContext';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const BENEFITS = [
  { icon: TrendingUp, title: 'Inzicht over meerdere dagen', desc: 'Bekijk je voeding en vocht over een langere periode' },
  { icon: BarChart3, title: 'Duidelijke trends', desc: 'Trends in vocht, kalium, fosfaat en natrium in één overzicht' },
  { icon: FileText, title: 'Rapportfunctie', desc: 'Exporteer overzichten om te bespreken met je arts of diëtist' },
  { icon: Ban, title: 'Geen advertenties', desc: 'Gebruik de app zonder onderbrekingen' },
  { icon: Eye, title: 'Meer rust en overzicht', desc: 'Een rustigere ervaring met meer inzicht in je gezondheid' },
];

const FREE_FEATURES = [
  'Dagelijks invoeren',
  'Dagoverzicht',
  'Basis inzicht',
  'Met advertenties',
];

const PREMIUM_FEATURES = [
  'Overzicht over meerdere dagen',
  'Trendgrafieken',
  'Rapportfunctie',
  'Geen advertenties',
  'Meer historie',
];

const REASSURANCES = [
  { icon: Clock, text: 'Maandelijks opzegbaar' },
  { icon: Shield, text: 'Eerst 7 dagen gratis proberen' },
  { icon: Heart, text: 'Gratis versie blijft beschikbaar voor dagelijks gebruik' },
];

const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

export default function Premium() {
  const { isPremium, unlock } = usePremium();
  const navigate = useNavigate();

  const handleStart = async () => {
    await unlock();
    toast({ title: 'Proefperiode gestart! 🎉', description: 'U heeft nu 7 dagen gratis toegang tot alle functies.' });
    navigate('/');
  };

  if (isPremium) {
    return (
      <PageShell>
        <div className="mx-auto max-w-lg px-4 pt-8">
          <Card className="border-safe/20 bg-gradient-to-br from-safe/5 to-primary/5">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="rounded-full bg-safe/10 p-4">
                <Check className="h-8 w-8 text-safe" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">Premium is actief</h2>
              <p className="text-sm text-muted-foreground">
                U heeft toegang tot alle functies van de app.
              </p>
              <Button variant="outline" onClick={() => navigate('/')} className="mt-2 rounded-xl">
                Terug naar overzicht
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      <div className="mx-auto max-w-lg px-4">

        {/* Hero */}
        <motion.section className="pb-6 pt-10 text-center" {...fade} transition={{ duration: 0.4 }}>
          <h1 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            Haal meer uit je dagoverzicht
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Krijg extra inzicht in je voeding en vocht, bekijk trends over meerdere dagen en gebruik de app zonder advertenties.
          </p>

          <div className="mt-6 space-y-1">
            <p className="font-display text-base font-semibold text-foreground">7 dagen gratis proberen</p>
            <p className="text-sm text-muted-foreground">Daarna €1,99 per maand · op elk moment opzegbaar</p>
          </div>

          <Button
            onClick={handleStart}
            size="lg"
            className="mt-5 h-13 w-full max-w-xs rounded-xl text-base font-semibold"
          >
            Start gratis proefperiode
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Geen betaling vandaag</p>
        </motion.section>

        {/* Benefits */}
        <motion.section className="py-6" {...fade} transition={{ duration: 0.4, delay: 0.1 }}>
          <h2 className="mb-4 font-display text-lg font-bold text-foreground">Met Premium krijg je</h2>
          <div className="space-y-3">
            {BENEFITS.map((b, i) => (
              <Card key={i} className="border-border/60">
                <CardContent className="flex items-start gap-3.5 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8">
                    <b.icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{b.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{b.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        {/* Comparison */}
        <motion.section className="py-6" {...fade} transition={{ duration: 0.4, delay: 0.15 }}>
          <h2 className="mb-4 font-display text-lg font-bold text-foreground">Gratis vs Premium</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Free */}
            <Card className="border-border/60">
              <CardContent className="p-4">
                <p className="mb-3 font-display text-sm font-bold text-muted-foreground">Gratis</p>
                <ul className="space-y-2.5">
                  {FREE_FEATURES.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-safe" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            {/* Premium */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/4 to-accent/4">
              <CardContent className="p-4">
                <p className="mb-3 font-display text-sm font-bold text-primary">Premium</p>
                <ul className="space-y-2.5">
                  {PREMIUM_FEATURES.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        {/* Trust */}
        <motion.section className="py-6" {...fade} transition={{ duration: 0.4, delay: 0.2 }}>
          <h2 className="mb-2 font-display text-lg font-bold text-foreground">Waarom Premium?</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Premium helpt je om meer overzicht te krijgen in je voeding en vochtinname over tijd. Handig voor jezelf en fijn als je ontwikkelingen wilt terugzien of bespreken.
          </p>
        </motion.section>

        {/* Reassurances */}
        <motion.section className="py-6" {...fade} transition={{ duration: 0.4, delay: 0.25 }}>
          <div className="space-y-3">
            {REASSURANCES.map((r, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-safe/10">
                  <r.icon className="h-4 w-4 text-safe" />
                </div>
                <p className="text-sm text-foreground">{r.text}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Bottom CTA */}
        <motion.section className="pb-8 pt-4 text-center" {...fade} transition={{ duration: 0.4, delay: 0.3 }}>
          <Button
            onClick={handleStart}
            size="lg"
            className="h-13 w-full max-w-xs rounded-xl text-base font-semibold"
          >
            Start gratis proefperiode
          </Button>
          <button
            onClick={() => navigate('/')}
            className="mt-3 block w-full text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Verder met gratis versie
          </button>
        </motion.section>

      </div>
    </div>
  );
}
