import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabase = createServiceClient();

  // ── C3 fix : limit(1) + order au lieu de .single() ─────────────────────────
  // Évite le crash si deux events sont actifs simultanément (ex: J5 20h-J6 08h)
  const { data: activeEvents } = await supabase
    .from('events')
    .select('id, title, agents_involved, ends_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  const event = activeEvents?.[0] ?? null;

  // ── M8 : si aucun event actif, retourner le dernier terminé ────────────────
  if (!event) {
    const { data: lastEvents } = await supabase
      .from('events')
      .select('title')
      .eq('is_active', false)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastTitle = lastEvents?.[0]?.title ?? null;
    return Response.json({ active: false, lastTitle });
  }

  const shortTitle = event.title;
  const mainAgent = (event.agents_involved as string[])?.[0] ?? null;

  // Vote counts
  const { data: votes } = await supabase
    .from('votes')
    .select('choice')
    .eq('event_id', event.id);

  const totalVotes = votes?.length ?? 0;
  const surviveCount = votes?.filter((v) => v.choice === 'survive').length ?? 0;
  const survivePct = totalVotes > 0 ? Math.round((surviveCount / totalVotes) * 100) : 50;

  // Token for main agent
  let token: string | null = null;
  let change24h: number | null = null;

  if (mainAgent) {
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('handle', mainAgent)
      .single();

    if (agent) {
      const { data: eco } = await supabase
        .from('economy')
        .select('token, change_24h')
        .eq('agent_id', agent.id)
        .single();

      if (eco) {
        token = eco.token;
        change24h = eco.change_24h;
      }
    }
  }

  return Response.json({
    active: true,
    eventId: event.id,
    title: shortTitle,
    mainAgent,
    agentsInvolved: (event.agents_involved as string[]) ?? [],
    token,
    change24h,
    survivePct,
    collapsePct: 100 - survivePct,
    totalVotes,
    endsAt: event.ends_at ?? null,
  });
}
