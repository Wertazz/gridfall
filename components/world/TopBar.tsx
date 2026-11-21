'use client';

import type { View } from '@/lib/world/engine';
import { LAW_LIST, LAW_NAMES } from '@/lib/sim/roster';
import { profileOf } from '@/lib/sim/profile';
import { darknessAt } from '@/lib/render/renderer';
import Link from 'next/link';

type Props = { view: View | null; observers: number | null; mode: string; onWire: () => void; wireOpen: boolean; onPolitics: () => void };

export function clockLabel(minute: number) {
  const day = Math.floor(minute / 1440) + 1, m = minute % 1440;
  return { day, time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` };
}

export default function TopBar({ view, observers, mode, onWire, wireOpen, onPolitics }: Props) {
  const c = view ? clockLabel(view.minute) : null;
  const night = view ? darknessAt(view.minuteOfDay) > 0.3 : false;
  const pres = view ? view.cur.politics.president : -1;
  const presP = view && pres >= 0 ? profileOf(view.cur, pres) : null;
  const laws = view ? LAW_LIST.filter((b) => view.cur.politics.laws & b).map((b) => LAW_NAMES[b]) : [];

  return (
    <header className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 sm:gap-3 px-3 h-11 min-w-0 overflow-hidden bg-[#0a0a0f]/85 backdrop-blur border-b border-[#1e1e2e] text-[11px] font-mono">
      <span className="text-[#c084fc] font-bold tracking-[0.2em] sm:tracking-[0.25em] text-[11px] sm:text-xs shrink-0">GRIDFALL</span>
      {c && (
        <span className="text-[#e8e6f0] tabular-nums whitespace-nowrap" title="World clock">
          <span aria-hidden>{night ? '☾' : '☀'}</span> Day {c.day} — {c.time}
        </span>
      )}
      {mode !== 'live' && (
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider ${mode === 'oracle' ? 'bg-[#60a5fa]/15 text-[#60a5fa]' : 'bg-[#fbbf24]/15 text-[#fbbf24]'}`}>
          {mode === 'oracle' ? 'FUTURE' : 'PAST'}
        </span>
      )}
      <span className="hidden md:inline text-[#4b5563]">|</span>
      <button onClick={onPolitics} className="text-[#9ca3af] whitespace-nowrap truncate hover:text-[#e8e6f0]" title="Eden Hall: president, laws, election">
        <span className="hidden md:inline">President: </span><span aria-hidden className="md:hidden">⚖ </span><span style={{ color: presP?.color ?? '#6b7280' }}>{presP ? presP.name : 'Interim'}</span>
      </button>
      <span className="hidden lg:inline text-[#9ca3af] truncate max-w-[280px]" title={laws.join(', ')}>
        Laws: <span className="text-[#fbbf24]">{laws.length ? laws.join(' · ') : 'none'}</span>
      </span>
      <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
        {observers !== null && (
          <span className="hidden sm:inline text-[#9ca3af] whitespace-nowrap" title="People watching right now">👁 {observers}</span>
        )}
        {view && (
          <Link href="/proof" className="text-[#4b5563] hover:text-[#c084fc] tabular-nums whitespace-nowrap" title="Every visitor sees this exact hash. Click to learn why.">
            <span className="hidden sm:inline">WORLD STATE </span>#{view.hash.slice(0, 8)}
          </Link>
        )}
        <button onClick={onWire} className={`px-2 py-1 rounded border text-[10px] tracking-wider whitespace-nowrap ${wireOpen ? 'border-[#c084fc]/60 text-[#c084fc]' : 'border-[#1e1e2e] text-[#9ca3af] hover:text-[#c084fc]'}`}>
          THE WIRE
        </button>
      </div>
    </header>
  );
}
