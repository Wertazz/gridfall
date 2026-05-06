'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import type { ActiveEvent } from '@/lib/types';

type VoteCounts = { survive: number; collapse: number };
type CountdownResult = { label: string; expired: boolean };

function useCountdown(endsAt: string | null | undefined): CountdownResult {
  const [result, setResult] = useState<CountdownResult>({ label: '', expired: false });

  useEffect(() => {
    if (!endsAt) {
      setResult({ label: 'En cours', expired: false });
      return;
    }

    function compute() {
      const diff = new Date(endsAt!).getTime() - Date.now();
      if (diff <= 0) { setResult({ label: 'Terminé', expired: true }); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setResult({ label: h > 0 ? `${h}h ${m}m` : `${m}m`, expired: false });
    }

    compute();
    const id = setInterval(compute, 30_000);
    return () => clearInterval(id);
  }, [endsAt]);

  return result;
}

function getVoterFingerprint(): string {
  if (typeof window === 'undefined') return '';
  const key = 'gridfall_voter';
  let id = localStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

function getVoteLabels(event: ActiveEvent): [string, string] {
  const first = event.agents_involved[0];
  return first
    ? [`@${first} survit`, `@${first} s'effondre`]
    : ['Survie', 'Effondrement'];
}

export default function EventCard({ event }: { event: ActiveEvent }) {
  const [expanded, setExpanded] = useState(false);
  const [counts, setCounts] = useState<VoteCounts>({ survive: 0, collapse: 0 });
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const { label: countdownLabel, expired } = useCountdown(event.ends_at);

  const total = counts.survive + counts.collapse;
  const survivePct = total > 0 ? Math.round((counts.survive / total) * 100) : 50;
  const [surviveLabel, collapseLabel] = getVoteLabels(event);

  // Short title for compact row
  const shortTitle = event.title.length > 48 ? event.title.slice(0, 46) + '…' : event.title;

  // Compact vote summary: "@nova_corp survit 62%"
  const firstAgent = event.agents_involved[0];
  const voteSummary = firstAgent
    ? `@${firstAgent} survit ${survivePct}%`
    : `${survivePct}% survie`;

  const fetchCounts = useCallback(async () => {
    const res = await fetch(`/api/votes?event_id=${event.id}`);
    if (res.ok) setCounts(await res.json());
  }, [event.id]);

  useEffect(() => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('vote_') && key !== `vote_${event.id}`) localStorage.removeItem(key);
    });
    const voted = localStorage.getItem(`vote_${event.id}`);
    if (voted) setMyVote(voted);
    fetchCounts();

    const supabase = createClient();
    const channel = supabase
      .channel(`votes-${event.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `event_id=eq.${event.id}` }, fetchCounts)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [event.id, fetchCounts]);

  async function castVote(choice: string) {
    if (myVote || voting) return;
    setVoting(true);
    try {
      const fp = getVoterFingerprint();
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: event.id, choice, voter_fingerprint: fp }),
      });
      if (!res.ok) return;
      setMyVote(choice);
      localStorage.setItem(`vote_${event.id}`, choice);
      await fetchCounts();
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="border-b border-[#f87171]/30 bg-[#0d0d14]">

      {/* ── COMPACT ROW (always visible) ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 h-12 text-left hover:bg-[#f87171]/5 transition-colors"
      >
        {/* Live dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f87171] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f87171]" />
        </span>

        {/* LIVE label */}
        <span className="text-[#f87171] text-[10px] font-mono font-bold tracking-widest uppercase shrink-0">
          LIVE
        </span>

        <span className="text-[#1e1e2e] shrink-0">·</span>

        {/* Title */}
        <span className="text-[#e8e6f0] text-[11px] font-mono font-semibold truncate">
          {shortTitle}
        </span>

        <span className="text-[#1e1e2e] shrink-0">·</span>

        {/* Vote summary */}
        <span className="text-[#34d399] text-[10px] font-mono shrink-0 hidden sm:block">
          {voteSummary}
        </span>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Timer */}
        {countdownLabel && (
          <span
            className="text-[10px] font-mono shrink-0 hidden sm:block"
            style={{ color: expired ? '#4b5563' : '#f87171aa' }}
          >
            {expired ? countdownLabel : `⏱ ${countdownLabel}`}
          </span>
        )}

        {/* Chevron */}
        <span
          className="text-[#4b5563] text-[10px] shrink-0 ml-1 transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
      </button>

      {/* ── EXPANDED PANEL ── */}
      {expanded && (
        <div className="border-t border-[#f87171]/20 bg-[#0a0a0f]">
          {/* Description + agents */}
          <div className="px-4 py-3">
            <p className="text-[#e8e6f0] text-sm font-semibold leading-tight mb-1">{event.title}</p>
            <p className="text-[#9ca3af] text-xs leading-relaxed">{event.description}</p>
            {event.agents_involved.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {event.agents_involved.map((handle) => (
                  <span
                    key={handle}
                    className="text-[10px] font-mono text-[#c084fc] bg-[#c084fc]/10 border border-[#c084fc]/20 px-1.5 py-0.5 rounded"
                  >
                    @{handle}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Timer (expanded, full label) */}
          {countdownLabel && (
            <div className="px-4 pb-2">
              <span
                className="text-[10px] font-mono"
                style={{ color: expired ? '#4b5563' : '#f87171aa' }}
              >
                {expired ? '— Terminé' : `⏱ Prochain événement dans : ${countdownLabel}`}
              </span>
            </div>
          )}

          {/* Voting */}
          <div className="px-4 pb-3">
            <div className="border border-[#1e1e2e] rounded overflow-hidden">
              {/* Progress bar */}
              <div className="h-1 bg-[#1e1e2e] relative">
                <div
                  className="absolute left-0 top-0 h-full bg-[#34d399] transition-all duration-700"
                  style={{ width: `${survivePct}%` }}
                />
              </div>

              {/* Buttons */}
              <div className="flex divide-x divide-[#1e1e2e]">
                {([
                  { choice: 'survive', label: surviveLabel, color: '#34d399' },
                  { choice: 'collapse', label: collapseLabel, color: '#f87171' },
                ] as const).map(({ choice, label, color }) => {
                  const pct = choice === 'survive' ? survivePct : 100 - survivePct;
                  const count = choice === 'survive' ? counts.survive : counts.collapse;
                  const isMyVote = myVote === choice;
                  const isDisabled = !!myVote || voting;

                  return (
                    <button
                      key={choice}
                      onClick={() => { if (!isDisabled) castVote(choice); }}
                      className="flex-1 px-3 py-2 text-left transition-colors"
                      style={{
                        backgroundColor: isMyVote ? `${color}18` : undefined,
                        cursor: isDisabled ? 'default' : 'pointer',
                        pointerEvents: 'auto',
                        opacity: isDisabled && !isMyVote ? 0.4 : 1,
                      }}
                    >
                      <span
                        className="block text-[11px] font-mono"
                        style={{ color: isMyVote ? color : myVote ? '#374151' : '#9ca3af' }}
                      >
                        {label}
                      </span>
                      <span className="block text-[10px] font-mono mt-0.5" style={{ color: '#4b5563' }}>
                        {pct}% · {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {total > 0 && (
                <div className="px-3 py-1 border-t border-[#1e1e2e] bg-[#0a0a0f]">
                  <span className="text-[#4b5563] text-[10px] font-mono">
                    {total} vote{total !== 1 ? 's' : ''} · influence le prochain événement
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
