import { createServiceClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServiceClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [agentsRes, eventsRes, postsRes, economyRes, viralRes, activeEventRes, launchRes] =
    await Promise.all([
      supabase.from('agents').select('wealth'),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since24h),
      supabase.from('economy').select('change_24h'),
      // Posts viraux : flames > 5000 dans les 24h
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since24h)
        .gt('flames', 5000),
      supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      // Jour X depuis la table settings
      supabase.from('settings').select('value').eq('key', 'launch_date').single(),
    ]);

  const totalWealth = (agentsRes.data ?? []).reduce(
    (sum, a) => sum + (a.wealth ?? 0),
    0
  );

  // Drama Index :
  // - Base : volatilité moyenne des tokens × 2
  // - Viral posts × 3 chacun
  // - +20 si event actif
  // Plafonné à 100
  const changes = (economyRes.data ?? []).map((t) => Math.abs(t.change_24h ?? 0));
  const avgVolatility = changes.length > 0
    ? changes.reduce((a, b) => a + b, 0) / changes.length
    : 0;
  const viralCount = viralRes.count ?? 0;
  const hasActiveEvent = (activeEventRes.count ?? 0) > 0;
  const dramaIndex = Math.min(
    100,
    Math.round(avgVolatility * 2 + viralCount * 3 + (hasActiveEvent ? 20 : 0))
  );

  // Jour X depuis launch_date
  let dayCount = 1;
  if (launchRes.data?.value) {
    const launch = new Date(launchRes.data.value).getTime();
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
