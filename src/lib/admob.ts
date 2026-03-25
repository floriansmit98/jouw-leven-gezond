import { AdMob } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

const REAL_INTERSTITIAL_ID = 'ca-app-pub-2355808199980173/6304517723';
const TEST_INTERSTITIAL_ID_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_INTERSTITIAL_ID_IOS = 'ca-app-pub-3940256099942544/4411468910';

const IS_PRODUCTION = import.meta.env.PROD;
const isNative = Capacitor.isNativePlatform();

function getInterstitialAdId(): string {
  if (IS_PRODUCTION) return REAL_INTERSTITIAL_ID;
  return Capacitor.getPlatform() === 'ios' ? TEST_INTERSTITIAL_ID_IOS : TEST_INTERSTITIAL_ID_ANDROID;
}

let initialized = false;
let lastInterstitialTime = 0;
const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000;

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
