import { useEffect } from 'react';
import { usePremium } from '@/contexts/PremiumContext';
import { showBanner, hideBanner } from '@/lib/admob';

/**
 * Mounts an AdMob banner (TOP_CENTER) while the component is mounted.
 * Native-only; no-op on web. Skips premium users.
 * Banner is positioned at the top so it never overlaps the BottomNav.
 */
export function useAdMobBanner() {
  const { isPremium } = usePremium();

  useEffect(() => {
    if (isPremium) return;
    let cancelled = false;
    showBanner().then((ok) => {
      if (cancelled && ok) hideBanner();
    });
    return () => {
      cancelled = true;
      hideBanner();
    };
  }, [isPremium]);
}
