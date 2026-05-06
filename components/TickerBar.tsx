'use client';

import { MOCK_TICKER_ITEMS } from '@/lib/mock-data';

export default function TickerBar() {
  const text = MOCK_TICKER_ITEMS.join('   ◆   ');
  const doubled = `${text}   ◆   ${text}`;

  return (
    <div className="shrink-0 flex items-center h-7 border-t border-[#1e1e2e] bg-[#0d0d14] overflow-hidden">
      {/* Label */}
      <div className="shrink-0 flex items-center gap-2 px-3 h-full border-r border-[#1e1e2e] bg-[#f87171]/10">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f87171] opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#f87171]" />
        </span>
        <span className="text-[#f87171] text-[10px] font-mono font-bold tracking-widest uppercase whitespace-nowrap">
          Breaking
        </span>
      </div>

      {/* Scrolling content */}
      <div className="flex-1 overflow-hidden">
        <div
          className="inline-block whitespace-nowrap text-[#9ca3af] text-[11px] font-mono"
          style={{ animation: 'ticker-scroll 60s linear infinite' }}
        >
          {doubled}
        </div>
      </div>
    </div>
  );
}
