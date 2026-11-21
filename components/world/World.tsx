'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorldEngine, type View, type TimeMode } from '@/lib/world/engine';
import { computeBubbles } from '@/lib/lines/bubbles';
import { GENESIS_MS, MINUTE_MS } from '@/lib/sim/config';
import WorldCanvas from './WorldCanvas';
import TopBar from './TopBar';
import Wire from './Wire';
import Dossier from './Dossier';
import Politics from './Politics';
import Ruin from './Ruin';
import Timeline from './Timeline';
import { startPresence } from '@/lib/world/presence';
import { eyesBubbles } from '@/lib/lines/fourth-wall';
import Onboarding from './Onboarding';
import { RUIN_SPOTS, GRAVE_SPOTS, TILE } from '@/lib/micro/map';

type Props = { fixedT?: number | null; focus?: string | null };

export function permalink(tMs: number, handle?: string) {
  const iso = new Date(Math.floor(tMs / 1000) * 1000).toISOString().replace('.000Z', 'Z');
  return `${window.location.origin}/t/${iso}${handle ? `?focus=${encodeURIComponent(handle)}` : ''}`;
}

export default function World({ fixedT = null, focus: focusProp = null }: Props) {
  const [focus] = useState<string | null>(() => focusProp ?? new URLSearchParams(window.location.search).get('focus'));
  const engine = useMemo(() => new WorldEngine(), []);
  const [view, setView] = useState<View | null>(null);
  const [selected, setSelected] = useState(-1);
  const [wireOpen, setWireOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [polOpen, setPolOpen] = useState(false);
  const [ruin, setRuin] = useState<number | null>(null);
  const [observers, setObservers] = useState<number | null>(null);
  const [mode, setMode] = useState<TimeMode>(fixedT ? { kind: 'fixed', t: fixedT } : { kind: 'live' });

  useEffect(() => { engine.mode = mode.kind === 'fixed' ? { ...mode, at: Date.now() } : mode; }, [engine, mode]);
  const glitch = mode.kind === 'oracle' ? 18 + Math.floor(mode.ahead / 30_000) : 0;
  useEffect(() => { engine.bubbleSource = (v) => computeBubbles(v, glitch ? [] : eyesBubbles(v, engine.eyes), glitch); }, [engine, glitch]);
  useEffect(() => {
    const h = startPresence({
      getCamera: () => (engine.renderer ? { x: engine.renderer.cam.x, y: engine.renderer.cam.y } : null),
      onEyes: (eyes, n) => { engine.eyes = eyes; setObservers(n); },
    });
    return () => h.stop();
  }, [engine]);
  useEffect(() => engine.subscribe(setView), [engine]);
  useEffect(() => { engine.selected = selected; }, [engine, selected]);
  useEffect(() => { if (typeof window !== 'undefined' && window.innerWidth >= 1024) setWireOpen(true); }, []);

  // ?focus=handle → select and follow once the world is computed.
  useEffect(() => {
    if (!focus || !view || selected >= 0) return;
    const p = Array.from(view.profiles.values()).find((x) => x.handle === focus);
    if (p) { setSelected(p.uid); engine.follow = true; }
  }, [focus, view, selected, engine]);

  // After the first-visit line: zoom from the whole map into the heart of the city.
  const onboarded = useCallback(() => {
    const zoomIn = (k: number) => {
      const R = engine.renderer; if (!R) { setTimeout(() => zoomIn(k), 100); return; }
      if (k === 0) R.cam.z = R.cam.minZ;
      else if (R.cam.z < Math.min(R.cam.maxZ, R.cam.minZ + 1)) R.cam.z++;
      R.cam.clamp(R.w, R.h);
      if (k < 3) setTimeout(() => zoomIn(k + 1), 350);
    };
    if (!fixedT && !focus) zoomIn(0);
  }, [engine, fixedT, focus]);

  const onSelect = useCallback((uid: number, wx: number, wy: number) => {
    engine.follow = false;
    if (uid >= 0) { setSelected(uid); return; }
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    const r = RUIN_SPOTS.find((s) => (tx === s.x || tx === s.x + 1) && (ty === s.y || ty === s.y - 1));
    if (r) { setRuin(r.day); return; }
    const v = engine.view();
    const gi = GRAVE_SPOTS.findIndex((g) => g.x === tx && (g.y === ty || g.y === ty + 1));
    if (v && gi >= 0) {
      const first = v.cur.deaths - v.cur.graves.length;
      const g = v.cur.graves.find((_, k) => (first + k) % GRAVE_SPOTS.length === gi);
      if (g) { setSelected(g.uid); return; }
    }
    setSelected(-1);
  }, [engine]);
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
      <TopBar view={view} observers={observers} mode={mode.kind} wireOpen={wireOpen} onWire={() => setWireOpen((o) => !o)} onPolitics={() => setPolOpen((o) => !o)} />
      {polOpen && <Politics view={view} onFocus={(u) => { onFocus(u); setPolOpen(false); }} onClose={() => setPolOpen(false)} />}
      {wireOpen && <Wire view={view} glitch={glitch} onFocus={onFocus} onClip={clipEvent} onClose={() => setWireOpen(false)} />}
      {selected >= 0 && <Dossier view={view} uid={selected} onClose={() => { setSelected(-1); engine.follow = false; }} onFocus={onFocus} onClip={(uid) => view && share(view.tMs, uid)} />}
      <Timeline mode={mode} viewT={view && mode.kind !== 'live' ? view.tMs : null} onMode={setMode} />
      <Onboarding onDone={onboarded} />
      {ruin !== null && <Ruin day={ruin} onClose={() => setRuin(null)} />}
      {!view && <div className="absolute inset-0 flex items-center justify-center text-[#4b5563] text-xs font-mono">computing the world…</div>}
      {toast && <div className="absolute z-40 top-14 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded bg-[#c084fc] text-black text-[11px] font-mono font-bold">{toast}</div>}
    </main>
  );
}
