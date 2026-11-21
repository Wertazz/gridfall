'use client';

import type { View } from '@/lib/world/engine';
import { STORYLETS } from '@/lib/sim/storylets';
import { eventText } from '@/lib/lines/grammar';

/** Big events get a banner for a few world minutes. Click to fly to the actor. */
export default function Breaking({ view, onFocus }: { view: View | null; onFocus: (uid: number) => void }) {
  if (!view) return null;
  let ev = null;
  for (let k = view.cur.log.length - 1; k >= 0; k--) {
    const e = view.cur.log[k]; const start = e.hour * 60 + e.minute;
    if (start > view.minute) continue;
    if (view.minute - start > 8) break;
    if (STORYLETS[e.sid].major === 2) { ev = e; break; }
  }
  if (!ev) return null;
  const t = eventText(view.cur, ev);
  const uid = ev.a >= 0 ? ev.a : ev.b;
  return (
    <button
      key={ev.seq}
      onClick={() => uid >= 0 && onFocus(uid)}
      className="breaking absolute z-20 top-14 left-1/2 -translate-x-1/2 max-w-[92vw] flex items-center gap-2 px-3 py-1.5 rounded bg-[#0a0a0f]/90 border border-[#f87171]/50 text-left shadow-[0_0_24px_#f8717133]"
    >
      <span className="shrink-0 text-[9px] font-mono font-bold tracking-[0.2em] px-1.5 py-0.5 rounded bg-[#f87171] text-black">BREAKING</span>
      <span className="text-[12px] text-[#e8e6f0] font-semibold truncate">{t.title}</span>
      <style>{`.breaking{animation:bk .5s ease-out}@keyframes bk{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </button>
  );
}
