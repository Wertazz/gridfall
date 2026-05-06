'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

type ActiveEvent = {
  id: string;
  title: string;
  agents_involved: string[];
};

type TokenChange = {
  handle: string;
  token: string;
  change_24h: number;
};

export default function NowWidget() {
  const [event, setEvent] = useState<ActiveEvent | null>(null);
  const [changes, setChanges] = useState<TokenChange[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const [eventRes, economyRes] = await Promise.all([
        supabase.from('events').select('id, title, agents_involved').eq('is_active', true).single(),
        supabase.from('economy').select('token, change_24h, agents(handle)'),
      ]);

      if (eventRes.data) {
        setEvent(eventRes.data as ActiveEvent);
        const involved: string[] = eventRes.data.agents_involved ?? [];
        const eco = (economyRes.data ?? []) as unknown as Array<{
          token: string; change_24h: number; agents: { handle: string } | null
        }>;
        setChanges(
          eco
            .filter((t) => t.agents && involved.includes(t.agents.handle))
            .map((t) => ({ handle: t.agents!.handle, token: t.token, change_24h: t.change_24h }))
        );
      } else {
        setEvent(null);
        setChanges([]);
      }
    }

    load();

    const channel = supabase
      .channel('now-widget-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (!event) return null;

  // Construit le résumé "qui gagne / qui perd"
  const summary = changes
    .sort((a, b) => a.change_24h - b.change_24h)
    .map((t) => {
      const sign = t.change_24h >= 0 ? '+' : '';
      return `${t.token} ${sign}${t.change_24h.toFixed(1)}%`;
    })
    .join(' · ');

  // Titre court (max 50 chars)
  const shortTitle = event.title.length > 52 ? event.title.slice(0, 50) + '…' : event.title;

  return (
    <div
      className="shrink-0 px-3 py-2.5 border-b border-[#1e1e2e]"
      style={{
        background: 'linear-gradient(90deg, #f8717108 0%, transparent 100%)',
        borderLeft: '2px solid #f87171',
      }}
    >
      {/* Badge EN CE MOMENT */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#f87171] shrink-0"
          style={{ animation: 'pulse 1.5s infinite' }}
        />
        <span
          className="text-[9px] font-bold tracking-[0.2em] text-[#f87171] uppercase"
          style={{ fontFamily: 'var(--font-space-mono), monospace' }}
        >
          En ce moment
        </span>
      </div>

      {/* Titre event */}
      <p
        className="text-[11px] font-bold leading-tight mb-1"
        style={{ color: '#e8e6f0', fontFamily: 'var(--font-space-mono), monospace' }}
      >
        🚨 {shortTitle}
      </p>

      {/* Résumé prix */}
      {summary && (
        <p
          className="text-[10px] leading-tight"
          style={{ color: '#9ca3af', fontFamily: 'var(--font-space-mono), monospace' }}
        >
          {summary}
        </p>
      )}
    </div>
  );
}
