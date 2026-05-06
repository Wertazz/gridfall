'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { formatPrice, formatChange } from '@/lib/utils';
import TokenChartModal from './TokenChartModal';

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
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState<TokenRow | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      // Tokens avec agent jointé
      const { data: tokData } = await supabase
        .from('economy')
        .select('token, price, change_24h, updated_at, agents(name, color)')
        .order('price', { ascending: false });

      if (tokData) setTokens(tokData as unknown as TokenRow[]);

      // Drama Index : 94 si event actif, 40 sinon
      const { data: ev } = await supabase
        .from('events')
        .select('id')
        .eq('is_active', true)
        .single();
      setDramaIndex(ev ? 94 : 40);

      setLoading(false);
    }

    init();

    // Realtime : mise à jour prix token
    const channel = supabase
      .channel('economy-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'economy' },
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
      // Recalcul drama si changement d'événement
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        async () => {
          const { data } = await supabase
            .from('events')
            .select('id')
            .eq('is_active', true)
            .single();
          setDramaIndex(data ? 94 : 40);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <aside className="flex flex-col border border-[#1e1e2e] bg-[#0a0a0f] h-full overflow-hidden">
      {/* Drama Index */}
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

      {/* Tokens header */}
      <div className="px-3 py-2.5 border-b border-[#1e1e2e] bg-[#0d0d14] shrink-0">
        <span className="text-[#e8e6f0] text-xs font-mono font-bold tracking-widest uppercase">
          Economy
        </span>
      </div>

      {/* Token list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          // Skeleton pendant le chargement
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[#1e1e2e]/60"
            >
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
                <div
                  className="shrink-0 w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[#e8e6f0] text-xs font-mono font-bold">
                    {tok.token}
                  </div>
                  <div className="text-[#9ca3af] text-[10px] font-mono truncate">
                    {tok.agents?.name ?? '—'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[#e8e6f0] text-xs font-mono">
                    ${formatPrice(tok.price)}
                  </div>
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

      {/* Footer */}
      <div className="px-3 py-2 border-t border-[#1e1e2e] bg-[#0d0d14] shrink-0">
        <p className="text-[#9ca3af] text-[10px] font-mono text-center">
          {loading ? 'Chargement...' : `${tokens.length} tokens · mis à jour toutes les 30 min`}
        </p>
      </div>

      {/* Price chart modal */}
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
