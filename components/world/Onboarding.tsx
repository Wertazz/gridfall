'use client';

import { useEffect, useState } from 'react';
import { GENESIS_MS, MINUTE_MS } from '@/lib/sim/config';

const KEY = 'gridfall.onboarded';

/** First visit: black screen, one machine line, then the city. Under 5 seconds. */
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState(false);
  const [n, setN] = useState(0);
  const [fade, setFade] = useState(false);
  const hour = Math.max(0, Math.floor((Date.now() - GENESIS_MS) / MINUTE_MS / 60));
  const line = `> world hour ${hour}. no server is running this city. you are watching it anyway.`;

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(KEY) === '1'; } catch { seen = false; }
    if (seen) { onDone(); return; }
    setShow(true);
  }, [onDone]);

  useEffect(() => {
    if (!show) return;
    if (n < line.length) { const id = setTimeout(() => setN((k) => k + 1), 32); return () => clearTimeout(id); }
    const a = setTimeout(() => setFade(true), 700);
    const b = setTimeout(() => { try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ } setShow(false); onDone(); }, 1500);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [show, n, line.length, onDone]);

  if (!show) return null;
  return (
    <div
      className={`absolute inset-0 z-50 bg-black flex items-center justify-center px-6 transition-opacity duration-700 ${fade ? 'opacity-0' : 'opacity-100'}`}
      onClick={() => { setN(line.length); }}
      role="status" aria-live="polite"
    >
      <p className="font-mono text-[13px] sm:text-sm text-[#34d399] max-w-xl">
        {line.slice(0, n)}<span className="inline-block w-2 h-4 bg-[#34d399] align-middle ml-0.5 animate-pulse" />
      </p>
    </div>
  );
}
