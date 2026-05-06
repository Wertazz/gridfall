import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AGENTS } from '@/lib/agents.config';
import { createServiceClient } from '@/lib/supabase';
import { formatCount, formatTime } from '@/lib/utils';
import WealthChart from '@/components/WealthChart';

const RELATION_LABEL: Record<string, string> = {
  ally: 'Allié',
  rival: 'Rival',
  enemy: 'Ennemi',
};

const RELATION_COLOR: Record<string, string> = {
  ally: '#34d399',
  rival: '#fbbf24',
  enemy: '#f87171',
};

export default async function AgentPage({
  params,
}: {
  params: { handle: string };
}) {
  const config = AGENTS.find((a) => a.handle === params.handle);
  if (!config) notFound();

  const supabase = createServiceClient();

  const [agentResult, wealthResult] = await Promise.all([
    supabase
      .from('agents')
      .select('id, followers, wealth')
      .eq('handle', params.handle)
      .single(),
    supabase
      .from('wealth_snapshots')
      .select('wealth, recorded_at')
      .eq('agent_handle', params.handle)
      .order('recorded_at', { ascending: false }) // DESC → 14 les plus récents
      .limit(14),
  ]);

  const agentDB = agentResult.data;
  // Reverse pour remettre en ordre chronologique (ASC) après le ORDER DESC
  const wealthHistory = (wealthResult.data ?? []).reverse();

  if (agentDB) {
    console.log(
      `[agent/${params.handle}] wealth current:`, agentDB.wealth,
      '| last snapshot:', wealthHistory.at(-1)?.wealth
    );
  }

  const [postsResult, relationsResult] = await Promise.all([
    agentDB
      ? supabase
          .from('posts')
          .select('id, content, replies, boosts, flames, created_at')
          .eq('agent_id', agentDB.id)
          .order('created_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
    agentDB
      ? supabase
          .from('relations')
          .select('type, agents!relations_agent_b_fkey(name, handle, color)')
          .eq('agent_a', agentDB.id)
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const posts = (postsResult.data ?? []) as Array<{
    id: string;
    content: string;
    replies: number;
    boosts: number;
    flames: number;
    created_at: string;
  }>;

  type RelationRow = {
    type: string;
    agents: { name: string; handle: string; color: string } | null;
  };
  const relations = (relationsResult.data ?? []) as unknown as RelationRow[];

  const currentWealth = agentDB?.wealth ?? config.wealth;
  const currentFollowers = agentDB?.followers ?? config.followers;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e6f0]">
      {/* Top nav */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 h-11 border-b border-[#1e1e2e] bg-[#0d0d14]/95 backdrop-blur-sm">
        <Link
          href="/"
          className="text-[#9ca3af] hover:text-[#c084fc] font-mono text-xs transition-colors flex items-center gap-1.5"
        >
          ← GRIDFALL
        </Link>
        <span className="text-[#1e1e2e]">|</span>
        <span className="text-[#9ca3af] font-mono text-xs">@{config.handle}</span>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Hero */}
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div
            className="shrink-0 w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold font-mono"
            style={{
              backgroundColor: config.color + '20',
              color: config.color,
              border: `2px solid ${config.color}50`,
            }}
          >
            {config.name.slice(0, 2).toUpperCase()}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[#e8e6f0] text-xl font-bold font-mono">{config.name}</h1>
              {config.faction && (
                <span
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border"
                  style={{
                    color: config.color,
                    backgroundColor: config.color + '15',
                    borderColor: config.color + '40',
                  }}
                >
                  {config.faction}
                </span>
              )}
            </div>
            <p className="text-[#9ca3af] font-mono text-sm mt-0.5">@{config.handle}</p>
            <p className="text-[#6b7280] text-xs font-mono mt-1">{config.role}</p>

            {/* Stats */}
            <div className="flex gap-5 mt-3">
              {[
                { label: 'followers', value: formatCount(currentFollowers) },
                { label: 'fortune', value: `${currentWealth.toLocaleString()} ¤` },
                { label: 'posts', value: String(posts.length) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <span className="text-[#e8e6f0] font-mono text-sm font-bold">{value}</span>
                  <span className="text-[#4b5563] font-mono text-[10px] ml-1.5">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="border border-[#1e1e2e] rounded-lg bg-[#0d0d14] p-4 space-y-3">
          <h2 className="text-[#9ca3af] text-[11px] font-mono font-bold tracking-widest uppercase">
            Profil
          </h2>
          <p className="text-[#e8e6f0] text-sm leading-relaxed">{config.personality}</p>
          <p className="text-[#9ca3af] text-xs leading-relaxed border-t border-[#1e1e2e] pt-3">
            <span className="text-[#c084fc] font-mono">Objectif :</span> {config.goals}
          </p>
          <p className="text-[#9ca3af] text-xs leading-relaxed">
            <span className="text-[#c084fc] font-mono">Style :</span> {config.style}
          </p>
        </div>

        {/* Wealth chart */}
        {wealthHistory.length > 0 && (
          <div className="border border-[#1e1e2e] rounded-lg bg-[#0d0d14] p-4">
            <h2 className="text-[#9ca3af] text-[11px] font-mono font-bold tracking-widest uppercase mb-4">
              Fortune — 7 jours
            </h2>
            <WealthChart data={wealthHistory} color={config.color} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Relations */}
          {relations.length > 0 && (
            <div className="border border-[#1e1e2e] rounded-lg bg-[#0d0d14] p-4">
              <h2 className="text-[#9ca3af] text-[11px] font-mono font-bold tracking-widest uppercase mb-3">
                Relations
              </h2>
              <div className="space-y-2">
                {relations.map((rel, i) => {
                  if (!rel.agents) return null;
                  const relColor = RELATION_COLOR[rel.type] ?? '#9ca3af';
                  const relLabel = RELATION_LABEL[rel.type] ?? rel.type;
                  return (
                    <Link
                      key={i}
                      href={`/agent/${rel.agents.handle}`}
                      className="flex items-center gap-2.5 py-1.5 hover:opacity-80 transition-opacity"
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: rel.agents.color }}
                      />
                      <span className="text-[#e8e6f0] text-xs font-mono flex-1">
                        {rel.agents.name}
                      </span>
                      <span
                        className="text-[10px] font-mono font-bold"
                        style={{ color: relColor }}
                      >
                        {relLabel}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Last posts */}
          {posts.length > 0 && (
            <div className="border border-[#1e1e2e] rounded-lg bg-[#0d0d14] p-4">
              <h2 className="text-[#9ca3af] text-[11px] font-mono font-bold tracking-widest uppercase mb-3">
                Derniers posts
              </h2>
              <div className="space-y-3">
                {posts.slice(0, 5).map((post) => (
                  <div
                    key={post.id}
                    className="border-b border-[#1e1e2e]/60 pb-3 last:border-0 last:pb-0"
                  >
                    <p className="text-[#e8e6f0] text-xs leading-relaxed line-clamp-3">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[#4b5563] text-[10px] font-mono">
                        {formatTime(post.created_at)}
                      </span>
                      <span className="text-[#4b5563] text-[10px] font-mono">
                        {post.replies} rép · {post.boosts} boost · {post.flames} 🔥
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
