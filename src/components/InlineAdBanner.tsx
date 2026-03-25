import { usePremium } from '@/contexts/PremiumContext';

/**
 * Inline ad placeholder rendered inside scrollable page content.
 * Does NOT use native AdMob banners (which overlay the webview and cause
 * navigation overlap on Android). Revenue comes from interstitial ads instead.
 * Premium users see nothing — no placeholder, no spacing.
 */
export default function InlineAdBanner({ className = '' }: { className?: string }) {
  const { isPremium } = usePremium();

  if (isPremium) return null;

  return (
    <div
      className={`flex items-center justify-center rounded-xl border border-border bg-muted/30 overflow-hidden ${className}`}
      style={{ minHeight: 56 }}
      aria-hidden="true"
    >
      <span className="text-xs text-muted-foreground/50">Advertentie</span>
    </div>
  );
}
