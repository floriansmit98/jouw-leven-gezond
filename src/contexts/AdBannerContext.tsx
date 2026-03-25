import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { usePremium } from '@/contexts/PremiumContext';

interface AdBannerContextType {
  /** Whether a native banner ad is currently visible */
  isBannerVisible: boolean;
  setBannerVisible: (visible: boolean) => void;
  /** Extra bottom padding pages should add (nav + optional banner) */
  contentBottomPadding: number;
  /** Bottom offset for the nav bar (0 or banner height) */
  navBottomOffset: number;
}

const BOTTOM_NAV_HEIGHT = 60;
const BANNER_AD_HEIGHT = 56; // Adaptive banner ~50-60px on most devices

const AdBannerContext = createContext<AdBannerContextType>({
  isBannerVisible: false,
  setBannerVisible: () => {},
  contentBottomPadding: BOTTOM_NAV_HEIGHT,
  navBottomOffset: 0,
});

export function AdBannerProvider({ children }: { children: ReactNode }) {
  const { isPremium } = usePremium();
  const isNative = Capacitor.isNativePlatform();
  const [isBannerVisible, setBannerVisible] = useState(false);

  // Reset when premium changes
  useEffect(() => {
    if (isPremium) setBannerVisible(false);
  }, [isPremium]);

  const navBottomOffset = isBannerVisible && isNative ? BANNER_AD_HEIGHT : 0;
  const contentBottomPadding = BOTTOM_NAV_HEIGHT + navBottomOffset + 16; // 16px extra breathing room

  return (
    <AdBannerContext.Provider
      value={{ isBannerVisible, setBannerVisible, contentBottomPadding, navBottomOffset }}
    >
      {children}
    </AdBannerContext.Provider>
  );
}

export const useAdBanner = () => useContext(AdBannerContext);
