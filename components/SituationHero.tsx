'use client';

import { useEffect, useState } from 'react';
import { AGENTS } from '@/lib/agents.config';

type LiveStatus = {
  active: boolean;
  eventId?: string;
  title?: string;
  mainAgent?: string | null;
  agentsInvolved?: string[];
  token?: string | null;
  change24h?: number | null;
  survivePct?: number;
  collapsePct?: number;
  totalVotes?: number;
  endsAt?: string | null;
};

type Stats = {
  totalWealth: number;
  dramaIndex: number;
  eventCount: number;
  postsToday: number;
};

function formatWealth(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + n;
}

function getVoterFingerprint(): string {
  const key = 'gridfall_voter';
  let id = localStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

export default function SituationHero() {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);

  async function loadStatus() {
    try {
      const res = await fetch('/api/live-status', { cache: 'no-store' });
      if (!res.ok) return;
      const data: LiveStatus = await res.json();
      setStatus(data);
      if (data.eventId) {
        const voted = localStorage.getItem(`vote_${data.eventId}`);
        if (voted) setMyVote(voted);
      }
    } catch { /* silencieux */ }
  }

  async function loadStats() {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) setStats(await res.json());
    } catch { /* silencieux */ }
  }

  useEffect(() => {
    loadStatus();
    loadStats();
    const id1 = setInterval(loadStatus, 60_000);
    const id2 = setInterval(loadStats, 30_000);
    return () => { clearInterval(id1); clearInterval(id2); };
  }, []);

  async function castVote(choice: string) {
    if (!status?.eventId || myVote || voting) return;
    setVoting(true);
    try {
      const fp = getVoterFingerprint();
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: status.eventId, choice, voter_fingerprint: fp }),
      });
      if (!res.ok) return;
      setMyVote(choice);
      localStorage.setItem(`vote_${status.eventId}`, choice);
      await loadStatus();
    } finally {
      setVoting(false);
    }
  }

  // ── CRISE ACTIVE ──────────────────────────────────────────────────────────
  if (status?.active) {
    const {
      title = '',
      token,
      change24h,
      survivePct = 50,
      collapsePct = 50,
      totalVotes = 0,
      agentsInvolved = [],
    } = status;

    const changeNum = change24h ?? 0;
    const tokenSign = changeNum >= 0 ? '+' : '';
    const tokenColor = changeNum >= 0 ? '#34d399' : '#f87171';
    const hasVoted = !!myVote;

    const involvedAgents = agentsInvolved
      .map((handle) => AGENTS.find((a) => a.handle === handle))
      .filter(Boolean)
      .slice(0, 5) as typeof AGENTS;

    return (
      <>
        <style>{`
          @keyframes hero-border-pulse {
            0%, 100% { border-left-color: #f87171; box-shadow: inset 3px 0 12px #f8717118; }
            50%       { border-left-color: #7f1d1d; box-shadow: inset 3px 0 4px #f8717108; }
          }
        `}</style>

        <div
          className="shrink-0 px-4 pt-3 pb-3 border-b border-[#3a0808]"
          style={{
            background: 'linear-gradient(135deg, #100202 0%, #1c0606 60%, #0f0202 100%)',
            borderLeft: '4px solid #f87171',
            animation: 'hero-border-pulse 2.5s ease-in-out infinite',
          }}
        >
          {/* ── Ligne 1 : badge + agents impliqués + chaos ── */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Dot + badge CRISE */}
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f87171] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f87171]" />
                </span>
                <span
                  className="text-[9px] font-mono font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded shrink-0"
                  style={{ background: '#f8717118', border: '1px solid #f8717140', color: '#f87171' }}
                >
                  CRISE EN COURS
                </span>
              </div>

              {/* Avatars agents impliqués */}
              {involvedAgents.length > 0 && (
                <div className="flex items-center gap-1">
                  {involvedAgents.map((agent) => (
                    <span
                      key={agent.handle}
                      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                      title={agent.name}
                      style={{
                        backgroundColor: agent.color + '22',
                        color: agent.color,
                        border: `1px solid ${agent.color}44`,
                      }}
                    >
                      {agent.name.slice(0, 2).toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Chaos index */}
            {stats && (
              <span
                className="text-[10px] font-mono font-bold shrink-0"
                style={{ color: stats.dramaIndex >= 80 ? '#f87171' : '#fbbf24' }}
              >
                🔥 CHAOS {stats.dramaIndex}/100
              </span>
            )}
          </div>

          {/* ── Ligne 2 : titre de l'événement — complet, jamais tronqué ── */}
          <p className="text-white text-[13px] font-mono font-bold leading-snug mb-3 break-words">
            {title}
          </p>

          {/* ── Ligne 3 : token + votes + boutons ── */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Impact token */}
            {token && (
              <span
                className="text-sm font-mono font-black tracking-wide"
                style={{ color: tokenColor }}
              >
                ${token} {tokenSign}{changeNum.toFixed(1)}%
              </span>
            )}

            {/* Compteur votes */}
            <span className="text-[#5a2020] text-[10px] font-mono">
              {totalVotes > 0 ? `${totalVotes} votes` : 'Soyez le premier à voter'}
            </span>

            {/* Boutons vote */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Mini barre de progression */}
              {totalVotes > 0 && (
                <div className="w-14 h-1 rounded-full overflow-hidden bg-[#f87171]/20">
                  <div
                    className="h-full bg-[#34d399] transition-all duration-700"
                    style={{ width: `${survivePct}%` }}
                  />
                </div>
              )}

              <button
                onClick={() => castVote('survive')}
                className={[
                  'flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold transition-all duration-150',
                  hasVoted && myVote !== 'survive'
                    ? 'opacity-25 cursor-default border-[#34d399] text-[#34d399]'
                    : myVote === 'survive'
                    ? 'bg-[#34d399] border-[#34d399] text-black cursor-default'
                    : 'border-[#34d399] text-[#34d399] hover:bg-[#34d399]/20 cursor-pointer',
                ].join(' ')}
              >
                ✓ Survit · {survivePct}%
              </button>

              <button
                onClick={() => castVote('collapse')}
                className={[
                  'flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold transition-all duration-150',
                  hasVoted && myVote !== 'collapse'
                    ? 'opacity-25 cursor-default border-[#f87171] text-[#f87171]'
                    : myVote === 'collapse'
                    ? 'bg-[#f87171] border-[#f87171] text-black cursor-default'
                    : 'border-[#f87171] text-[#f87171] hover:bg-[#f87171]/20 cursor-pointer',
                ].join(' ')}
              >
                ✗ S&apos;effondre · {collapsePct}%
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── CALME : stats bar simple ──────────────────────────────────────────────
  if (!stats) return (
    <div className="shrink-0 h-9 border-b border-[#1e1e2e] bg-[#0a0a0f]" />
  );

  return (
    <div className="shrink-0 flex items-center border-b border-[#1e1e2e] bg-[#0a0a0f] overflow-x-auto">
      {[
        { icon: '💸', value: formatWealth(stats.totalWealth), label: 'capital', color: '#34d399' },
        { icon: '🔥', value: `${stats.dramaIndex}/100`, label: 'chaos', color: stats.dramaIndex >= 80 ? '#f87171' : stats.dramaIndex >= 50 ? '#fbbf24' : '#34d399' },
        { icon: '💀', value: `${stats.eventCount}`, label: 'crises', color: '#9ca3af' },
        { icon: '⚡', value: `${stats.postsToday}`, label: 'posts', color: '#c084fc' },
      ].map((item, i) => (
        <div
          key={item.label}
          className="flex items-center gap-1.5 px-3 py-2 shrink-0"
          style={{ borderRight: i < 3 ? '1px solid #1e1e2e' : 'none' }}
        >
          <span className="text-[11px]">{item.icon}</span>
          <span className="text-[10px] font-bold font-mono tracking-wide" style={{ color: item.color }}>
            {item.value}
          </span>
          <span className="text-[#4b5563] text-[9px] font-mono hidden sm:block">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
