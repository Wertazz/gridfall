import { createServiceClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, title, agents_involved, ends_at')
    .eq('is_active', true)
    .single();

  if (!event) return Response.json({ active: false });

  const shortTitle = event.title; // titre complet, pas de troncature

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
