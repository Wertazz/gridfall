'use client';

import { useState } from 'react';
import EconomyPanel from './EconomyPanel';

export default function MobileEconomyTab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Bouton fixe en bas — visible en dessous de md */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="md:hidden fixed bottom-20 right-4 z-[80] flex items-center gap-2 px-3 py-2 rounded border border-[#1e1e2e] bg-[#0d0d14]/95 backdrop-blur-sm text-[#9ca3af] hover:text-[#34d399] hover:border-[#34d399]/30 transition-colors text-[11px] font-mono"
      >
        <span>📈</span>
        <span>Économie</span>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel slide depuis le bas */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[88] bg-[#0a0a0f] border-t border-[#1e1e2e] transition-transform duration-200 md:hidden ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '70vh' }}
      >
        {/* Poignée */}
        <div
          className="flex justify-center py-2 cursor-pointer"
          onClick={() => setOpen(false)}
        >
          <div className="w-10 h-1 rounded-full bg-[#374151]" />
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 24px)' }}>
          <EconomyPanel />
        </div>
      </div>
    </>
  );
}
