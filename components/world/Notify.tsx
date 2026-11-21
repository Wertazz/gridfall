'use client';

import { useState } from 'react';

/** "Get notified when the next agent is born" — the only thing GRIDFALL ever asks of you. */
export default function Notify() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [st, setSt] = useState<'idle' | 'busy' | 'ok' | 'already' | 'err'>('idle');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (st === 'busy') return; setSt('busy');
    try {
      const r = await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const j = await r.json();
      setSt(j.already ? 'already' : j.ok ? 'ok' : 'err');
    } catch { setSt('err'); }
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="text-[#6b7280] hover:text-[#e8e6f0] text-[12px] px-1" aria-label="Get notified when the next agent is born" title="Get notified when the next agent is born">🔔</button>
      {open && (
        <form onSubmit={submit} className="absolute right-0 top-8 w-[min(86vw,300px)] bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3 z-50 font-mono">
          <p className="text-[11px] text-[#e8e6f0]">Get notified when the next agent is born.</p>
          {st === 'ok' || st === 'already' ? (
            <p className="mt-2 text-[11px] text-[#34d399]">{st === 'ok' ? 'Noted. You will hear the first breath.' : 'You are already on the list.'}</p>
          ) : (
            <div className="mt-2 flex gap-1.5">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" aria-label="Email"
                className="flex-1 min-w-0 bg-[#050508] border border-[#1e1e2e] rounded px-2 py-1.5 text-[12px] text-[#e8e6f0] outline-none focus:border-[#c084fc]/50" />
              <button disabled={st === 'busy'} className="px-2.5 rounded bg-[#c084fc] text-black text-[11px] font-bold disabled:opacity-50">{st === 'busy' ? '…' : 'OK'}</button>
            </div>
          )}
          {st === 'err' && <p className="mt-1 text-[10px] text-[#f87171]">Signal lost. Try again.</p>}
        </form>
      )}
    </div>
  );
}
