import { useEffect } from 'react';
import { usePremium } from '@/contexts/PremiumContext';
import { Capacitor } from '@capacitor/core';
import { showBannerAd, hideBannerAd, removeBannerAd } from '@/lib/admob';
import { useAdBanner } from '@/contexts/AdBannerContext';

interface AdBannerProps {
  className?: string;
}

export default function AdBanner({ className = '' }: AdBannerProps) {
  const { isPremium } = usePremium();
  const isNative = Capacitor.isNativePlatform();
  const { setBannerVisible } = useAdBanner();

  // On native: show/hide the native AdMob banner
  useEffect(() => {
    if (!isNative || isPremium) {
      removeBannerAd();
      setBannerVisible(false);
      return;
    }
    showBannerAd().then(() => setBannerVisible(true));
    return () => {
      hideBannerAd();
      setBannerVisible(false);
    };
  }, [isNative, isPremium, setBannerVisible]);

  // Premium users: no ads at all
  if (isPremium) return null;

  // Native: the banner is rendered natively, no web placeholder needed
  if (isNative) return null;

  // Web fallback: placeholder ad
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
