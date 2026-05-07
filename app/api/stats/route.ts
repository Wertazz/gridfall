import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabase = createServiceClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [postAgentsRes, eventsRes, postsRes, settingsRes] =
    await Promise.all([
      // Agents qui ont posté — pour capital actif uniquement
      supabase.from('posts').select('agent_id'),
      // Crises actives uniquement
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since24h),
      supabase.from('settings').select('key, value').in('key', ['drama_level', 'launch_date']),
    ]);

  // IDs uniques des agents ayant posté
  const seenIds = new Set<string>();
  const uniqueAgentIds: string[] = [];
  for (const p of postAgentsRes.data ?? []) {
    if (p.agent_id && !seenIds.has(p.agent_id)) {
      seenIds.add(p.agent_id);
      uniqueAgentIds.push(p.agent_id);
    }
  }

  // Capital = SUM wealth des agents actifs (ont posté)
  let totalWealth = 0;
  if (uniqueAgentIds.length > 0) {
    const { data: activeAgents } = await supabase
      .from('agents')
      .select('wealth')
      .in('id', uniqueAgentIds);
    totalWealth = (activeAgents ?? []).reduce((sum, a) => sum + (a.wealth ?? 0), 0);
  }

  // Drama Index — lu depuis settings.drama_level (posé par le scheduler)
  const settingsMap = Object.fromEntries(
    (settingsRes.data ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
  );
  const dramaIndex = Math.min(100, Math.max(0, parseInt(settingsMap['drama_level'] ?? '0', 10)));

  // Jour X depuis launch_date
  let dayCount = 1;
  if (settingsMap['launch_date']) {
    const launch = new Date(settingsMap['launch_date']).getTime();
    dayCount = Math.max(1, Math.floor((Date.now() - launch) / 86_400_000) + 1);
  }

  return Response.json({
    totalWealth: Math.round(totalWealth),
    dramaIndex,
    eventCount: eventsRes.count ?? 0,
    postsToday: postsRes.count ?? 0,
    dayCount,
  });
}
