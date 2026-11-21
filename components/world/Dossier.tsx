'use client';

import { useEffect, useRef } from 'react';
import type { View } from '@/lib/world/engine';
import { profileOf, traitList } from '@/lib/sim/profile';
import { SECRET_NAMES, PLACE_NAMES } from '@/lib/sim/roster';
import { N_MAX } from '@/lib/sim/config';
import { placeOf } from '@/lib/sim/routine';
import { eventText, money } from '@/lib/lines/grammar';
import { sprite, POSE } from '@/lib/render/sprites';
import { timeLabel } from './Wire';

type Props = { view: View | null; uid: number; onClose: () => void; onFocus: (uid: number) => void; onClip: (uid: number) => void };

function Portrait({ shape, color, skin }: { shape: number; color: string; skin: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!.getContext('2d')!; c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, 72, 96);
    c.drawImage(sprite(shape, color, skin, 0, POSE.IDLE) as CanvasImageSource, 0, 0, 12, 16, 0, 0, 72, 96);
  }, [shape, color, skin]);
  return <canvas ref={ref} width={72} height={96} className="shrink-0" style={{ imageRendering: 'pixelated' }} />;
}

function Bar({ label, v, min = 0, max = 100, color }: { label: string; v: number; min?: number; max?: number; color: string }) {
  const pctv = Math.round(((v - min) / (max - min)) * 100);
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono">
      <span className="w-16 text-[#6b7280] uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-1.5 bg-[#13131f] rounded"><div className="h-full rounded" style={{ width: `${pctv}%`, backgroundColor: color }} /></div>
      <span className="w-8 text-right text-[#9ca3af] tabular-nums">{v}</span>
    </div>
  );
}

export default function Dossier({ view, uid, onClose, onFocus, onClip }: Props) {
  if (!view) return null;
  const s = view.cur;
  const slot = s.agents.findIndex((a) => a.uid === uid);
  const grave = s.graves.find((g) => g.uid === uid);
  const p = profileOf(s, uid);
  const a = slot >= 0 ? s.agents[slot] : null;

  const hist = a ? a.hist : [];
  const hmax = Math.max(1, ...hist), hmin = Math.min(...hist, hmax);
  const pts = hist.map((v, i) => `${(i / Math.max(1, hist.length - 1)) * 220},${56 - ((v - hmin) / Math.max(1, hmax - hmin)) * 52}`).join(' ');

  const rels = a && a.alive ? s.agents.map((b, j) => ({ j, b, v: s.rel[slot * N_MAX + j] }))
    .filter((r) => r.j !== slot && r.b.alive).sort((x, y) => Math.abs(y.v) - Math.abs(x.v) || x.b.uid - y.b.uid).slice(0, 6) : [];
  const memory = a ? a.mem.filter((q) => q >= 0).reverse().map((q) => s.log.find((e) => e.seq === q)).filter((e) => !!e && e.hour * 60 + e.minute <= view.minute) : [];
  const secrets = a ? SECRET_NAMES.map((n, b) => ({ n, has: (a.secrets & (1 << b)) !== 0, leaked: (a.leaked & (1 << b)) !== 0 })).filter((x) => x.has) : [];
  const votes = a ? a.votes.filter((u) => u >= 0) : [];
  const here = a && a.alive ? placeOf(s, slot, view.H) : -1;
  const isPres = s.politics.president === uid;

  return (
    <aside className="absolute z-30 bg-[#0a0a0f]/95 backdrop-blur border-[#1e1e2e] flex flex-col
      inset-x-0 bottom-0 max-h-[70vh] border-t rounded-t-xl
      md:inset-x-auto md:left-0 md:top-11 md:bottom-12 md:max-h-none md:w-[330px] md:border-r md:border-t-0 md:rounded-none"
      aria-label={`Dossier: ${p.name}`}>
      <div className="flex items-start gap-3 p-3 border-b border-[#1e1e2e]">
        <Portrait shape={p.shape} color={p.color} skin={p.skin} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[#e8e6f0] font-bold text-base truncate">{p.name}</h2>
            <button onClick={onClose} className="ml-auto text-[#6b7280] hover:text-[#e8e6f0] text-sm px-1" aria-label="Close dossier">✕</button>
          </div>
          <p className="text-[11px] font-mono" style={{ color: p.color }}>@{p.handle}</p>
          <p className="text-[10px] font-mono text-[#9ca3af] mt-1">{p.role} · {p.faction}{isPres ? ' · PRESIDENT' : ''}</p>
          <p className="text-[10px] font-mono text-[#6b7280] mt-0.5">
            {a?.alive ? (here >= 0 ? `At ${PLACE_NAMES[here]}` : '') : grave ? `Died ${timeLabel(grave.died, 0).slice(0, -6)} · ${['exhaustion', 'despair', 'disconnection', 'corruption'][grave.cause]}` : 'Deceased'}
          </p>
          <div className="flex gap-2 mt-2">
            {a?.alive ? <button onClick={() => onFocus(uid)} className="text-[10px] font-mono px-2 py-0.5 border border-[#1e1e2e] rounded text-[#9ca3af] hover:text-[#c084fc]">FOLLOW</button> : null}
            <button onClick={() => onClip(uid)} className="text-[10px] font-mono px-2 py-0.5 border border-[#1e1e2e] rounded text-[#9ca3af] hover:text-[#c084fc]">CLIP</button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-4 text-[11px]">
        {a && (
          <section>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] font-mono tracking-widest text-[#6b7280]">FORTUNE</span>
              <span className="text-[#e8e6f0] font-mono font-bold">{money(a.money)}</span>
            </div>
            <svg viewBox="0 0 220 60" className="w-full h-14" aria-label="Fortune over the last 14 world days">
              <polyline points={pts} fill="none" stroke={p.color} strokeWidth="1.5" />
            </svg>
            <div className="space-y-1 mt-2">
              <Bar label="Mood" v={a.mood} min={-100} color={a.mood >= 0 ? '#34d399' : '#f87171'} />
              <Bar label="Energy" v={a.energy} color="#60a5fa" />
              <Bar label="Rep" v={a.rep} min={-100} color="#fbbf24" />
              <Bar label="Corrupt" v={a.corruption} color="#e879f9" />
            </div>
            <p className="mt-2 text-[10px] font-mono text-[#6b7280]">{traitList(a.traits).join(' · ')}</p>
          </section>
        )}
        {rels.length > 0 && (
          <section>
            <span className="text-[10px] font-mono tracking-widest text-[#6b7280]">RELATIONS</span>
            <svg viewBox="0 0 240 150" className="w-full h-36 mt-1" aria-label="Strongest relationships">
              {rels.map((r, k) => {
                const ang = (k / rels.length) * Math.PI * 2 - Math.PI / 2;
                const x = 120 + Math.cos(ang) * 88, y = 75 + Math.sin(ang) * 54;
                const rp = profileOf(s, r.b.uid);
                return (
                  <g key={r.j} onClick={() => onFocus(r.b.uid)} className="cursor-pointer">
                    <line x1="120" y1="75" x2={x} y2={y} stroke={r.v >= 0 ? '#34d399' : '#f87171'} strokeWidth={1 + Math.abs(r.v) / 30} opacity="0.7" />
                    <circle cx={x} cy={y} r="5" fill={rp.color} />
                    <text x={x} y={y + (y > 75 ? 15 : -9)} textAnchor="middle" fontSize="9" fill="#9ca3af" fontFamily="monospace">{rp.name} {r.v > 0 ? '+' : ''}{r.v}</text>
                  </g>
                );
              })}
              <circle cx="120" cy="75" r="7" fill={p.color} />
            </svg>
          </section>
        )}
        {memory.length > 0 && (
          <section>
            <span className="text-[10px] font-mono tracking-widest text-[#6b7280]">MEMORY</span>
            <ul className="mt-1 space-y-1">
              {memory.map((e) => e && (
                <li key={e.seq} className="text-[#c8c5d8] leading-snug"><span className="text-[#4b5563] font-mono text-[9px] mr-1">{timeLabel(e.hour, e.minute)}</span>{eventText(s, e).title}</li>
              ))}
            </ul>
          </section>
        )}
        {secrets.length > 0 && (
          <section>
            <span className="text-[10px] font-mono tracking-widest text-[#6b7280]">SECRETS</span>
            <ul className="mt-1 space-y-1">
              {secrets.map((x) => (
                <li key={x.n} className={x.leaked ? 'text-[#f87171]' : 'text-[#9ca3af] blur-[4px] select-none'} aria-label={x.leaked ? x.n : 'Hidden secret'}>
                  {x.leaked ? `LEAKED — ${p.name} ${x.n}` : '█████ ███ ██████ ████'}
                </li>
              ))}
            </ul>
          </section>
        )}
        {votes.length > 0 && (
          <section>
            <span className="text-[10px] font-mono tracking-widest text-[#6b7280]">PAST VOTES</span>
            <p className="mt-1 text-[#c8c5d8]">{votes.map((u) => profileOf(s, u).name).join(' → ')}</p>
          </section>
        )}
        {!a && grave && <p className="text-[#9ca3af]">Estate at death: {money(grave.money)}. Buried in the Cemetery.</p>}
      </div>
    </aside>
  );
}
