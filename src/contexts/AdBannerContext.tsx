import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { usePremium } from '@/contexts/PremiumContext';

interface AdBannerContextType {
  /** Whether a native banner ad is currently visible */
  isBannerVisible: boolean;
  setBannerVisible: (visible: boolean) => void;
  /** Extra bottom padding pages should add (nav + reserved banner slot) */
  contentBottomPadding: number;
  /** Fixed reserved space for the banner above the nav */
  bannerSlotHeight: number;
  /** Total fixed UI height at the bottom of the screen */
  bottomChromeHeight: number;
  /** Measured safe area inset at the bottom */
  safeAreaBottom: number;
  /** Whether the mobile keyboard is open */
  isKeyboardOpen: boolean;
  /** Whether the layout should reserve the native banner slot */
  shouldReserveBannerSlot: boolean;
}

export const BOTTOM_NAV_HEIGHT = 60;
export const BANNER_AD_HEIGHT = 56;

const CONTENT_BREATHING_ROOM = 16;
const KEYBOARD_THRESHOLD = 120;
const BANNER_ROUTES = new Set(['/', '/voeding', '/symptomen']);

const AdBannerContext = createContext<AdBannerContextType>({
  isBannerVisible: false,
  setBannerVisible: () => {},
  contentBottomPadding: BOTTOM_NAV_HEIGHT + CONTENT_BREATHING_ROOM,
  bannerSlotHeight: 0,
  bottomChromeHeight: BOTTOM_NAV_HEIGHT,
  safeAreaBottom: 0,
  isKeyboardOpen: false,
  shouldReserveBannerSlot: false,
});

export function AdBannerProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isPremium } = usePremium();
  const isNative = Capacitor.isNativePlatform();
  const [isBannerVisible, setBannerVisible] = useState(false);
  const [safeAreaBottom, setSafeAreaBottom] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Reset when premium changes
  useEffect(() => {
    if (isPremium) setBannerVisible(false);
  }, [isPremium]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const measureSafeAreaBottom = () => {
      const probe = document.createElement('div');
      probe.style.position = 'fixed';
      probe.style.bottom = '0';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
      document.body.appendChild(probe);
      const measured = parseFloat(window.getComputedStyle(probe).paddingBottom) || 0;
      document.body.removeChild(probe);
      return measured;
    };

    const syncViewportState = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const keyboardDelta = Math.max(0, window.innerHeight - viewportHeight);
      setIsKeyboardOpen(keyboardDelta > KEYBOARD_THRESHOLD);
      setSafeAreaBottom(measureSafeAreaBottom());
    };

    syncViewportState();

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', syncViewportState);
    visualViewport?.addEventListener('resize', syncViewportState);

    return () => {
      window.removeEventListener('resize', syncViewportState);
      visualViewport?.removeEventListener('resize', syncViewportState);
    };
  }, []);

  const shouldReserveBannerSlot = isNative && !isPremium && BANNER_ROUTES.has(location.pathname) && !isKeyboardOpen;
  const bannerSlotHeight = shouldReserveBannerSlot ? BANNER_AD_HEIGHT : 0;
  const bottomChromeHeight = BOTTOM_NAV_HEIGHT + safeAreaBottom + bannerSlotHeight;
  const contentBottomPadding = bottomChromeHeight + CONTENT_BREATHING_ROOM;

  return (
    <AdBannerContext.Provider
      value={{
        isBannerVisible,
        setBannerVisible,
        contentBottomPadding,
        bannerSlotHeight,
        bottomChromeHeight,
        safeAreaBottom,
        isKeyboardOpen,
        shouldReserveBannerSlot,
      }}
    >
      {children}
    </AdBannerContext.Provider>
  );
}

export const useAdBanner = () => useContext(AdBannerContext);
