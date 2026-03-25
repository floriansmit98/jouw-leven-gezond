import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { usePremium } from '@/contexts/PremiumContext';
import { AdMob, BannerAdSize, BannerAdPosition, type BannerAdOptions } from '@capacitor-community/admob';

const REAL_BANNER_ID = 'ca-app-pub-2355808199980173/4663999549';
const TEST_BANNER_ID_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_BANNER_ID_IOS = 'ca-app-pub-3940256099942544/2934735716';
const IS_PRODUCTION = import.meta.env.PROD;

function getBannerAdId(): string {
  if (IS_PRODUCTION) return REAL_BANNER_ID;
  return Capacitor.getPlatform() === 'ios' ? TEST_BANNER_ID_IOS : TEST_BANNER_ID_ANDROID;
}

/**
 * Inline ad banner that renders inside page content flow.
 * On native it shows a real AdMob banner; on web it's a placeholder.
 * Only one InlineAdBanner should be visible at a time (AdMob limitation).
 */
export default function InlineAdBanner({ className = '' }: { className?: string }) {
  const { isPremium } = usePremium();
  const isNative = Capacitor.isNativePlatform();
  const containerRef = useRef<HTMLDivElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (isPremium || !isNative) return;

    let cancelled = false;

    const showAd = async () => {
      if (mountedRef.current) {
        try { await AdMob.removeBanner(); } catch {}
        mountedRef.current = false;
      }

      // Calculate the position of the container in the viewport
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const margin = Math.round(window.innerHeight - rect.bottom);

      try {
        const options: BannerAdOptions = {
          adId: getBannerAdId(),
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: Math.max(0, margin),
          isTesting: !IS_PRODUCTION,
        };
        await AdMob.showBanner(options);
        if (!cancelled) {
          mountedRef.current = true;
          setAdLoaded(true);
        }
      } catch (e) {
        console.warn('[InlineAdBanner] Failed:', e);
        if (!cancelled) setAdLoaded(false);
      }
    };

    // Small delay to let layout settle
    const timer = setTimeout(showAd, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (mountedRef.current) {
        AdMob.removeBanner().catch(() => {});
        mountedRef.current = false;
      }
    };
  }, [isPremium, isNative]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mountedRef.current) {
        AdMob.removeBanner().catch(() => {});
        mountedRef.current = false;
      }
    };
  }, []);

  if (isPremium) return null;

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-center rounded-xl border border-border bg-muted/30 overflow-hidden ${className}`}
      style={{ minHeight: 56 }}
      aria-hidden="true"
    >
      {!isNative && (
        <span className="text-xs text-muted-foreground/50">Advertentie</span>
      )}
    </div>
  );
}
