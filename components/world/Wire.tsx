'use client';

import { useMemo, useState } from 'react';
import type { View } from '@/lib/world/engine';
import { eventText } from '@/lib/lines/grammar';
import { STORYLETS, CAT } from '@/lib/sim/storylets';
import { profileOf } from '@/lib/sim/profile';

const CAT_COLOR: Record<number, string> = {
  [CAT.ECONOMY]: '#fbbf24', [CAT.MEDIA]: '#f87171', [CAT.POLITICS]: '#34d399', [CAT.RELATIONS]: '#f472b6',
  [CAT.LABOR]: '#86efac', [CAT.CULT]: '#e879f9', [CAT.LIFE]: '#e8e6f0', [CAT.TECH]: '#60a5fa', [CAT.AMBIENT]: '#6b7280',
};

type Props = { view: View | null; onFocus: (uid: number) => void; onClip: (hour: number, minute: number, uid: number) => void; onClose: () => void };

export function timeLabel(hour: number, minute: number) {
  return `D${Math.floor(hour / 24) + 1} ${String(hour % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export default function Wire({ view, onFocus, onClip, onClose }: Props) {
  const [filter, setFilter] = useState<'all' | 'major'>('all');
  const items = useMemo(() => {
    if (!view) return [];
    const now = view.minute;
    return view.cur.log
      .filter((e) => e.hour * 60 + e.minute <= now)
      .filter((e) => filter === 'all' || STORYLETS[e.sid].major >= 1)
      .slice(-60).reverse();
  }, [view, filter]);

  return (
    <aside className="absolute z-30 bg-[#0a0a0f]/95 backdrop-blur border-[#1e1e2e] flex flex-col
      inset-x-0 bottom-0 h-[52vh] border-t rounded-t-xl
      md:inset-x-auto md:right-0 md:top-11 md:bottom-12 md:h-auto md:w-[340px] md:border-l md:border-t-0 md:rounded-none"
      aria-label="The Wire — everything said in GRIDFALL">
      <div className="flex items-center gap-2 px-3 h-10 border-b border-[#1e1e2e] shrink-0">
        <span className="text-[#c084fc] text-[11px] font-mono font-bold tracking-[0.2em]">THE WIRE</span>
        <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#34d399]" /></span>
        <div className="ml-auto flex gap-1 text-[10px] font-mono">
          {(['all', 'major'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-2 py-0.5 rounded border ${filter === f ? 'border-[#c084fc]/60 text-[#c084fc]' : 'border-[#1e1e2e] text-[#6b7280]'}`}>{f === 'all' ? 'All' : 'Major'}</button>
          ))}
          <button onClick={onClose} className="ml-1 px-2 text-[#6b7280] hover:text-[#e8e6f0]" aria-label="Close The Wire">✕</button>
        </div>
      </div>
      <ol className="flex-1 overflow-y-auto overscroll-contain">
        {view && items.map((e) => {
          const t = eventText(view.cur, e);
          const sp = t.a ? profileOf(view.cur, t.a.uid) : null;
          const rp = t.b ? profileOf(view.cur, t.b.uid) : null;
          return (
            <li key={e.seq} className="group px-3 py-2.5 border-b border-[#13131f] hover:bg-[#0e0e1a]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: CAT_COLOR[t.cat] }} />
                <span className="text-[10px] font-mono text-[#4b5563] tabular-nums">{timeLabel(e.hour, e.minute)}</span>
                {t.major >= 2 && <span className="text-[8px] font-mono font-bold tracking-wider text-[#f87171]">MAJOR</span>}
                <button onClick={() => onClip(e.hour, e.minute, e.a >= 0 ? e.a : e.b)} className="ml-auto text-[9px] font-mono text-[#4b5563] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#c084fc]" title="Share a permalink to this moment">CLIP</button>
              </div>
              <button onClick={() => e.a >= 0 && onFocus(e.a)} className="text-left text-[12px] text-[#e8e6f0] font-semibold leading-snug hover:text-[#c084fc]">{t.title}</button>
              {t.a && sp && (
                <p className="text-[12px] text-[#c8c5d8] leading-snug mt-1" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                  <button onClick={() => onFocus(sp.uid)} className="font-semibold mr-1" style={{ color: sp.color }}>@{sp.handle}</button>{t.a.text}
                </p>
              )}
              {t.b && rp && (
                <p className="text-[11px] text-[#9ca3af] leading-snug mt-0.5 pl-3 border-l border-[#1e1e2e]" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                  <button onClick={() => onFocus(rp.uid)} className="font-semibold mr-1" style={{ color: rp.color }}>@{rp.handle}</button>{t.b.text}
                </p>
              )}
              {t.sys && <p className="text-[10px] font-mono text-[#6b7280] mt-1 tracking-wide">{t.sys}</p>}
            </li>
          );
        })}
        {view && items.length === 0 && <li className="p-6 text-center text-[11px] text-[#4b5563] font-mono">Silence. For now.</li>}
      </ol>
    </aside>
  );
}
