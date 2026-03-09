import { Crown, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface PremiumBannerProps {
  title?: string;
  description?: string;
}

export default function PremiumBanner({
  title = 'Premium functie',
  description = 'Ontgrendel deze functie met een eenmalige aankoop.',
}: PremiumBannerProps) {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-5 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Lock className="h-5 w-5 text-primary" />
      </div>
      <h3 className="mb-1 font-display text-base font-bold text-foreground">{title}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      <Button onClick={() => navigate('/premium')} className="gap-2 rounded-xl">
        <Crown className="h-4 w-4" /> Premium bekijken
      </Button>
    </div>
  );
}
