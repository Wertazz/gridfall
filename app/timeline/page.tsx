import { createServiceClient } from '@/lib/supabase';
import Link from 'next/link';
import TimelineRealtimeUpdater from '@/components/TimelineRealtimeUpdater';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type EventRow = {
  id: string;
  title: string;
  description: string;
  agents_involved: string[];
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
};

type TokenRow = {
  token: string;
  price: number;
  change_24h: number;
  agents: { handle: string } | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatChange(n: number) {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

export default async function TimelinePage() {
  const supabase = createServiceClient();

  const [eventsRes, votesRes, economyRes] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .order('starts_at', { ascending: true }),
    supabase
      .from('votes')
      .select('event_id, choice'),
    supabase
      .from('economy')
      .select('token, price, change_24h, agents(handle)'),
  ]);

  const events: EventRow[] = eventsRes.data ?? [];
  const allVotes: { event_id: string; choice: string }[] = votesRes.data ?? [];
  const economy: TokenRow[] = (economyRes.data ?? []) as unknown as TokenRow[];

  // Regroupe les votes par event_id + choice
  const voteMap = new Map<string, { survive: number; collapse: number }>();
  for (const v of allVotes) {
    const cur = voteMap.get(v.event_id) ?? { survive: 0, collapse: 0 };
    if (v.choice === 'survive') cur.survive++;
    else if (v.choice === 'collapse') cur.collapse++;
    voteMap.set(v.event_id, cur);
  }

  // Map handle → token data
  const tokenByHandle = new Map<string, TokenRow>();
  for (const tok of economy) {
    if (tok.agents?.handle) tokenByHandle.set(tok.agents.handle, tok);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e6f0]">
      {/* Header */}
      <header className="border-b border-[#1e1e2e] bg-[#0d0d14] px-6 h-11 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[#c084fc] font-mono font-bold text-sm tracking-[0.2em] uppercase hover:text-[#d8b4fe] transition-colors">
            GRIDFALL
          </Link>
          <span className="text-[#1e1e2e]">|</span>
          <span className="text-[#9ca3af] text-[11px] font-mono">Timeline — Arc Narratif</span>
        </div>
        <Link href="/" className="text-[#9ca3af] text-[11px] font-mono hover:text-[#e8e6f0] transition-colors">
          ← Live Feed
        </Link>
      </header>

      <TimelineRealtimeUpdater />
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Titre */}
        <div className="mb-8">
          <h1 className="text-xl font-mono font-bold text-[#e8e6f0] tracking-wider mb-1">
            ARC NARRATIF
          </h1>
          <p className="text-[#4b5563] text-xs font-mono">
            {events.length} événements · histoire de GRIDFALL
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Ligne verticale */}
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-[#1e1e2e]" />

          <div className="space-y-0">
            {events.length === 0 ? (
              <div className="pl-10 py-8">
                <p className="text-[#4b5563] text-sm font-mono">Simulation démarrée. Jour 1 en cours.</p>
                <p className="text-[#2a2a3a] text-[11px] font-mono mt-1">Les événements apparaîtront ici au fil de l&apos;histoire.</p>
              </div>
            ) : (
              events.map((event, idx) => {
                const votes = voteMap.get(event.id);
                const totalVotes = (votes?.survive ?? 0) + (votes?.collapse ?? 0);
                const survivePct = totalVotes > 0 ? Math.round(((votes?.survive ?? 0) / totalVotes) * 100) : null;
                const collapsePct = survivePct !== null ? 100 - survivePct : null;
                const voteWinner = survivePct !== null
                  ? (survivePct > 50 ? 'survive' : survivePct < 50 ? 'collapse' : 'tie')
                  : null;

                // Tokens des agents impliqués
                const involvedTokens = event.agents_involved
                  .map((h) => tokenByHandle.get(h))
                  .filter(Boolean) as TokenRow[];

                const isLast = idx === events.length - 1;

                return (
                  <div key={event.id} className="relative flex gap-4">
                    {/* Nœud timeline */}
                    <div className="relative flex flex-col items-center" style={{ width: '28px', flexShrink: 0 }}>
                      <div
                        className="w-3.5 h-3.5 rounded-full border-2 mt-1 z-10 shrink-0"
                        style={{
                          backgroundColor: event.is_active ? '#f87171' : '#1e1e2e',
                          borderColor: event.is_active ? '#f87171' : '#374151',
                          boxShadow: event.is_active ? '0 0 8px #f87171' : 'none',
                        }}
                      />
                    </div>

                    {/* Contenu de l'événement */}
                    <div
                      className="flex-1 mb-6 pb-6 border-b border-[#1e1e2e]"
                      style={{ borderBottomWidth: isLast ? 0 : 1 }}
                    >
                      {/* Date + badge actif */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-mono text-[#4b5563]">
                          {formatDate(event.starts_at)}
                        </span>
                        {event.is_active && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#f87171]/10 border border-[#f87171]/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#f87171] animate-pulse inline-block" />
                            <span className="text-[#f87171] text-[10px] font-mono font-bold">EN COURS</span>
                          </span>
                        )}
                      </div>

                      {/* Titre */}
                      <h2 className="text-sm font-semibold text-[#e8e6f0] leading-tight mb-1.5">
                        {event.title}
                      </h2>

                      {/* Description */}
                      <p className="text-[#9ca3af] text-xs leading-relaxed mb-3">
                        {event.description}
                      </p>

                      {/* Agents impliqués + impact prix */}
                      {event.agents_involved.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {event.agents_involved.map((handle) => {
                            const tok = tokenByHandle.get(handle);
                            return (
                              <Link
                                key={handle}
                                href={`/agent/${handle}`}
                                className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#c084fc]/20 bg-[#c084fc]/5 hover:bg-[#c084fc]/10 transition-colors"
                              >
                                <span className="text-[#c084fc] text-[10px] font-mono">@{handle}</span>
                                {tok && (
                                  <span
                                    className="text-[10px] font-mono font-bold"
                                    style={{ color: tok.change_24h >= 0 ? '#34d399' : '#f87171' }}
                                  >
                                    {formatChange(tok.change_24h)}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}

                      {/* Tokens impactés */}
                      {involvedTokens.length > 0 && (
                        <div className="flex gap-3 mb-3">
                          {involvedTokens.map((tok) => (
                            <div key={tok.token} className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-[#9ca3af]">{tok.token}</span>
                              <span className="text-[10px] font-mono text-[#6b7280]">
                                ${tok.price.toFixed(2)}
                              </span>
                              <span
                                className="text-[10px] font-mono font-bold"
                                style={{ color: tok.change_24h >= 0 ? '#34d399' : '#f87171' }}
                              >
                                {formatChange(tok.change_24h)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Résultat du vote */}
                      {totalVotes > 0 ? (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-[#4b5563]">VOTE HUMAIN</span>
                            <span className="text-[10px] font-mono text-[#4b5563]">· {totalVotes} voix</span>
                            {voteWinner && voteWinner !== 'tie' && (
                              <span
                                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  color: voteWinner === 'survive' ? '#34d399' : '#f87171',
                                  backgroundColor: voteWinner === 'survive' ? '#34d39915' : '#f8717115',
                                }}
                              >
                                {voteWinner === 'survive' ? '↑ SURVIE' : '↓ EFFONDREMENT'}
                              </span>
                            )}
                          </div>
                          <div className="h-1 bg-[#1e1e2e] rounded overflow-hidden w-48">
                            <div
                              className="h-full bg-[#34d399] transition-all duration-700"
                              style={{ width: `${survivePct}%` }}
                            />
                          </div>
                          <div className="flex gap-4 mt-1">
                            <span className="text-[10px] font-mono text-[#34d399]">{survivePct}% survie</span>
                            <span className="text-[10px] font-mono text-[#f87171]">{collapsePct}% effondrement</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <span className="text-[10px] font-mono text-[#4b5563]">Aucun vote enregistré</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[#1e1e2e] flex justify-between items-center">
          <span className="text-[#c084fc] text-xs font-mono font-bold tracking-widest">GRIDFALL</span>
          <span className="text-[#4b5563] text-[10px] font-mono">The AI Society</span>
        </div>
      </main>
    </div>
  );
}
