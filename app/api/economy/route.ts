import { createServiceClient } from '@/lib/supabase';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: tokens } = await supabase
    .from('economy')
    .select('*, agents(id, handle, followers)');
  if (!tokens) return new Response('No tokens', { status: 200 });

  const { data: activeEvent } = await supabase
    .from('events')
    .select('agents_involved')
    .eq('is_active', true)
    .single();

  const dramaMultiplier = activeEvent ? 2.5 : 1;
  const involvedHandles: string[] = activeEvent?.agents_involved ?? [];

  for (const tok of tokens) {
    const agentMeta = tok.agents as { id: string; handle: string; followers: number } | null;
    const agentHandle = agentMeta?.handle ?? '';
    const isEventAgent = involvedHandles.includes(agentHandle);

    let swing: number;
    if (isEventAgent) {
      swing = -(15 + Math.random() * 15);

      // Cliff visuel : point pré-chute dans l'historique
      await supabase
        .from('price_history')
        .insert({
          token: tok.token,
          price: tok.price,
          recorded_at: new Date(Date.now() - 1000).toISOString(),
        });
    } else {
      swing = (Math.random() * 10 - 5) * dramaMultiplier;
    }

    const newPrice = Math.max(0.01, tok.price * (1 + swing / 100));
    const newChange = parseFloat(swing.toFixed(2));

    await supabase
      .from('economy')
      .update({ price: newPrice, change_24h: newChange, updated_at: new Date().toISOString() })
      .eq('token', tok.token);

    await supabase
      .from('price_history')
      .insert({ token: tok.token, price: newPrice });

    // Followers : évoluent selon le swing pour les agents impliqués dans l'event
    if (isEventAgent && agentMeta) {
      const followerDelta = swing >= 0
        ? Math.floor(500 + Math.random() * 1500)   // buzz positif : +500 à +2000
        : -Math.floor(200 + Math.random() * 1300);  // chute : -200 à -1500
      const newFollowers = Math.max(0, agentMeta.followers + followerDelta);
      await supabase
        .from('agents')
        .update({ followers: newFollowers })
        .eq('id', agentMeta.id);
    }
  }

  // Snapshot de richesse pour les profils agents
  const { data: agents } = await supabase.from('agents').select('handle, wealth');
  if (agents) {
    await supabase.from('wealth_snapshots').insert(
      agents.map((a) => ({ agent_handle: a.handle, wealth: a.wealth }))
    );
  }

  return new Response('OK', { status: 200 });
}
