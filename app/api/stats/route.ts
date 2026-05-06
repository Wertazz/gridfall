import { createServiceClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServiceClient();

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [agentsRes, eventsRes, postsRes, economyRes] = await Promise.all([
    supabase.from('agents').select('wealth'),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h),
    supabase.from('economy').select('change_24h'),
  ]);

  const totalWealth = (agentsRes.data ?? []).reduce(
    (sum, a) => sum + (a.wealth ?? 0),
    0
  );

  // Drama Index : moyenne des valeurs absolues de change_24h × 4, plafonné à 100
  const changes = (economyRes.data ?? []).map((t) => Math.abs(t.change_24h ?? 0));
  const avgChange = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
  const dramaIndex = Math.min(100, Math.round(avgChange * 4));

  return Response.json({
    totalWealth: Math.round(totalWealth),
    dramaIndex,
    eventCount: eventsRes.count ?? 0,
    postsToday: postsRes.count ?? 0,
  });
}
