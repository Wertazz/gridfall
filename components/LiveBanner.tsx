'use client';

import { useEffect, useState } from 'react';

type LiveStatus = {
  active: boolean;
  lastTitle?: string | null;
  eventId?: string;
  title?: string;
  mainAgent?: string | null;
  token?: string | null;
  change24h?: number | null;
  survivePct?: number;
  collapsePct?: number;
  totalVotes?: number;
  endsAt?: string | null;
};

function getVoterFingerprint(): string {
  const key = 'gridfall_voter';
  let id = localStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

export default function LiveBanner() {
  const [status, setStatus] = useState<LiveStatus | null>(null);
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

  useEffect(() => {
    loadStatus();
    const id = setInterval(loadStatus, 60_000);
    return () => clearInterval(id);
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

  // ── M8 : si pas d'event actif mais un event terminé, afficher en gris ──────
  if (!status?.active) {
    if (!status?.lastTitle) return null;
    return (
      <div
        className="shrink-0 flex items-center gap-2 px-3 border-b border-[#1e1e2e]"
        style={{ background: '#0d0d14', minHeight: '32px' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#374151] shrink-0" />
        <span className="text-[#4b5563] text-[10px] font-mono uppercase tracking-widest shrink-0">
          Terminé
        </span>
        <span className="text-[#374151] select-none shrink-0">·</span>
        <span className="text-[#6b7280] text-[11px] font-mono truncate min-w-0">
          {status.lastTitle}
        </span>
      </div>
    );
  }

  const {
    title,
    token,
    change24h,
    survivePct = 50,
    collapsePct = 50,
  } = status;

  const changeNum = change24h ?? 0;
  const tokenSign = changeNum >= 0 ? '+' : '';
  const tokenColor = changeNum >= 0 ? '#34d399' : '#f87171';
  const hasVoted = !!myVote;

  return (
    <>
      <style>{`
        @keyframes live-border-pulse {
          0%, 100% { border-left-color: #f87171; }
          50%       { border-left-color: #f8717155; }
        }
      `}</style>

      <div
        className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-[#3a0808]"
        style={{
          background: '#1a0505',
          borderLeft: '3px solid #f87171',
          animation: 'live-border-pulse 2s ease-in-out infinite',
          minHeight: '40px',
        }}
      >
        {/* Dot pulsant */}
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f87171] opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#f87171]" />
        </span>

        {/* LIVE */}
        <span className="text-[#f87171] text-[10px] font-mono font-bold tracking-widest uppercase shrink-0">
          LIVE
        </span>
        <span className="text-[#5a1515] select-none shrink-0">·</span>

        {/* Titre */}
        <span className="text-white text-[11px] font-mono font-semibold truncate min-w-0">
          {title}
        </span>

        {/* Token */}
        {token && (
          <>
            <span className="text-[#5a1515] select-none shrink-0 hidden sm:inline">·</span>
            <span
              className="text-[11px] font-mono font-bold shrink-0 hidden sm:inline"
              style={{ color: tokenColor }}
            >
              ${token} {tokenSign}{changeNum.toFixed(1)}%
            </span>
          </>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Boutons de vote */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Survit */}
          <button
            onClick={() => castVote('survive')}
            disabled={hasVoted || voting}
            className={[
              'flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold transition-all duration-150',
              hasVoted && myVote !== 'survive'
                ? 'opacity-30 cursor-default border-[#34d399] text-[#34d399]'
                : myVote === 'survive'
                ? 'bg-[#34d399] border-[#34d399] text-black cursor-default'
                : 'border-[#34d399] text-[#34d399] hover:bg-[#34d399]/20 cursor-pointer',
            ].join(' ')}
          >
            ✓ Survit · {survivePct}%
          </button>

          {/* S'effondre */}
          <button
            onClick={() => castVote('collapse')}
            disabled={hasVoted || voting}
            className={[
              'flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold transition-all duration-150',
              hasVoted && myVote !== 'collapse'
                ? 'opacity-30 cursor-default border-[#f87171] text-[#f87171]'
                : myVote === 'collapse'
                ? 'bg-[#f87171] border-[#f87171] text-black cursor-default'
                : 'border-[#f87171] text-[#f87171] hover:bg-[#f87171]/20 cursor-pointer',
            ].join(' ')}
          >
            ✗ S&apos;effondre · {collapsePct}%
          </button>
        </div>
      </div>
    </>
  );
}
