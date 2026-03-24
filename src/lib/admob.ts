import { AdMob, BannerAdSize, BannerAdPosition, AdmobConsentStatus, AdOptions, BannerAdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// Real ad unit IDs
const REAL_BANNER_ID = 'ca-app-pub-2355808199980173/4663999549';
const REAL_INTERSTITIAL_ID = 'ca-app-pub-2355808199980173/6304517723';

// Test ad unit IDs (Google's official test IDs)
const TEST_BANNER_ID_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_ID_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_BANNER_ID_IOS = 'ca-app-pub-3940256099942544/2934735716';
const TEST_INTERSTITIAL_ID_IOS = 'ca-app-pub-3940256099942544/4411468910';

const IS_PRODUCTION = import.meta.env.PROD;
const isNative = Capacitor.isNativePlatform();

function getBannerAdId(): string {
  if (IS_PRODUCTION) return REAL_BANNER_ID;
  return Capacitor.getPlatform() === 'ios' ? TEST_BANNER_ID_IOS : TEST_BANNER_ID_ANDROID;
}

function getInterstitialAdId(): string {
  if (IS_PRODUCTION) return REAL_INTERSTITIAL_ID;
  return Capacitor.getPlatform() === 'ios' ? TEST_INTERSTITIAL_ID_IOS : TEST_INTERSTITIAL_ID_ANDROID;
}

let initialized = false;
let lastInterstitialTime = 0;
const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes

export async function initializeAdMob(): Promise<void> {
  if (!isNative || initialized) return;
  try {
    await AdMob.initialize({
      initializeForTesting: !IS_PRODUCTION,
    });
    initialized = true;
    console.log('[AdMob] Initialized');
  } catch (e) {
    console.warn('[AdMob] Init failed:', e);
  }
}

export async function showBannerAd(): Promise<void> {
  if (!isNative || !initialized) return;
  try {
    const options: BannerAdOptions = {
      adId: getBannerAdId(),
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 56, // space for bottom nav
      isTesting: !IS_PRODUCTION,
    };
    await AdMob.showBanner(options);
  } catch (e) {
    console.warn('[AdMob] Banner failed:', e);
  }
}

export async function hideBannerAd(): Promise<void> {
  if (!isNative) return;
  try {
    await AdMob.hideBanner();
  } catch (e) {
    // silently ignore
  }
}

export async function removeBannerAd(): Promise<void> {
  if (!isNative) return;
  try {
    await AdMob.removeBanner();
  } catch (e) {
    // silently ignore
  }
}

export async function prepareInterstitial(): Promise<void> {
  if (!isNative || !initialized) return;
  try {
    const options: AdOptions = {
      adId: getInterstitialAdId(),
      isTesting: !IS_PRODUCTION,
    };
    await AdMob.prepareInterstitial(options);
  } catch (e) {
    console.warn('[AdMob] Interstitial prep failed:', e);
  }
}

/**
 * Show an interstitial ad if cooldown has passed.
 * Returns true if the ad was shown.
 */
export async function showInterstitialAd(force = false): Promise<boolean> {
  if (!isNative || !initialized) return false;
  const now = Date.now();
  if (!force && now - lastInterstitialTime < INTERSTITIAL_COOLDOWN_MS) {
    return false;
  }
  try {
    await AdMob.showInterstitial();
    lastInterstitialTime = Date.now();
    // Pre-load next one
    prepareInterstitial().catch(() => {});
    return true;
  } catch (e) {
    console.warn('[AdMob] Interstitial show failed:', e);
    // Try to prepare the next one
    prepareInterstitial().catch(() => {});
    return false;
  }
}

/** Whether we're running on a native platform with AdMob support */
export function isAdMobAvailable(): boolean {
  return isNative && initialized;
}
