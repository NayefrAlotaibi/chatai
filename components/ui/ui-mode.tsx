'use client';

import { createContext, useContext, useMemo, useState } from 'react';

type UIMode = 'chat' | 'dashboard';
type UIView = 'overview' | 'receipts' | 'bank';

interface UIModeContextValue {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  view: UIView;
  setView: (view: UIView) => void;
}

const UIModeContext = createContext<UIModeContextValue | null>(null);

export function UIModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<UIMode>('chat');
  const [view, setView] = useState<UIView>('overview');

  const value = useMemo(() => ({ mode, setMode, view, setView }), [mode, view]);

  return <UIModeContext.Provider value={value}>{children}</UIModeContext.Provider>;
}

export function useUIMode() {
  const ctx = useContext(UIModeContext);
  if (!ctx) throw new Error('useUIMode must be used within UIModeProvider');
  return ctx;
}


