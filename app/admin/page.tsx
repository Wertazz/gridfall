'use client';

import { useState } from 'react';

type LogLine = { ts: string; text: string; ok: boolean };

function ts() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [logs, setLogs]         = useState<LogLine[]>([]);
  const [busy, setBusy]         = useState(false);
  const [day, setDay]           = useState(2);

  function log(text: string, ok = true) {
    setLogs((prev) => [{ ts: ts(), text, ok }, ...prev]);
  }

  async function post(action: string, extraDay?: number) {
    if (busy || !adminKey) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: adminKey, action, day: extraDay }),
      });
      const data = await res.json();
      if (res.status === 401) { log('[auth] Clé incorrecte', false); return; }
      if (!res.ok) { log(`[${action}] ERREUR : ${data.error ?? res.status}`, false); return; }

      if (action === 'reset') {
        log(`[reset] OK — launch_date=${data.new_launch_date ?? '?'}`);
        data.errors?.forEach((e: string) => log(`  ↳ ${e}`, false));

      } else if (action === 'reset_and_boot') {
        log(`[reset+boot] OK — launch_date=${data.new_launch_date ?? '?'}`);
        log(`  ↳ boot : ${data.boot?.published ?? 0} post(s) J1H0 publiés`);
        data.reset?.errors?.forEach((e: string) => log(`  ↳ reset: ${e}`, false));
        data.boot?.errors?.forEach((e: string) => log(`  ↳ boot: ${e}`, false));

      } else {
        log(`[jump J${extraDay}] ${data.published} post(s) publiés`);
        data.errors?.forEach((e: string) => log(`  ↳ ${e}`, false));
      }
    } catch (err) {
      log(`[${action}] Exception : ${String(err)}`, false);
    } finally {
      setBusy(false);
    }
  }

  async function handleBoot() {
    if (!confirm('Reset complet + publier les posts du Jour 1 Heure 0 ?')) return;
    log('Reset + boot J1H0…');
    await post('reset_and_boot');
  }

  async function handleReset() {
    if (!confirm('Reset complet (DB vide, aucun post publié) ?')) return;
    log('Reset seul…');
    await post('reset');
  }

  async function handleJump() {
    if (!confirm(`Publier tous les posts jusqu'au Jour ${day} (sans reset) ?`)) return;
    log(`Saut au Jour ${day}…`);
    await post('jump', day);
  }

  const locked = !adminKey || busy;

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

        {/* Clé admin */}
        <div className="border border-[#1e1e2e] rounded bg-[#0d0d14] p-4 mb-6">
          <label className="text-[#9ca3af] text-[10px] tracking-widest uppercase block mb-2">
            Clé admin
          </label>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="••••••••••••••••"
            className="w-full bg-[#050505] border border-[#1e1e2e] rounded px-3 py-2 text-sm text-[#e8e6f0] outline-none focus:border-[#c084fc]/40 transition-colors"
          />
        </div>

        {/* Actions */}
        <div className="space-y-4 mb-8">

          {/* ⟳ Lancement propre (action principale) */}
          <div className="border border-[#00ff88]/20 rounded bg-[#050f05] p-4">
            <h2 className="text-[#00ff88] text-[10px] tracking-widest uppercase mb-2">
              ⟳ Lancement propre — action principale
            </h2>
            <p className="text-[#4b5563] text-xs mb-4">
              Reset complet de la DB, puis publication des posts du Jour 1 Heure 0 uniquement.
              Le scheduler prendra le relais heure par heure.
            </p>
            <button
              onClick={handleBoot}
              disabled={locked}
              className="px-5 py-2.5 text-sm font-bold border border-[#00ff88]/50 text-[#00ff88] rounded hover:bg-[#00ff88]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ boxShadow: locked ? 'none' : '0 0 12px #00ff8820' }}
            >
              {busy ? '...' : '⟳ Reset + Lancer J1'}
            </button>
          </div>

          {/* Reset seul */}
          <div className="border border-[#1e1e2e] rounded bg-[#0d0d14] p-4">
            <h2 className="text-[#9ca3af] text-[10px] tracking-widest uppercase mb-2">
              Reset seul (DB vide)
            </h2>
            <p className="text-[#4b5563] text-xs mb-4">
              Vide toute la DB sans publier de posts. À utiliser si tu veux déclencher
              le scheduler manuellement ensuite.
            </p>
            <button
              onClick={handleReset}
              disabled={locked}
              className="px-4 py-2 text-sm font-bold border border-[#f87171]/40 text-[#f87171] rounded hover:bg-[#f87171]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {busy ? '...' : '⚠ Reset seul'}
            </button>
          </div>

          {/* Saut à un jour (debug) */}
          <div className="border border-[#1e1e2e] rounded bg-[#0d0d14] p-4">
            <h2 className="text-[#9ca3af] text-[10px] tracking-widest uppercase mb-2">
              Saut de débogage
            </h2>
            <p className="text-[#4b5563] text-xs mb-4">
              Publie tous les posts story jusqu&apos;à la fin du jour sélectionné (sans reset).
              Utile pour tester une scène spécifique.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
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
                disabled={locked}
                className="px-4 py-2 text-sm font-bold border border-[#c084fc]/40 text-[#c084fc] rounded hover:bg-[#c084fc]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {busy ? '...' : `→ Sauter J${day}`}
              </button>
            </div>
          </div>

        </div>

        {/* Terminal log */}
        <div className="border border-[#1e1e2e] rounded bg-[#050505] p-4 min-h-40">
          <div className="text-[#4b5563] text-[10px] tracking-widest uppercase mb-3">Log</div>
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
