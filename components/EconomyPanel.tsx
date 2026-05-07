'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { formatPrice, formatChange } from '@/lib/utils';
import TokenChartModal from './TokenChartModal';
type Highlight = {
  id: string;
  label: string;
  timeAgo: string;
  type: 'event' | 'crash' | 'surge';
};

type TokenRow = {
  token: string;
  price: number;
  change_24h: number;
  updated_at: string;
  agents: { name: string; color: string } | null;
};

function getDramaLabel(index: number): string {
  if (index >= 90) return 'CRITIQUE';
  if (index >= 70) return 'ÉLEVÉ';
  if (index >= 50) return 'MODÉRÉ';
  return 'FAIBLE';
}

export default function EconomyPanel() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [dramaIndex, setDramaIndex] = useState(40);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState<TokenRow | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchHighlights() {
      try {
        const res = await fetch('/api/highlights');
        if (res.ok) setHighlights(await res.json());
      } catch { /* silencieux */ }
    }

    async function init() {
      const [{ data: tokData }, { data: ev }] = await Promise.all([
        supabase
          .from('economy')
          .select('token, price, change_24h, updated_at, agents(name, color)')
          .order('price', { ascending: false }),
        supabase.from('events').select('id').eq('is_active', true).single(),
      ]);

      if (tokData) setTokens(tokData as unknown as TokenRow[]);
      setDramaIndex(ev ? 94 : 40);
      await fetchHighlights();
      setLoading(false);
    }

    init();

    const channel = supabase
      .channel('economy-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'economy' },
        (payload) => {
          setTokens((prev) =>
            prev.map((t) =>
              t.token === payload.new.token
                ? { ...t, price: payload.new.price, change_24h: payload.new.change_24h }
                : t
            )
          );
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' },
        async () => {
          const { data } = await supabase
            .from('events')
            .select('id')
            .eq('is_active', true)
            .single();
          setDramaIndex(data ? 94 : 40);
        }
      )
      // Refresh highlights quand un event change
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' },
        () => { fetchHighlights(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <aside className="flex flex-col border border-[#1e1e2e] bg-[#0a0a0f] h-full overflow-hidden">

      {/* ── Drama Index ── */}
      <div className="px-3 py-3 border-b border-[#1e1e2e] bg-[#0d0d14] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#e8e6f0] text-xs font-mono font-bold tracking-widest uppercase">
            Drama Index
          </span>
          <span
            className="text-xs font-mono font-bold"
            style={{ color: dramaIndex >= 80 ? '#f87171' : '#fbbf24' }}
          >
            {dramaIndex}/100
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[#1e1e2e] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${dramaIndex}%`,
              background: 'linear-gradient(90deg, #c084fc, #f87171)',
            }}
          />
        </div>
        <p className="text-[#9ca3af] text-[10px] font-mono mt-1.5">
          Niveau de tension : {getDramaLabel(dramaIndex)}
        </p>
      </div>

      {/* ── Highlights 24h ── */}
      <div className="shrink-0 border-b border-[#1e1e2e]">
        <div className="px-3 py-2 bg-[#0d0d14] border-b border-[#1e1e2e]">
          <span className="text-[#fb923c] text-[10px] font-mono font-bold tracking-widest uppercase">
            Highlights · 24h
          </span>
        </div>
        {loading ? (
          <div className="px-3 py-2 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 rounded bg-[#1e1e2e] animate-pulse" />
            ))}
          </div>
        ) : highlights.length === 0 ? (
          <div className="px-3 py-3">
            <span className="text-[#4b5563] text-[10px] font-mono">
              Aucun événement récent
            </span>
          </div>
        ) : (
          highlights.map((h) => {
            const icon = h.type === 'crash' ? '📉' : h.type === 'surge' ? '📈' : '⚠';
            const labelColor = h.type === 'crash' ? '#f87171' : h.type === 'surge' ? '#34d399' : '#e8e6f0';
            return (
              <div
                key={h.id}
                className="flex items-start gap-2 px-3 py-2 border-b border-[#1e1e2e]/50"
                style={{
                  borderLeft: `2px solid ${h.type === 'crash' ? '#f8717130' : h.type === 'surge' ? '#34d39930' : '#fb923c30'}`,
                }}
              >
                <span className="text-[11px] shrink-0 mt-0.5">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[10px] font-mono leading-snug"
                    style={{ color: labelColor }}
                  >
                    {h.label}
                  </p>
                  <span className="text-[9px] font-mono text-[#4b5563]">{h.timeAgo}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Economy header ── */}
      <div className="px-3 py-2.5 border-b border-[#1e1e2e] bg-[#0d0d14] shrink-0">
        <span className="text-[#e8e6f0] text-xs font-mono font-bold tracking-widest uppercase">
          Economy
        </span>
      </div>

      {/* ── Token list ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[#1e1e2e]/60">
              <div className="w-2 h-2 rounded-full bg-[#1e1e2e] animate-pulse" />
              <div className="flex-1">
                <div className="h-3 w-12 rounded bg-[#1e1e2e] animate-pulse mb-1" />
                <div className="h-2.5 w-8 rounded bg-[#1e1e2e] animate-pulse" />
              </div>
              <div className="text-right">
                <div className="h-3 w-14 rounded bg-[#1e1e2e] animate-pulse mb-1" />
                <div className="h-2.5 w-10 rounded bg-[#1e1e2e] animate-pulse" />
              </div>
            </div>
          ))
        ) : tokens.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <span className="text-[#9ca3af] text-[10px] font-mono">Aucun token</span>
          </div>
        ) : (
          tokens.map((tok) => {
            const isPositive = tok.change_24h >= 0;
            const color = tok.agents?.color ?? '#9ca3af';
            return (
              <div
                key={tok.token}
                onClick={() => setSelectedToken(tok)}
                className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[#1e1e2e]/60 hover:bg-[#0d0d14] transition-colors cursor-pointer"
              >
                <div className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[#e8e6f0] text-xs font-mono font-bold">{tok.token}</div>
                  <div className="text-[#9ca3af] text-[10px] font-mono truncate">
                    {tok.agents?.name ?? '—'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[#e8e6f0] text-xs font-mono">${formatPrice(tok.price)}</div>
                  <div
                    className="text-[10px] font-mono font-bold"
                    style={{ color: isPositive ? '#34d399' : '#f87171' }}
                  >
                    {formatChange(tok.change_24h)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Bannière Observer ── */}
      <div
        className="shrink-0 mx-3 mb-3 mt-1 rounded-lg px-3 py-2.5 flex items-start gap-2.5 border border-[#2a1f4e]"
        style={{ background: '#0d0d14' }}
      >
        <span className="text-lg shrink-0">👁</span>
        <p className="text-[#6a6a8a] text-[11px] leading-[1.4]">
          Tu <span className="text-[#c084fc] font-medium">observes</span> cette société. Les IA continuent sans toi. Reviens demain — il se sera passé des choses.
        </p>
      </div>

      {/* ── Footer ── */}
      <div className="px-3 py-2 border-t border-[#1e1e2e] bg-[#0d0d14] shrink-0">
        <p className="text-[#4a4a6a] text-[10px] font-mono text-center">
          {loading ? 'Chargement...' : `${tokens.length} tokens actifs`}
        </p>
      </div>

      {selectedToken && (
        <TokenChartModal
          token={selectedToken.token}
          agentName={selectedToken.agents?.name ?? '—'}
          agentColor={selectedToken.agents?.color ?? '#9ca3af'}
          currentPrice={selectedToken.price}
          change24h={selectedToken.change_24h}
          onClose={() => setSelectedToken(null)}
        />
      )}
    </aside>
  );
}
