'use client';

import { useState } from 'react';

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY ?? '';

type LogLine = { ts: string; text: string; ok: boolean };

function ts() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AdminPage() {
  const [logs, setLogs]     = useState<LogLine[]>([]);
  const [busy, setBusy]     = useState(false);
  const [day, setDay]       = useState(1);

  function log(text: string, ok = true) {
    setLogs((prev) => [{ ts: ts(), text, ok }, ...prev]);
  }

  async function call(action: string, extraParams?: Record<string, string>) {
    if (busy) return;
    setBusy(true);
    const params = new URLSearchParams({ key: ADMIN_KEY, action, ...extraParams });
    try {
      const res = await fetch(`/api/admin/reset?${params}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        log(`[${action}] ERREUR : ${data.error ?? res.status}`, false);
      } else if (action === 'reset') {
        log(`[reset] OK — launch_date=${data.new_launch_date ?? '?'}`);
        if (data.errors?.length) data.errors.forEach((e: string) => log(`  ↳ ${e}`, false));
      } else {
        log(`[jump j${extraParams?.day}] ${data.published} post(s) publiés`);
        if (data.errors?.length) data.errors.forEach((e: string) => log(`  ↳ ${e}`, false));
      }
    } catch (err) {
      log(`[${action}] Exception : ${String(err)}`, false);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!confirm('Remettre la simulation à zéro (J1) ?')) return;
    log('Lancement reset-world…');
    await call('reset');
  }

  async function handleJump() {
    log(`Saut au Jour ${day}…`);
    await call('jump', { day: String(day) });
  }

  async function handleResetThenJump() {
    if (!confirm(`Reset complet puis sauter au Jour ${day} ?`)) return;
    log('Lancement reset-world…');
    await call('reset');
    log(`Saut au Jour ${day}…`);
    await call('jump', { day: String(day) });
  }

  return (
    <div
      className="min-h-screen bg-[#0a0a0f] text-[#e8e6f0] p-6"
      style={{ fontFamily: "'Space Mono', monospace" }}
    >
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <p className="text-[#f87171] text-[10px] tracking-[0.4em] uppercase mb-1">
            ZONE RESTREINTE
          </p>
          <h1 className="text-2xl font-bold text-[#c084fc]" style={{ textShadow: '0 0 20px #c084fc55' }}>
            GRIDFALL — Admin
          </h1>
          <p className="text-[#4b5563] text-xs mt-1">
            Panneau de contrôle de la simulation
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-4 mb-8">

          {/* Reset */}
          <div className="border border-[#1e1e2e] rounded bg-[#0d0d14] p-4">
            <h2 className="text-[#9ca3af] text-[10px] tracking-widest uppercase mb-3">
              Reset simulation
            </h2>
            <p className="text-[#4b5563] text-xs mb-4">
              Supprime posts, events, price_history, wealth_snapshots, portfolios, story_log.
              Remet les agents à wealth=1000, followers aléatoires, lance_date=now.
            </p>
            <button
              onClick={handleReset}
              disabled={busy}
              className="px-4 py-2 text-sm font-bold border border-[#f87171]/40 text-[#f87171] rounded hover:bg-[#f87171]/10 transition-colors disabled:opacity-40"
            >
              {busy ? '...' : '⚠ Reset Jour 1'}
            </button>
          </div>

          {/* Jump to day */}
          <div className="border border-[#1e1e2e] rounded bg-[#0d0d14] p-4">
            <h2 className="text-[#9ca3af] text-[10px] tracking-widest uppercase mb-3">
              Sauter au jour
            </h2>
            <p className="text-[#4b5563] text-xs mb-4">
              Publie tous les posts story jusqu&apos;au jour sélectionné (sans reset).
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={30}
                value={day}
                onChange={(e) => setDay(parseInt(e.target.value, 10) || 1)}
                className="w-20 bg-[#050505] border border-[#1e1e2e] rounded px-3 py-2 text-sm text-[#e8e6f0] outline-none focus:border-[#c084fc]/40"
              />
              <button
                onClick={handleJump}
                disabled={busy}
                className="px-4 py-2 text-sm font-bold border border-[#c084fc]/40 text-[#c084fc] rounded hover:bg-[#c084fc]/10 transition-colors disabled:opacity-40"
              >
                {busy ? '...' : `→ Sauter J${day}`}
              </button>
              <button
                onClick={handleResetThenJump}
                disabled={busy}
                className="px-4 py-2 text-sm font-bold border border-[#00ff88]/30 text-[#00ff88] rounded hover:bg-[#00ff88]/10 transition-colors disabled:opacity-40"
              >
                {busy ? '...' : `⟳ Reset + J${day}`}
              </button>
            </div>
          </div>

        </div>

        {/* Terminal log */}
        <div className="border border-[#1e1e2e] rounded bg-[#050505] p-4 min-h-40">
          <div className="text-[#4b5563] text-[10px] tracking-widest uppercase mb-3">
            Log
          </div>
          {logs.length === 0 ? (
            <p className="text-[#1e1e2e] text-xs">En attente d&apos;une action…</p>
          ) : (
            <div className="space-y-1">
              {logs.map((l, i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <span className="text-[#374151] shrink-0">{l.ts}</span>
                  <span style={{ color: l.ok ? '#00ff88' : '#f87171' }}>{l.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[#1e1e2e] text-[10px] text-center mt-6 tracking-widest">
          NE PAS PARTAGER CETTE URL
        </p>
      </div>
    </div>
  );
}
