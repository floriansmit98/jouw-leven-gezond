import { useEffect, useRef } from 'react';
import { usePremium } from '@/contexts/PremiumContext';
import { Capacitor } from '@capacitor/core';
import { showBannerAd, removeBannerAd } from '@/lib/admob';
import { BOTTOM_NAV_HEIGHT, useAdBanner } from '@/contexts/AdBannerContext';

export default function AdBanner() {
  const { isPremium } = usePremium();
  const isNative = Capacitor.isNativePlatform();
  const {
    bannerSlotHeight,
    safeAreaBottom,
    setBannerVisible,
    shouldReserveBannerSlot,
  } = useAdBanner();
  const lastRequestedRef = useRef<string>('');

  useEffect(() => {
    const shouldShowNativeBanner = isNative && !isPremium && shouldReserveBannerSlot;
    const bannerMargin = BOTTOM_NAV_HEIGHT + safeAreaBottom;
    const requestKey = shouldShowNativeBanner ? `show:${bannerMargin}` : 'hide';

    if (lastRequestedRef.current === requestKey) return;
    lastRequestedRef.current = requestKey;

    let cancelled = false;

    const syncBanner = async () => {
      setBannerVisible(false);

      if (!shouldShowNativeBanner) {
        await removeBannerAd();
        if (!cancelled) setBannerVisible(false);
        return;
      }

      const shown = await showBannerAd(bannerMargin);

      if (cancelled) return;

      if (!shown) {
        await removeBannerAd();
      }

      setBannerVisible(shown);
    };

    void syncBanner();

    return () => {
      cancelled = true;
    };
  }, [isNative, isPremium, safeAreaBottom, setBannerVisible, shouldReserveBannerSlot]);

  useEffect(() => {
    return () => {
      void removeBannerAd();
    };
  }, []);

  if (!isNative || isPremium || bannerSlotHeight === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md"
      style={{
        height: bannerSlotHeight,
        bottom: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
      }}
    />
  );
}
