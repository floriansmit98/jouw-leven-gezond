import type { ReactNode } from 'react';
import { useAdBanner } from '@/contexts/AdBannerContext';

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps page content and applies dynamic bottom padding
 * to account for both the bottom nav and the native AdMob banner.
 */
export default function PageShell({ children, className = '' }: PageShellProps) {
  const { contentBottomPadding } = useAdBanner();

  return (
    <div
      className={`min-h-screen ${className}`}
      style={{ paddingBottom: contentBottomPadding }}
    >
      {children}
    </div>
  );
}
