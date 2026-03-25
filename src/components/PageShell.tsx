import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

const BOTTOM_NAV_HEIGHT = 60;
const BREATHING_ROOM = 16;

/**
 * Wraps page content with bottom padding to clear the fixed bottom nav.
 */
export default function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <div
      className={`min-h-screen ${className}`}
      style={{ paddingBottom: BOTTOM_NAV_HEIGHT + BREATHING_ROOM }}
    >
      {children}
    </div>
  );
}
