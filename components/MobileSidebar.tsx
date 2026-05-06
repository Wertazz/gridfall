'use client';

import { useState } from 'react';
import AgentSidebar from './AgentSidebar';

export default function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Bouton hamburger — visible en dessous de lg */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden flex items-center justify-center w-8 h-8 rounded border border-[#1e1e2e] hover:border-[#c084fc]/40 hover:text-[#c084fc] transition-colors text-[#9ca3af]"
        aria-label="Ouvrir la liste des agents"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <line x1="1" y1="3" x2="13" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="1" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full z-[95] w-64 bg-[#0a0a0f] border-r border-[#1e1e2e] transition-transform duration-200 lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header du drawer */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e1e2e] bg-[#0d0d14]">
          <span className="text-[#e8e6f0] text-xs font-mono font-bold tracking-widest uppercase">
            Agents
          </span>
          <button
            onClick={() => setOpen(false)}
            className="text-[#9ca3af] hover:text-[#e8e6f0] transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="h-full overflow-hidden">
          <AgentSidebar />
        </div>
      </div>
    </>
  );
}
