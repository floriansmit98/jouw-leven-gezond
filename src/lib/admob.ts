import { AdMob, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

const REAL_INTERSTITIAL_ID = 'ca-app-pub-2355808199980173/6304517723';
const TEST_INTERSTITIAL_ID_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_INTERSTITIAL_ID_IOS = 'ca-app-pub-3940256099942544/4411468910';

// Banner test IDs (official Google AdMob test units)
const TEST_BANNER_ID_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_BANNER_ID_IOS = 'ca-app-pub-3940256099942544/2934735716';

const IS_PRODUCTION = import.meta.env.PROD;
const isNative = Capacitor.isNativePlatform();

function getInterstitialAdId(): string {
  if (IS_PRODUCTION) return REAL_INTERSTITIAL_ID;
  return Capacitor.getPlatform() === 'ios' ? TEST_INTERSTITIAL_ID_IOS : TEST_INTERSTITIAL_ID_ANDROID;
}

function getBannerAdId(): string {
  // For now ALWAYS use test banner IDs (per request).
  return Capacitor.getPlatform() === 'ios' ? TEST_BANNER_ID_IOS : TEST_BANNER_ID_ANDROID;
}

let initialized = false;
let lastInterstitialTime = 0;
const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000;
let bannerVisible = false;

export async function initializeAdMob(): Promise<void> {
  if (!isNative || initialized) return;
  try {
    await AdMob.initialize({ initializeForTesting: !IS_PRODUCTION });
    initialized = true;
    console.log('[AdMob] Initialized');
  } catch (e) {
    console.warn('[AdMob] Init failed:', e);
  }
}

export async function prepareInterstitial(): Promise<void> {
  if (!isNative || !initialized) return;
  try {
    await AdMob.prepareInterstitial({
      adId: getInterstitialAdId(),
      isTesting: !IS_PRODUCTION,
    });
  } catch (e) {
    console.warn('[AdMob] Interstitial prep failed:', e);
  }
}

export async function showInterstitialAd(force = false): Promise<boolean> {
  if (!isNative || !initialized) return false;
  const now = Date.now();
  if (!force && now - lastInterstitialTime < INTERSTITIAL_COOLDOWN_MS) return false;
  try {
    await AdMob.showInterstitial();
    lastInterstitialTime = Date.now();
    prepareInterstitial().catch(() => {});
    return true;
  } catch (e) {
    console.warn('[AdMob] Interstitial show failed:', e);
    prepareInterstitial().catch(() => {});
    return false;
  }
}

export function isAdMobAvailable(): boolean {
  return isNative && initialized;
}

/**
 * Show an AdMob banner on native platforms.
 * Positioned at TOP_CENTER so it does NOT overlap the fixed BottomNav.
 * Safe no-op on web.
 */
export async function showBanner(): Promise<boolean> {
  if (!isNative) return false;
  if (!initialized) await initializeAdMob();
  if (!initialized) return false;
  if (bannerVisible) return true;
  try {
    await AdMob.showBanner({
      adId: getBannerAdId(),
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.TOP_CENTER,
      margin: 0,
      isTesting: true,
    });
    bannerVisible = true;
    console.log('[AdMob] Banner shown');
    return true;
  } catch (e) {
    console.warn('[AdMob] Banner show failed:', e);
    return false;
  }
}

export async function hideBanner(): Promise<void> {
  if (!isNative || !bannerVisible) return;
  try {
    await AdMob.hideBanner();
    await AdMob.removeBanner();
    bannerVisible = false;
    console.log('[AdMob] Banner hidden');
  } catch (e) {
    console.warn('[AdMob] Banner hide failed:', e);
  }
}
