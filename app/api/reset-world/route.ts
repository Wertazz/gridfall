import { createServiceClient } from '@/lib/supabase';
import { AGENTS } from '@/lib/agents.config';

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  return !!(secret && auth === `Bearer ${secret}`);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const steps: string[] = [];
  const errors: string[] = [];

  // 1. Supprime les votes (FK sur events → doit partir avant events)
  const { error: e1 } = await supabase
    .from('votes')
    .delete()
    .gte('created_at', '2000-01-01');
  if (e1) errors.push(`votes: ${e1.message}`);
  else steps.push('votes deleted');

  // 2. Supprime les posts
  const { error: e2 } = await supabase
    .from('posts')
    .delete()
    .gte('created_at', '2000-01-01');
  if (e2) errors.push(`posts: ${e2.message}`);
  else steps.push('posts deleted');

  // 3. Supprime les events
  const { error: e3 } = await supabase
    .from('events')
    .delete()
    .gte('created_at', '2000-01-01');
  if (e3) errors.push(`events: ${e3.message}`);
  else steps.push('events deleted');

  // 4. Supprime le story_log (pour permettre une re-publication)
  const { error: e4 } = await supabase
    .from('story_log')
    .delete()
    .gte('published_at', '2000-01-01');
  if (e4) errors.push(`story_log: ${e4.message}`);
  else steps.push('story_log cleared');

  // 5. Reset price_history (garde seulement les prix initiaux)
  const { error: e5 } = await supabase
    .from('price_history')
    .delete()
    .gte('recorded_at', '2000-01-01');
  if (e5) errors.push(`price_history: ${e5.message}`);
  else steps.push('price_history cleared');

  // 6. Reset economy (price et change_24h) depuis les valeurs AGENTS
  for (const agent of AGENTS) {
    const initialPrice = Math.round(agent.wealth / 10 * 100) / 100 || 100;
    const { error } = await supabase
      .from('economy')
      .update({
        price: initialPrice,
        change_24h: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('token', agent.handle.toUpperCase().replace('_', '').slice(0, 6));
    if (error) {
      // Essai par jointure agents
      const { data: agentDB } = await supabase
        .from('agents')
        .select('id')
        .eq('handle', agent.handle)
        .single();
      if (agentDB) {
        await supabase.from('economy').update({
          price: initialPrice,
          change_24h: 0,
          updated_at: new Date().toISOString(),
        }).eq('agent_id', agentDB.id);
      }
    }
  }
  steps.push('economy reset to initial values');

  // 7. Reset agents.followers, wealth, memory depuis AGENTS config
  for (const agent of AGENTS) {
    await supabase
      .from('agents')
      .update({
        followers: agent.followers,
        wealth: agent.wealth,
        memory: '',
      })
      .eq('handle', agent.handle);
  }
  steps.push(`agents reset (${AGENTS.length} agents)`);

  // 8. Reset launch_date à maintenant
  const now = new Date().toISOString();
  const { error: e8 } = await supabase
    .from('settings')
    .upsert({ key: 'launch_date', value: now });
  if (e8) errors.push(`settings: ${e8.message}`);
  else steps.push(`launch_date reset to ${now}`);

  const success = errors.length === 0;

  console.log(`[reset-world] ${success ? 'SUCCESS' : 'PARTIAL'} — Steps: ${steps.join(', ')}`);
  if (errors.length > 0) {
    console.error(`[reset-world] Errors: ${errors.join(', ')}`);
  }

  return Response.json({
    success,
    steps,
    errors: errors.length > 0 ? errors : undefined,
    new_launch_date: now,
  }, { status: success ? 200 : 207 });
}
