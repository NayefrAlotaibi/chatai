'use client';

import { Button } from '@/components/ui/button';
import { useUIMode } from '@/components/ui/ui-mode';
import { InvoiceIcon, MessageIcon } from './icons';

export function FloatingModeToggle() {
  const { mode, setMode } = useUIMode();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        variant="default"
        className="h-10 rounded-full shadow-lg"
        onClick={() => setMode(mode === 'chat' ? 'dashboard' : 'chat')}
      >
        {mode === 'chat' ? (
          <div className="flex items-center gap-2"><InvoiceIcon size={16} /> Dashboard</div>
        ) : (
          <div className="flex items-center gap-2"><MessageIcon size={16} /> Chat</div>
        )}
      </Button>
    </div>
  );
}


