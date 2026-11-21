'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorldEngine, type View, type TimeMode } from '@/lib/world/engine';
import WorldCanvas from './WorldCanvas';
import TopBar from './TopBar';

type Props = { fixedT?: number | null; focus?: string | null };

export default function World({ fixedT = null }: Props) {
  const engine = useMemo(() => new WorldEngine(), []);
  const [view, setView] = useState<View | null>(null);
  const [selected, setSelected] = useState(-1);
  const [wireOpen, setWireOpen] = useState(false);
  const [mode, setMode] = useState<TimeMode>(fixedT ? { kind: 'fixed', t: fixedT } : { kind: 'live' });

  useEffect(() => { engine.mode = mode; }, [engine, mode]);
  useEffect(() => engine.subscribe(setView), [engine]);
  useEffect(() => { engine.selected = selected; }, [engine, selected]);

  const onSelect = useCallback((uid: number) => setSelected(uid), []);

  return (
    <main className="fixed inset-0 bg-[#050508] overflow-hidden">
      <WorldCanvas engine={engine} onSelect={onSelect} />
      <TopBar view={view} observers={null} mode={mode.kind} wireOpen={wireOpen} onWire={() => setWireOpen((o) => !o)} />
      {!view && (
        <div className="absolute inset-0 flex items-center justify-center text-[#4b5563] text-xs font-mono">
          computing the world…
        </div>
      )}
      <button className="hidden" onClick={() => setMode({ kind: 'live' })} />
    </main>
  );
}
