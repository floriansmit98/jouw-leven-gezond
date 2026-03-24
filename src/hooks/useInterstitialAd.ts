import { useCallback } from 'react';
import { usePremium } from '@/contexts/PremiumContext';
import { showInterstitialAd, prepareInterstitial } from '@/lib/admob';

/**
 * Hook that provides a function to show an interstitial ad.
 * Automatically skips for premium users.
 * Call `triggerInterstitial()` after a user action (e.g. adding food).
 */
export function useInterstitialAd() {
  const { isPremium } = usePremium();

  const triggerInterstitial = useCallback(async (force = false) => {
    if (isPremium) return false;
    return showInterstitialAd(force);
  }, [isPremium]);

  return { triggerInterstitial, prepareInterstitial };
}
