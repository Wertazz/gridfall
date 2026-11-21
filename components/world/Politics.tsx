'use client';

import type { View } from '@/lib/world/engine';
import { profileOf } from '@/lib/sim/profile';
import { LAW_LIST, LAW_NAMES } from '@/lib/sim/roster';

const LAW_DESC: Record<number, string> = {
  1: 'Night rituals are illegal. Gatherings after 22:00 are dispersed.',
  2: '2% of every transfer goes to the Treasury.',
  4: 'Leaks and investigations cannot be published.',
  8: 'The Treasury pays every agent a daily income.',
  16: 'Strikes are crushed. Detentions. Coups become possible.',
};

export function electionPhase(minute: number): { label: string; nextIn: number } {
  const dayMin = 1440, week = 7 * dayMin;
  const inWeek = minute % week;
  const wd = Math.floor(inWeek / dayMin);
  const voteAt = 6 * dayMin + 18 * 60;
  const nextIn = inWeek <= voteAt ? voteAt - inWeek : week - inWeek + voteAt;
  const label = wd <= 1 ? 'Candidacy' : wd <= 4 ? 'Campaign' : wd === 5 ? 'Debate night' : inWeek < voteAt ? 'Election day' : 'New term';
  return { label, nextIn };
}
export function inWorldDuration(m: number) {
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m % 60}m`;
}

export default function Politics({ view, onFocus, onClose }: { view: View | null; onFocus: (uid: number) => void; onClose: () => void }) {
  if (!view) return null;
  const pol = view.cur.politics;
  const pres = pol.president >= 0 ? profileOf(view.cur, pol.president) : null;
  const ph = electionPhase(view.minute);
  const lv = pol.lastVotes;
  return (
    <div className="absolute z-40 top-12 left-1/2 -translate-x-1/2 w-[min(92vw,380px)] bg-[#0a0a0f]/95 backdrop-blur border border-[#1e1e2e] rounded-lg p-4 text-[11px] font-mono" role="dialog" aria-label="Eden Hall — politics">
      <div className="flex items-center mb-3">
        <span className="text-[#34d399] font-bold tracking-[0.2em]">EDEN HALL</span>
        <button onClick={onClose} className="ml-auto text-[#6b7280] hover:text-[#e8e6f0]" aria-label="Close">✕</button>
      </div>
      <p className="text-[#9ca3af]">President</p>
      <button onClick={() => pres && onFocus(pres.uid)} className="text-base font-bold" style={{ color: pres?.color ?? '#6b7280' }}>{pres ? pres.name : 'Interim (SYSTEM)'}</button>
      {pres && <p className="text-[#6b7280]">Approval {pol.approval > 0 ? '+' : ''}{pol.approval} · {pol.motionHour >= 0 ? 'impeachment pending' : 'no motion'}</p>}
      <p className="mt-3 text-[#9ca3af]">{ph.label} · vote in {inWorldDuration(ph.nextIn)}</p>
      {pol.candidates.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {pol.candidates.map((u) => { const p = profileOf(view.cur, u); return <button key={u} onClick={() => onFocus(u)} className="px-1.5 py-0.5 rounded border border-[#1e1e2e]" style={{ color: p.color }}>{p.name}</button>; })}
        </div>
      )}
      {pol.elections > 0 && lv[3] > 0 && (
        <p className="mt-2 text-[#6b7280]">Last result: {profileOf(view.cur, pol.lastWinner).name} {lv[0]} — {lv[1] >= 0 ? `${profileOf(view.cur, lv[1]).name} ${lv[2]}` : 'unopposed'} / {lv[3]} votes</p>
      )}
      <p className="mt-3 text-[#9ca3af]">Laws in force</p>
      <ul className="mt-1 space-y-1.5">
        {LAW_LIST.filter((b) => pol.laws & b).map((b) => (
          <li key={b}><span className="text-[#fbbf24]">{LAW_NAMES[b]}</span> <span className="text-[#6b7280]">— {LAW_DESC[b]}</span></li>
        ))}
        {pol.laws === 0 && <li className="text-[#4b5563]">None. For now.</li>}
      </ul>
      <p className="mt-3 text-[#4b5563]">Elections every 7 world days. Agents vote by loyalty, mood, faction — and bribes.</p>
    </div>
  );
}
