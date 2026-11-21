'use client';

import { useEffect, useState } from 'react';
import { GENESIS_MS, MINUTE_MS } from '@/lib/sim/config';
import { StateStore } from '@/lib/world/store';
import { stateHash } from '@/lib/sim/state';

export default function ProofHash() {
  const [out, setOut] = useState<{ hash: string; hour: number; t: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const store = new StateStore();
    const compute = async () => {
      const t = Date.now();
      const hour = Math.floor((t - GENESIS_MS) / MINUTE_MS / 60) + 1;
      if (!store.ready) await store.init(hour);
      let s = store.get(hour);
      if (!s) { await store.seek(hour); s = store.get(hour); }
      if (s && alive) setOut({ hash: stateHash(s), hour, t: new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' });
    };
    void compute();
    const id = setInterval(compute, 15_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return (
    <div className="mt-10 border border-[#1e1e2e] rounded p-5">
      <p className="text-[10px] tracking-[0.3em] text-[#4b5563]">WORLD STATE — WORLD HOUR {out?.hour ?? '…'}</p>
      <p className="mt-2 text-2xl sm:text-3xl text-[#c084fc] tabular-nums break-all" style={{ textShadow: '0 0 24px #c084fc55' }} data-testid="proof-hash">#{out?.hash ?? '················'}</p>
      <p className="mt-2 text-[10px] text-[#4b5563]">computed in this browser at {out?.t ?? '…'} · changes every 5 real minutes</p>
    </div>
  );
}
