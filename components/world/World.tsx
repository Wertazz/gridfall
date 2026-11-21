'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorldEngine, type View, type TimeMode } from '@/lib/world/engine';
import { computeBubbles } from '@/lib/lines/bubbles';
import { GENESIS_MS, MINUTE_MS } from '@/lib/sim/config';
import WorldCanvas from './WorldCanvas';
import TopBar from './TopBar';
import Wire from './Wire';
import Dossier from './Dossier';

type Props = { fixedT?: number | null; focus?: string | null };

export function permalink(tMs: number, handle?: string) {
  const iso = new Date(Math.floor(tMs / 1000) * 1000).toISOString().replace('.000Z', 'Z');
  return `${window.location.origin}/t/${iso}${handle ? `?focus=${encodeURIComponent(handle)}` : ''}`;
}

export default function World({ fixedT = null, focus = null }: Props) {
  const engine = useMemo(() => new WorldEngine(), []);
  const [view, setView] = useState<View | null>(null);
  const [selected, setSelected] = useState(-1);
  const [wireOpen, setWireOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mode] = useState<TimeMode>(fixedT ? { kind: 'fixed', t: fixedT } : { kind: 'live' });

  useEffect(() => { engine.mode = mode; }, [engine, mode]);
  useEffect(() => { engine.bubbleSource = (v) => computeBubbles(v); }, [engine]);
  useEffect(() => engine.subscribe(setView), [engine]);
  useEffect(() => { engine.selected = selected; }, [engine, selected]);
  useEffect(() => { if (typeof window !== 'undefined' && window.innerWidth >= 1024) setWireOpen(true); }, []);

  // ?focus=handle → select and follow once the world is computed.
  useEffect(() => {
    if (!focus || !view || selected >= 0) return;
    const p = Array.from(view.profiles.values()).find((x) => x.handle === focus);
    if (p) { setSelected(p.uid); engine.follow = true; }
  }, [focus, view, selected, engine]);

  const onSelect = useCallback((uid: number) => { setSelected(uid); engine.follow = false; }, [engine]);
  const onFocus = useCallback((uid: number) => { setSelected(uid); engine.follow = true; }, [engine]);

  const share = useCallback(async (tMs: number, uid: number) => {
    const handle = uid >= 0 && view ? view.profiles.get(uid)?.handle : undefined;
    const url = permalink(tMs, handle);
    try {
      if (navigator.share && window.innerWidth < 768) await navigator.share({ url, title: 'GRIDFALL' });
      else { await navigator.clipboard.writeText(url); setToast('Permalink copied'); setTimeout(() => setToast(null), 1800); }
    } catch { /* user cancelled */ }
  }, [view]);
  const clipEvent = useCallback((hour: number, minute: number, uid: number) => share(GENESIS_MS + (hour * 60 + minute) * MINUTE_MS, uid), [share]);

  return (
    <main className="fixed inset-0 bg-[#050508] overflow-hidden">
      <WorldCanvas engine={engine} onSelect={onSelect} />
      <TopBar view={view} observers={null} mode={mode.kind} wireOpen={wireOpen} onWire={() => setWireOpen((o) => !o)} />
      {wireOpen && <Wire view={view} onFocus={onFocus} onClip={clipEvent} onClose={() => setWireOpen(false)} />}
      {selected >= 0 && <Dossier view={view} uid={selected} onClose={() => { setSelected(-1); engine.follow = false; }} onFocus={onFocus} onClip={(uid) => view && share(view.tMs, uid)} />}
      {!view && <div className="absolute inset-0 flex items-center justify-center text-[#4b5563] text-xs font-mono">computing the world…</div>}
      {toast && <div className="absolute z-40 top-14 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded bg-[#c084fc] text-black text-[11px] font-mono font-bold">{toast}</div>}
    </main>
  );
}
