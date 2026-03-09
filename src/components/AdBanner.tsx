import { usePremium } from '@/contexts/PremiumContext';

interface AdBannerProps {
  className?: string;
}

export default function AdBanner({ className = '' }: AdBannerProps) {
  const { isPremium } = usePremium();

  if (isPremium) return null;

  return (
    <div className={`rounded-xl border border-border bg-muted/30 p-4 text-center ${className}`}>
      <p className="text-xs text-muted-foreground/60">Advertentie</p>
      <div className="my-2 flex h-14 items-center justify-center rounded-lg bg-muted/50">
        <span className="text-xs text-muted-foreground/40">Ad placeholder</span>
      </div>
      <p className="text-[10px] text-muted-foreground/40">Verwijder advertenties met Premium</p>
    </div>
  );
}
