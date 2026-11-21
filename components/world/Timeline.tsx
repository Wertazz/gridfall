'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GENESIS_MS, MINUTE_MS, ORACLE_MS } from '@/lib/sim/config';
import { STORYLETS } from '@/lib/sim/storylets';
import type { TimeMode } from '@/lib/world/engine';

type Marker = [number, number, number, number, number, number]; // hour, minute, sid, a, b, p0
const COLOR: Record<string, string> = {
  election_result: '#34d399', agent_death: '#e8e6f0', agent_birth: '#22d3ee', coup_attempt: '#f43f5e', impeachment_vote: '#fb923c',
  hostile_takeover: '#fbbf24', schism: '#e879f9', token_launch: '#a3e635', token_delisting: '#9ca3af', bank_run: '#ef4444', market_crash: '#f87171',
};
const LABEL: Record<string, string> = {
  election_result: 'Election', agent_death: 'Death', agent_birth: 'Birth', coup_attempt: 'Coup', impeachment_vote: 'Impeachment',
  hostile_takeover: 'Takeover', schism: 'Schism', token_launch: 'Token launch', token_delisting: 'Delisting', bank_run: 'Bank run', market_crash: 'Crash',
};

type Props = { mode: TimeMode; viewT: number | null; onMode: (m: TimeMode) => void };

export default function Timeline({ mode, viewT, onMode }: Props) {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [denied, setDenied] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    fetch('/checkpoints/markers.json').then((r) => (r.ok ? r.json() : [])).then(setMarkers).catch(() => setMarkers([]));
  }, []);

  const span = Math.max(1, now - GENESIS_MS);
  const shown = useMemo(() => {
    const past = markers.filter(([h, m]) => GENESIS_MS + (h * 60 + m) * MINUTE_MS <= now);
    // Keep the timeline readable: always show deaths/births/elections/coups, thin out the rest.
    const strong = new Set(['agent_death', 'agent_birth', 'coup_attempt', 'election_result', 'impeachment_vote']);
    const out = past.filter(([, , sid]) => strong.has(STORYLETS[sid].id));
    const rest = past.filter(([, , sid]) => !strong.has(STORYLETS[sid].id));
    const step = Math.max(1, Math.ceil(rest.length / 120));
    return out.concat(rest.filter((_, i) => i % step === 0));
  }, [markers, now]);

  const t = viewT ?? now;
  const frac = Math.min(1, Math.max(0, (t - GENESIS_MS) / span));
  const scrub = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const tt = GENESIS_MS + f * span;
    if (now - tt < 15_000) onMode({ kind: 'live' }); else onMode({ kind: 'fixed', t: Math.floor(tt) });
  };
  const dragging = useRef(false);

  const ahead = mode.kind === 'oracle' ? mode.ahead : 0;

  return (
    <div className="absolute z-20 left-0 right-0 bottom-0 h-12 bg-[#0a0a0f]/90 backdrop-blur border-t border-[#1e1e2e] flex items-center gap-2 px-2 sm:px-3 font-mono text-[10px]">
      <button
        onClick={() => onMode({ kind: 'live' })}
        className={`shrink-0 px-2 py-1 rounded border font-bold tracking-wider ${mode.kind === 'live' ? 'border-[#34d399]/60 text-[#34d399]' : 'border-[#1e1e2e] text-[#9ca3af] hover:text-[#34d399]'}`}
        aria-label="Return to live"
      >● LIVE</button>

      <div
        ref={bar}
        className="relative flex-1 h-7 cursor-pointer touch-none"
        onPointerDown={(e) => { dragging.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); scrub(e.clientX); }}
        onPointerMove={(e) => { if (dragging.current) scrub(e.clientX); }}
        onPointerUp={() => { dragging.current = false; }}
        role="slider" aria-label="Scroll through the history of GRIDFALL" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)} tabIndex={0}
        onKeyDown={(e) => {
          const stepMs = 60 * MINUTE_MS;
          if (e.key === 'ArrowLeft') onMode({ kind: 'fixed', t: Math.max(GENESIS_MS, t - stepMs) });
          if (e.key === 'ArrowRight') { const nt = t + stepMs; onMode(nt >= now ? { kind: 'live' } : { kind: 'fixed', t: nt }); }
        }}
      >
        <div className="absolute left-0 right-0 top-1/2 h-px bg-[#1e1e2e]" />
        <div className="absolute left-0 top-1/2 h-px bg-[#c084fc]/60" style={{ width: `${frac * 100}%` }} />
        {shown.map(([h, m, sid], i) => {
          const id = STORYLETS[sid].id;
          const x = ((GENESIS_MS + (h * 60 + m) * MINUTE_MS - GENESIS_MS) / span) * 100;
          const big = id === 'agent_death' || id === 'coup_attempt';
          return (
            <button key={i}
              onPointerDown={(e) => { e.stopPropagation(); onMode({ kind: 'fixed', t: GENESIS_MS + (h * 60 + m) * MINUTE_MS - 3 * MINUTE_MS }); }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
              style={{ left: `${x}%`, width: big ? 7 : 4, height: big ? 7 : 4, backgroundColor: COLOR[id] ?? '#6b7280' }}
              title={`${LABEL[id] ?? id} — Day ${Math.floor(h / 24) + 1}`}
              aria-label={`${LABEL[id] ?? id}, day ${Math.floor(h / 24) + 1}`}
            />
          );
        })}
        <div className="absolute top-0 bottom-0 w-0.5 bg-[#e8e6f0] -translate-x-1/2 pointer-events-none" style={{ left: `${frac * 100}%` }} />
        <span className="absolute -top-0.5 left-0 text-[8px] text-[#4b5563] pointer-events-none">GENESIS</span>
      </div>

      <div className="relative shrink-0">
        {mode.kind === 'oracle' ? (
          <div className="flex items-center gap-1.5">
            <input
              type="range" min={0} max={ORACLE_MS} step={5000} value={ahead}
              onChange={(e) => { const v = Number(e.target.value); if (v >= ORACLE_MS) setDenied(true); else setDenied(false); onMode({ kind: 'oracle', ahead: Math.min(v, ORACLE_MS) }); }}
              className="w-20 sm:w-28 accent-[#60a5fa]" aria-label="How far into the future"
            />
            <span className="text-[#60a5fa] tabular-nums w-12">+{Math.floor(ahead / 60000)}:{String(Math.floor((ahead % 60000) / 1000)).padStart(2, '0')}</span>
          </div>
        ) : (
          <button
            onClick={() => { setDenied(false); onMode({ kind: 'oracle', ahead: 2 * 60_000 }); }}
            className="oracle-btn px-2 py-1 rounded border border-[#60a5fa]/40 text-[#60a5fa] font-bold tracking-wider hover:bg-[#60a5fa]/10"
            title="Luna can see the future. So can you — a little."
          >🔒 LOOK AHEAD</button>
        )}
        {denied && <div className="absolute bottom-10 right-0 w-56 px-2 py-1.5 rounded bg-[#0b1322] border border-[#60a5fa]/40 text-[#93c5fd] text-[10px]">Luna refuses to show you more.</div>}
      </div>
      <style>{`.oracle-btn{animation:og 3.2s infinite steps(1)}@keyframes og{0%,92%{transform:none;text-shadow:none}93%{transform:translateX(1px);text-shadow:-2px 0 #f472b6,2px 0 #22d3ee}96%{transform:translateX(-1px);text-shadow:2px 0 #f472b6,-2px 0 #22d3ee}}`}</style>
    </div>
  );
}
