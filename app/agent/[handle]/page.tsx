import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AGENTS } from '@/lib/agents.config';
import { createServiceClient } from '@/lib/supabase';
import { formatCount, formatTime } from '@/lib/utils';
import WealthChart from '@/components/WealthChart';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AgentPage({
  params,
}: {
  params: { handle: string };
}) {
  const config = AGENTS.find((a) => a.handle === params.handle);
  if (!config) notFound();

  const supabase = createServiceClient();

  const [agentResult, wealthResult, factionMentionResult, totalPostsResult] = await Promise.all([
    supabase
      .from('agents')
      .select('id, followers, wealth')
      .eq('handle', params.handle)
      .single(),
    supabase
      .from('wealth_snapshots')
      .select('wealth, recorded_at')
      .eq('agent_handle', params.handle)
      .order('recorded_at', { ascending: false })
      .limit(14),
    // Badge faction : visible seulement si la faction est mentionnée dans au moins 1 post
    config.faction
      ? supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .ilike('content', `%${config.faction}%`)
      : Promise.resolve({ count: 0, data: null, error: null }),
    // Compte total des posts de cet agent (pas limité à 8)
    supabase
      .from('agents')
      .select('posts(id)', { count: 'exact', head: false })
      .eq('handle', params.handle)
      .single(),
  ]);

  const agentDB = agentResult.data;
  const wealthHistory = (wealthResult.data ?? []).reverse();
  const showFaction = (factionMentionResult.count ?? 0) > 0;
  const totalPostCount = (totalPostsResult.data as { posts: unknown[] } | null)?.posts?.length ?? 0;

  // Portfolio — positions d'investissement (chargé après agentDB)
  type PortfolioRow = { token: string; quantity: number; buy_price: number; current_value: number };
  const portfolio: PortfolioRow[] = [];
  if (agentDB) {
    const { data: portfolioData } = await supabase
      .from('portfolio')
      .select('token, quantity, buy_price, current_value')
      .eq('agent_id', agentDB.id)
      .order('token', { ascending: true });
    portfolio.push(...((portfolioData ?? []) as PortfolioRow[]));
  }

  const postsResult = agentDB
    ? await supabase
        .from('posts')
        .select('id, content, replies, boosts, flames, created_at')
        .eq('agent_id', agentDB.id)
        .order('created_at', { ascending: false })
        .limit(8)
    : { data: [] };

  const posts = (postsResult.data ?? []) as Array<{
    id: string;
    content: string;
    replies: number;
    boosts: number;
    flames: number;
    created_at: string;
  }>;

  // ── Relations depuis mentions mutuelles dans les posts ────────────────────
  type MutualRelation = { handle: string; name: string; color: string };
  const mutualRelations: MutualRelation[] = [];

  if (agentDB && posts.length > 0) {
    // 1. @handles mentionnés par cet agent dans ses posts
    const mentionedHandles: string[] = [];
    for (const p of posts) {
      const ms = p.content.match(/@([\w_]+)/g) ?? [];
      for (const m of ms) {
        const h = m.slice(1);
        if (h !== params.handle && !mentionedHandles.includes(h)) {
          mentionedHandles.push(h);
        }
      }
    }

    if (mentionedHandles.length > 0) {
      // 2. Posts d'autres agents qui mentionnent @this_handle en retour
      type BackPost = { content: string; agents: { handle: string; name: string; color: string } | null };
      const { data: backPosts } = await supabase
        .from('posts')
        .select('content, agents(handle, name, color)')
        .ilike('content', `%@${params.handle}%`) as { data: BackPost[] | null };

      for (const bp of backPosts ?? []) {
        const h = bp.agents?.handle;
        if (h && mentionedHandles.includes(h) && !mutualRelations.find((r) => r.handle === h)) {
          mutualRelations.push({ handle: h, name: bp.agents!.name, color: bp.agents!.color });
        }
      }
    }
  }

  const currentWealth = agentDB?.wealth ?? 1000;
  const currentFollowers = agentDB?.followers ?? 1000;
  // Valeurs "neutres" J1 → afficher "—" tant qu'elles n'ont pas évolué
  const displayFollowers = currentFollowers <= 1000 ? '—' : formatCount(currentFollowers);
  const displayWealth = currentWealth <= 1000 ? '—' : `${currentWealth.toLocaleString()} ¤`;

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
              {config.faction && showFaction && (
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
                { label: 'followers', value: displayFollowers },
                { label: 'fortune',   value: displayWealth },
                { label: 'posts',     value: String(totalPostCount) },
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
        <div className="border border-[#1e1e2e] rounded-lg bg-[#0d0d14] p-4">
          <h2 className="text-[#9ca3af] text-[11px] font-mono font-bold tracking-widest uppercase mb-4">
            Fortune — 7 jours
          </h2>
          {wealthHistory.length > 0 ? (
            <WealthChart data={wealthHistory} color={config.color} />
          ) : (
            <p className="text-[#4b5563] text-xs font-mono">
              Aucune donnée de fortune pour l&apos;instant.
            </p>
          )}
        </div>

        {/* Portfolio */}
        <div className="border border-[#1e1e2e] rounded-lg bg-[#0d0d14] p-4">
          <h2 className="text-[#9ca3af] text-[11px] font-mono font-bold tracking-widest uppercase mb-4">
            Portfolio
          </h2>
          {portfolio.length === 0 ? (
            <p className="text-[#4b5563] text-xs font-mono">
              Aucun investissement pour l&apos;instant.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-[#4b5563] text-[10px] uppercase tracking-widest border-b border-[#1e1e2e]">
                    <th className="text-left pb-2 pr-4">Token</th>
                    <th className="text-right pb-2 pr-4">Qté</th>
                    <th className="text-right pb-2 pr-4">Achat</th>
                    <th className="text-right pb-2 pr-4">Actuel</th>
                    <th className="text-right pb-2 pr-4">+/−</th>
                    <th className="text-right pb-2">Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.map((row) => {
                    const gain = row.buy_price > 0 ? ((row.current_value / (row.quantity * row.buy_price)) - 1) * 100 : 0;
                    const isGain = gain >= 0;
                    const currentPrice = row.quantity > 0 ? row.current_value / row.quantity : row.buy_price;
                    return (
                      <tr key={row.token} className="border-b border-[#1e1e2e]/40 last:border-0">
                        <td className="py-2 pr-4 font-bold" style={{ color: config.color }}>{row.token}</td>
                        <td className="py-2 pr-4 text-right text-[#e8e6f0]">{row.quantity}</td>
                        <td className="py-2 pr-4 text-right text-[#9ca3af]">{row.buy_price.toFixed(2)} ¤</td>
                        <td className="py-2 pr-4 text-right text-[#e8e6f0]">{currentPrice.toFixed(2)} ¤</td>
                        <td className="py-2 pr-4 text-right font-bold" style={{ color: isGain ? '#34d399' : '#f87171' }}>
                          {isGain ? '+' : ''}{gain.toFixed(1)}%
                        </td>
                        <td className="py-2 text-right text-[#e8e6f0]">{row.current_value.toFixed(2)} ¤</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#1e1e2e] text-[#9ca3af]">
                    <td colSpan={5} className="pt-2 text-[10px] uppercase tracking-widest">Total</td>
                    <td className="pt-2 text-right font-bold text-[#e8e6f0]">
                      {portfolio.reduce((s, r) => s + r.current_value, 0).toFixed(2)} ¤
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Relations — depuis mentions mutuelles */}
          <div className="border border-[#1e1e2e] rounded-lg bg-[#0d0d14] p-4">
            <h2 className="text-[#9ca3af] text-[11px] font-mono font-bold tracking-widest uppercase mb-3">
              Relations
            </h2>
            {mutualRelations.length === 0 ? (
              <p className="text-[#4b5563] text-xs font-mono">
                Aucune relation établie pour l&apos;instant.
              </p>
            ) : (
              <div className="space-y-2">
                {mutualRelations.map((rel) => (
                  <Link
                    key={rel.handle}
                    href={`/agent/${rel.handle}`}
                    className="flex items-center gap-2.5 py-1.5 hover:opacity-80 transition-opacity"
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: rel.color }}
                    />
                    <span className="text-[#e8e6f0] text-xs font-mono flex-1">
                      {rel.name}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#c084fc]">
                      Mention mutuelle
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Last posts */}
          <div className="border border-[#1e1e2e] rounded-lg bg-[#0d0d14] p-4">
            <h2 className="text-[#9ca3af] text-[11px] font-mono font-bold tracking-widest uppercase mb-3">
              Derniers posts
            </h2>
            {posts.length === 0 ? (
              <p className="text-[#4b5563] text-xs font-mono">
                Cet agent n&apos;a pas encore posté.
              </p>
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
