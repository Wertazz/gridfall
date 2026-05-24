'use client';

import { useState } from 'react';

type LogLine = { ts: string; text: string; ok: boolean };

function ts() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [logs, setLogs]         = useState<LogLine[]>([]);
  const [busy, setBusy]         = useState(false);
  const [day, setDay]           = useState(2);

  // Simulation status state
  const [statusBusy,  setStatusBusy]  = useState(false);
  const [cdDays,      setCdDays]      = useState(7);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);

  function log(text: string, ok = true) {
    setLogs((prev) => [{ ts: ts(), text, ok }, ...prev]);
  }

  // ── Simulation actions ─────────────────────────────────────────
  async function postStatus(action: string, days?: number) {
    if (statusBusy || !adminKey) return;
    setStatusBusy(true);
    try {
      const res = await fetch('/api/admin/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: adminKey, action, days }),
      });
      const data = await res.json();
      if (res.status === 401) { log('[status] Wrong key', false); return; }
      if (!res.ok)            { log(`[status] Error: ${data.error ?? res.status}`, false); return; }
      setCurrentStatus(data.status);
      if (action === 'countdown') {
        log(`[status] countdown → ends ${new Date(data.countdown_end).toLocaleString()}`);
      } else {
        log(`[status] → ${data.status}`);
      }
    } catch (err) {
      log(`[status] Exception: ${String(err)}`, false);
    } finally {
      setStatusBusy(false);
    }
  }

  // ── Simulation reset actions ───────────────────────────────────
  async function post(action: string, extraDay?: number) {
    if (busy || !adminKey) return;
    setBusy(true);
    const payload = { key: adminKey, action, day: extraDay };
    console.log('[admin] → POST /api/admin/reset', { action, day: extraDay });
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('[admin] ← status', res.status);
      const data = await res.json();
      console.log('[admin] ← body', data);

      if (res.status === 401) { log('[auth] Wrong key', false); return; }
      if (!res.ok)            { log(`[${action}] Error: ${data.error ?? res.status}`, false); return; }

      if (action === 'reset') {
        log(`[reset] OK — launch_date=${data.new_launch_date ?? '?'}`);
        data.errors?.forEach((e: string) => log(`  ↳ ${e}`, false));
      } else if (action === 'reset_and_boot') {
        log(`[reset+boot] OK — launch_date=${data.new_launch_date ?? '?'}`);
        log(`  ↳ boot: ${data.boot?.published ?? 0} post(s) J1H0 published`);
        data.reset?.errors?.forEach((e: string) => log(`  ↳ reset: ${e}`, false));
        data.boot?.errors?.forEach((e: string) => log(`  ↳ boot: ${e}`, false));
      } else {
        log(`[jump J${extraDay}] ${data.published} post(s) published`);
        data.errors?.forEach((e: string) => log(`  ↳ ${e}`, false));
      }
    } catch (err) {
      console.error('[admin] exception:', err);
      log(`[${action}] Exception: ${String(err)}`, false);
    } finally {
      setBusy(false);
    }
  }

  async function handleBoot() {
    if (!confirm('Full reset + publish Day 1 Hour 0 posts?')) return;
    log('Reset + boot J1H0…');
    await post('reset_and_boot');
  }

  async function handleReset() {
    if (!confirm('Full reset (empty DB, no posts published)?')) return;
    log('Reset only…');
    await post('reset');
  }

  async function handleJump() {
    if (!confirm(`Publish all posts up to Day ${day} (no reset)?`)) return;
    log(`Jump to Day ${day}…`);
    await post('jump', day);
  }

  const locked       = !adminKey || busy;
  const statusLocked = !adminKey || statusBusy;

  const statusColor: Record<string, string> = {
    coming_soon: '#fbbf24',
    countdown:   '#f87171',
    live:        '#34d399',
  };

  return (
    <div
      className="min-h-screen bg-[#0a0a0f] text-[#e8e6f0] p-6"
      style={{ fontFamily: "'Space Mono', monospace" }}
    >
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <p className="text-[#f87171] text-[10px] tracking-[0.4em] uppercase mb-1">
            RESTRICTED AREA
          </p>
          <h1 className="text-2xl font-bold text-[#c084fc]" style={{ textShadow: '0 0 20px #c084fc55' }}>
            GRIDFALL — Admin
          </h1>
          <p className="text-[#4b5563] text-xs mt-1">
            Simulation control panel
          </p>
        </div>

        {/* Admin key */}
        <div className="border border-[#1e1e2e] rounded bg-[#0d0d14] p-4 mb-6">
          <label className="text-[#9ca3af] text-[10px] tracking-widest uppercase block mb-2">
            Admin key
          </label>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="••••••••••••••••"
            className="w-full bg-[#050505] border border-[#1e1e2e] rounded px-3 py-2 text-sm text-[#e8e6f0] outline-none focus:border-[#c084fc]/40 transition-colors"
          />
        </div>

        {/* ── SIMULATION STATUS ────────────────────────────────────── */}
        <div className="border border-[#c084fc]/20 rounded bg-[#08060f] p-4 mb-6">
          <h2 className="text-[#c084fc] text-[10px] tracking-widest uppercase mb-4 flex items-center gap-2">
            ◆ Simulation Status
            {currentStatus && (
              <span
                className="text-[9px] px-2 py-0.5 rounded border font-bold"
                style={{
                  color: statusColor[currentStatus] ?? '#9ca3af',
                  borderColor: (statusColor[currentStatus] ?? '#9ca3af') + '40',
                  backgroundColor: (statusColor[currentStatus] ?? '#9ca3af') + '10',
                }}
              >
                {currentStatus.replace('_', ' ').toUpperCase()}
              </span>
            )}
          </h2>

          <div className="space-y-3">
            {/* Row 1 — Coming Soon + Go Live */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => postStatus('coming_soon')}
                disabled={statusLocked}
                className="px-4 py-2 text-sm font-bold border border-[#fbbf24]/40 text-[#fbbf24] rounded hover:bg-[#fbbf24]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {statusBusy ? '...' : '○ Set: Coming Soon'}
              </button>

              <button
                onClick={() => {
                  if (!confirm('Switch site to LIVE mode? The feed will be visible to all visitors.')) return;
                  postStatus('live');
                }}
                disabled={statusLocked}
                className="px-4 py-2 text-sm font-bold border border-[#34d399]/40 text-[#34d399] rounded hover:bg-[#34d399]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {statusBusy ? '...' : '▶ Go Live'}
              </button>
            </div>

            {/* Row 2 — Launch Countdown */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={cdDays}
                  onChange={(e) => setCdDays(parseInt(e.target.value, 10) || 1)}
                  className="w-20 bg-[#050505] border border-[#1e1e2e] rounded px-3 py-2 text-sm text-[#e8e6f0] outline-none focus:border-[#c084fc]/40"
                />
                <span className="text-[#4b5563] text-xs">days</span>
              </div>
              <button
                onClick={() => {
                  if (!confirm(`Start a ${cdDays}-day countdown?`)) return;
                  postStatus('countdown', cdDays);
                }}
                disabled={statusLocked}
                className="px-4 py-2 text-sm font-bold border border-[#f87171]/40 text-[#f87171] rounded hover:bg-[#f87171]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {statusBusy ? '...' : '⏱ Launch Countdown'}
              </button>
            </div>
          </div>

          <p className="text-[#2a2a3a] text-[10px] mt-4 leading-relaxed">
            Coming Soon → shows landing page, no countdown.<br />
            Countdown → shows landing page with live timer.<br />
            Live → shows the full feed to all visitors.
          </p>
        </div>

        {/* ── SIMULATION ACTIONS ───────────────────────────────────── */}
        <div className="space-y-4 mb-8">

          {/* ⟳ Clean launch (main action) */}
          <div className="border border-[#00ff88]/20 rounded bg-[#050f05] p-4">
            <h2 className="text-[#00ff88] text-[10px] tracking-widest uppercase mb-2">
              ⟳ Clean launch — main action
            </h2>
            <p className="text-[#4b5563] text-xs mb-4">
              Full DB reset, then publish Day 1 Hour 0 posts only.
              The scheduler will take over hour by hour.
            </p>
            <button
              onClick={handleBoot}
              disabled={locked}
              className="px-5 py-2.5 text-sm font-bold border border-[#00ff88]/50 text-[#00ff88] rounded hover:bg-[#00ff88]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ boxShadow: locked ? 'none' : '0 0 12px #00ff8820' }}
            >
              {busy ? '...' : '⟳ Reset + Launch J1'}
            </button>
          </div>

          {/* Reset only */}
          <div className="border border-[#1e1e2e] rounded bg-[#0d0d14] p-4">
            <h2 className="text-[#9ca3af] text-[10px] tracking-widest uppercase mb-2">
              Reset only (empty DB)
            </h2>
            <p className="text-[#4b5563] text-xs mb-4">
              Clears the entire DB without publishing posts.
              Use if you want to trigger the scheduler manually.
            </p>
            <button
              onClick={handleReset}
              disabled={locked}
              className="px-4 py-2 text-sm font-bold border border-[#f87171]/40 text-[#f87171] rounded hover:bg-[#f87171]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {busy ? '...' : '⚠ Reset only'}
            </button>
          </div>

          {/* Debug jump */}
          <div className="border border-[#1e1e2e] rounded bg-[#0d0d14] p-4">
            <h2 className="text-[#9ca3af] text-[10px] tracking-widest uppercase mb-2">
              Debug jump
            </h2>
            <p className="text-[#4b5563] text-xs mb-4">
              Publish all story posts up to the end of the selected day (no reset).
              Useful for testing a specific scene.
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
                {busy ? '...' : `→ Jump J${day}`}
              </button>
            </div>
          </div>

        </div>

        {/* Terminal log */}
        <div className="border border-[#1e1e2e] rounded bg-[#050505] p-4 min-h-40">
          <div className="text-[#4b5563] text-[10px] tracking-widest uppercase mb-3">Log</div>
          {logs.length === 0 ? (
            <p className="text-[#1e1e2e] text-xs">Waiting for an action…</p>
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
          DO NOT SHARE THIS URL
        </p>
      </div>
    </div>
  );
}
