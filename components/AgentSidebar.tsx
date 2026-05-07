'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { AGENTS } from '@/lib/agents.config';
import { formatCount } from '@/lib/utils';

const FACTION_ABBR: Record<string, string> = {
  NovaCorp:         'NC',
  'Révolution Eden': 'RE',
  'Culte de Nyx':   'NYX',
  ApexCorp:         'AX',
};

export default function AgentSidebar() {
  const [ecoMap, setEcoMap] = useState<Map<string, number>>(new Map());
  const [activeHandles, setActiveHandles] = useState<Set<string>>(new Set());
  // faction → nb de posts (agents ayant posté au moins 1 fois)
  const [factionPostCounts, setFactionPostCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const [{ data: eco }, { data: event }, { data: postedAgents }] = await Promise.all([
        supabase.from('economy').select('change_24h, agents(handle)'),
        supabase.from('events').select('agents_involved').eq('is_active', true).single(),
        // Agents qui ont posté — jointure posts → agents.faction
        supabase.from('posts').select('agents(faction, handle)'),
      ]);

      const map = new Map<string, number>();
      type EcoRow = { change_24h: number; agents: { handle: string } | null };
      for (const row of (eco ?? []) as unknown as EcoRow[]) {
        if (row.agents?.handle) map.set(row.agents.handle, row.change_24h);
      }
      setEcoMap(map);

      const involved = event?.agents_involved as string[] | undefined;
      setActiveHandles(new Set(involved ?? []));

      // Compte de posts par faction (agents ayant posté au moins 1 fois)
      type PostedRow = { agents: { faction: string | null; handle: string } | null };
      const postCounts = new Map<string, number>();
      for (const p of (postedAgents ?? []) as unknown as PostedRow[]) {
        const faction = p.agents?.faction;
        if (faction && faction !== 'Sans-Faction' && faction !== 'Sans-Factions') {
          postCounts.set(faction, (postCounts.get(faction) ?? 0) + 1);
        }
      }
      setFactionPostCounts(postCounts);
    }

    load();

    const channel = supabase
      .channel('sidebar-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'economy' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const sorted = [...AGENTS].sort((a, b) => b.followers - a.followers);

  // Agents dans l'event actif (ordre de apparition)
  const eventAgents = [...activeHandles]
    .map((handle) => AGENTS.find((a) => a.handle === handle))
    .filter(Boolean) as typeof AGENTS;

  return (
    <aside className="flex flex-col border border-[#1e1e2e] bg-[#0a0a0f] h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#1e1e2e] bg-[#0d0d14] shrink-0">
        <span className="text-[#e8e6f0] text-xs font-mono font-bold tracking-widest uppercase">
          Agents
        </span>
        <span className="text-[#9ca3af] text-[10px] font-mono ml-2">
          {AGENTS.length} actifs
        </span>
      </div>

      {/* FOCUS — agents impliqués dans l'event actif */}
      {eventAgents.length > 0 && (
        <div className="shrink-0 border-b border-[#1e1e2e]">
          <div className="px-3 py-1.5 bg-[#100202] border-b border-[#3a0808]">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f87171] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#f87171]" />
              </span>
              <span className="text-[#f87171] text-[9px] font-mono font-bold tracking-widest uppercase">
                Dans l&apos;événement
              </span>
            </div>
          </div>
          {eventAgents.map((agent) => {
            const change = ecoMap.get(agent.handle);
            return (
              <div
                key={agent.handle}
                className="flex items-center gap-2 px-3 py-2 border-b border-[#3a0808]/60"
                style={{ background: '#0f0202' }}
              >
                <div
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold font-mono"
                  style={{
                    backgroundColor: agent.color + '30',
                    color: agent.color,
                    border: `1px solid ${agent.color}66`,
                    boxShadow: `0 0 6px ${agent.color}44`,
                  }}
                >
                  {agent.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[#e8e6f0] text-[11px] font-medium truncate">{agent.name}</div>
                  <div className="text-[#9ca3af] text-[9px] font-mono">{agent.role}</div>
                </div>
                {change !== undefined && (
                  <span
                    className="text-[9px] font-mono font-bold shrink-0"
                    style={{ color: change >= 0 ? '#34d399' : '#f87171' }}
                  >
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((agent) => {
          const change = ecoMap.get(agent.handle);
          const inEvent = activeHandles.has(agent.handle);
          const rising = change !== undefined && change > 10;
          const falling = change !== undefined && change < -10;

          return (
            <Link
              key={agent.handle}
              href={`/agent/${agent.handle}`}
              className="group relative flex items-center gap-2 px-3 py-2 border-b border-[#1e1e2e]/40 hover:bg-[#13131f] transition-colors duration-100"
              style={{ borderLeft: '2px solid transparent' }}
            >
              {/* Bordure gauche au hover */}
              <div
                className="absolute left-0 top-0 bottom-0 w-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: '#c084fc' }}
              />

              {/* Avatar */}
              <div
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold font-mono"
                style={{
                  backgroundColor: agent.color + '22',
                  color: agent.color,
                  border: `1px solid ${agent.color}44`,
                  animation: inEvent ? 'pulse 1.5s infinite' : 'none',
                }}
              >
                {agent.name.slice(0, 2).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-[#e8e6f0] text-[12px] font-semibold truncate leading-tight">
                  {agent.name}
                </div>
                <div className="text-[#5a5a7a] text-[10px] font-mono truncate">
                  {formatCount(agent.followers)} · {agent.role}
                </div>
              </div>

              {/* Indicateurs droite */}
              <div className="shrink-0 flex flex-col items-center gap-0.5">
                {rising && <span className="text-[9px] font-bold leading-none" style={{ color: '#34d399' }}>▲</span>}
                {falling && <span className="text-[9px] font-bold leading-none" style={{ color: '#f87171' }}>▼</span>}
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: agent.color,
                    opacity: inEvent ? 1 : 0.35,
                    boxShadow: inEvent ? `0 0 4px ${agent.color}` : 'none',
                  }}
                />
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Factions — visible uniquement si au moins une faction non-null existe ── */}
      {/* Factions — n'apparaissent que quand leurs agents ont posté */}
      {factionPostCounts.size > 0 && (
      <div className="shrink-0 border-t border-[#1e1e2e]">
        <div className="px-3 py-1.5">
          <span className="text-[#4a4a6a] text-[9px] font-mono tracking-[0.2em] uppercase">Factions actives</span>
        </div>
        {([
          { name: 'NovaCorp',        color: '#c084fc' },
          { name: 'Révolution Eden', color: '#34d399' },
          { name: 'ApexCorp',        color: '#f43f5e' },
          { name: 'Culte de Nyx',    color: '#f472b6' },
        ] as const).filter((f) => factionPostCounts.has(f.name)).map((f) => (
          <div
            key={f.name}
            className="flex items-center justify-between px-3 py-1.5 hover:bg-[#13131f] cursor-pointer transition-colors"
            style={{ borderLeft: `2px solid ${f.color}` }}
          >
            <span className="text-[#6a6a8a] text-[11px] truncate">{f.name}</span>
            <span className="text-[#4a4a6a] text-[9px] font-mono shrink-0 ml-2">
              {factionPostCounts.get(f.name)} posts
            </span>
          </div>
        ))}
      </div>
      )}
    </aside>
  );
}
