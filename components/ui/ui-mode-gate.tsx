'use client';

import { useUIMode } from './ui-mode';

export function UIModeGate({ children }: { children: React.ReactNode }) {
  // This just provides a wrapper for mode-aware children ordering if needed later
  // Right now, children inside can conditionally render on their own.
  useUIMode();
  return <>{children}</>;
}


