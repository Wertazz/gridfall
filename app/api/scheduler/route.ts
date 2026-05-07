import { createServiceClient } from '@/lib/supabase';
import { STORY, getDueStoryPosts, getPostSimHour } from '@/lib/story-scheduler';
import { AGENTS } from '@/lib/agents.config';

// Vérification du token de sécurité (Vercel cron ou appel manuel)
function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  // Vercel envoie ce header pour les crons internes
  if (req.headers.get('x-vercel-cron') === '1') return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // 1. Récupère launch_date depuis settings
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'launch_date')
    .single();

  if (!setting?.value) {
    return Response.json({ error: 'launch_date not found in settings' }, { status: 500 });
  }

  const launchDate = new Date(setting.value);

  // 2. Récupère les IDs déjà publiés (story_log)
  const { data: published } = await supabase
    .from('story_log')
    .select('story_id');

  const publishedIds = new Set((published ?? []).map((r: { story_id: string }) => r.story_id));

  // 3. Posts dus et non encore publiés
  const duePosts = getDueStoryPosts(launchDate).filter((p) => !publishedIds.has(p.id));

  if (duePosts.length === 0) {
    return Response.json({ published: 0, message: 'Nothing to publish' });
  }

  const results: string[] = [];
  const errors: string[] = [];

  for (const storyPost of duePosts) {
    try {
      // 4. Trouve l'agent dans la DB
      const { data: agentDB } = await supabase
        .from('agents')
        .select('id')
        .eq('handle', storyPost.agent_handle)
        .single();

      if (!agentDB) {
        errors.push(`Agent not found: ${storyPost.agent_handle}`);
        continue;
      }

      // 5. Trouve l'event actif pour le lier (optionnel)
      const { data: activeEvent } = await supabase
        .from('events')
        .select('id')
        .eq('is_active', true)
        .single();

      // 6. Insère le post
      const { error: postError } = await supabase.from('posts').insert({
        agent_id: agentDB.id,
        content: storyPost.content,
        event_id: activeEvent?.id ?? null,
        flames: storyPost.flames,
        boosts: storyPost.boosts,
        replies: storyPost.replies,
      });

      if (postError) {
        errors.push(`Post insert failed for ${storyPost.id}: ${postError.message}`);
        continue;
      }

      // 7. Applique les triggers
      const triggers = storyPost.triggers;

      if (triggers?.close_event) {
        await supabase
          .from('events')
          .update({ is_active: false })
          .eq('is_active', true);
      }

      if (triggers?.event) {
        const ev = triggers.event;
        const endsAt = new Date(Date.now() + ev.ends_in_hours * 60 * 60 * 1000);
        await supabase.from('events').insert({
          title: ev.title,
          description: ev.description,
          agents_involved: ev.agents_involved,
          is_active: true,
          starts_at: new Date().toISOString(),
          ends_at: endsAt.toISOString(),
        });
      }

      if (triggers?.economy && triggers.economy.length > 0) {
        for (const { token, delta } of triggers.economy) {
          const { data: econRow } = await supabase
            .from('economy')
            .select('price, change_24h')
            .eq('token', token)
            .single();

          if (econRow) {
            const newPrice = Math.max(0.01, econRow.price * (1 + delta / 100));
            const roundedPrice = Math.round(newPrice * 100) / 100;
            const newChange = Math.max(-99, Math.min(999,
              (econRow.change_24h ?? 0) * 0.7 + delta // blend avec le delta
            ));
            await supabase.from('economy').update({
              price: roundedPrice,
              change_24h: Math.round(newChange * 10) / 10,
              updated_at: new Date().toISOString(),
            }).eq('token', token);

            // Log dans price_history
            await supabase.from('price_history').insert({
              token,
              price: roundedPrice,
            });

            // Mise à jour automatique des portfolios pour ce token
            const { data: portfolioRows } = await supabase
              .from('portfolio')
              .select('id, quantity')
              .eq('token', token);
            for (const row of (portfolioRows ?? [])) {
              await supabase.from('portfolio').update({
                current_value: Math.round(row.quantity * roundedPrice * 100) / 100,
              }).eq('id', row.id);
            }
          }
        }
      }

      if (triggers?.followers && triggers.followers.length > 0) {
        for (const { handle, delta } of triggers.followers) {
          const { data: agent } = await supabase
            .from('agents')
            .select('followers')
            .eq('handle', handle)
            .single();
          if (agent) {
            await supabase.from('agents').update({
              followers: Math.max(0, (agent.followers ?? 0) + delta),
            }).eq('handle', handle);
          }
        }
      }

      if (triggers?.drama_delta) {
        const { data: dramaRow } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'drama_level')
          .single();
        const current = dramaRow ? parseFloat(dramaRow.value) || 0 : 0;
        const next = Math.max(0, Math.min(100, current + triggers.drama_delta));
        await supabase
          .from('settings')
          .upsert({ key: 'drama_level', value: String(next) });
      }

      if (triggers?.wealth_all !== undefined) {
        await supabase.from('agents').update({ wealth: triggers.wealth_all }).gte('id', '00000000-0000-0000-0000-000000000000');
      }

      if (triggers?.invest) {
        const inv = triggers.invest;
        const cost = inv.quantity * inv.price;
        const { data: invAgent } = await supabase
          .from('agents')
          .select('id, wealth')
          .eq('handle', inv.buyer)
          .single();
        if (invAgent && invAgent.wealth >= cost) {
          const newWealth = Math.round((invAgent.wealth - cost) * 100) / 100;
          await supabase.from('portfolio').insert({
            agent_id: invAgent.id,
            token: inv.token,
            quantity: inv.quantity,
            buy_price: inv.price,
            current_value: Math.round(inv.quantity * inv.price * 100) / 100,
          });
          await supabase.from('agents').update({ wealth: newWealth }).eq('id', invAgent.id);
          await supabase.from('wealth_snapshots').insert({
            agent_handle: inv.buyer,
            wealth: newWealth,
          });
        }
      }

      if (triggers?.sell) {
        const sv = triggers.sell;
        const { data: sellAgent } = await supabase
          .from('agents')
          .select('id, wealth')
          .eq('handle', sv.seller)
          .single();
        const { data: econRow } = await supabase
          .from('economy')
          .select('price')
          .eq('token', sv.token)
          .single();
        const { data: portfolioRow } = await supabase
          .from('portfolio')
          .select('id, quantity')
          .eq('token', sv.token)
          .eq('agent_id', sellAgent?.id ?? '')
          .single();
        if (sellAgent && econRow && portfolioRow) {
          const proceeds = Math.round(sv.quantity * econRow.price * 100) / 100;
          const newWealth = Math.round((sellAgent.wealth + proceeds) * 100) / 100;
          const remaining = portfolioRow.quantity - sv.quantity;
          if (remaining <= 0) {
            await supabase.from('portfolio').delete().eq('id', portfolioRow.id);
          } else {
            await supabase.from('portfolio').update({ quantity: remaining }).eq('id', portfolioRow.id);
          }
          await supabase.from('agents').update({ wealth: newWealth }).eq('id', sellAgent.id);
          await supabase.from('wealth_snapshots').insert({
            agent_handle: sv.seller,
            wealth: newWealth,
          });
        }
      }

      if (triggers?.reset_world) {
        const { delay_days } = triggers.reset_world;
        const newLaunchDate = new Date(
          Date.now() + delay_days * 24 * 60 * 60 * 1000
        ).toISOString();

        // Séquence reset — même ordre que /api/reset-world
        await supabase.from('votes').delete().gte('created_at', '2000-01-01');
        await supabase.from('posts').delete().gte('created_at', '2000-01-01');
        await supabase.from('events').delete().gte('created_at', '2000-01-01');
        await supabase.from('story_log').delete().gte('published_at', '2000-01-01');
        await supabase.from('price_history').delete().gte('recorded_at', '2000-01-01');

        // Reset economy
        for (const agent of AGENTS) {
          const initialPrice = Math.round((agent.wealth / 10) * 100) / 100 || 100;
          const tokenGuess = agent.handle.toUpperCase().replace('_', '').slice(0, 6);
          const { error: econErr } = await supabase
            .from('economy')
            .update({ price: initialPrice, change_24h: 0, updated_at: new Date().toISOString() })
            .eq('token', tokenGuess);
          if (econErr) {
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

        // Reset agents
        for (const agent of AGENTS) {
          await supabase
            .from('agents')
            .update({ followers: agent.followers, wealth: agent.wealth, memory: '' })
            .eq('handle', agent.handle);
        }

        // Planifie le prochain lancement
        await supabase
          .from('settings')
          .upsert({ key: 'launch_date', value: newLaunchDate });

        // Reset drama_level
        await supabase
          .from('settings')
          .upsert({ key: 'drama_level', value: '0' });

        console.log(`[scheduler] reset_world triggered — next launch: ${newLaunchDate}`);

        // Story_log déjà vidé — on skip l'insert et on passe au post suivant
        results.push(storyPost.id);
        continue;
      }

      // 8. Log le post dans story_log
      await supabase.from('story_log').insert({ story_id: storyPost.id });

      results.push(storyPost.id);
      console.log(`[scheduler] Published story post: ${storyPost.id} (day ${storyPost.day} h${storyPost.hour})`);

    } catch (err) {
      errors.push(`Unexpected error for ${storyPost.id}: ${String(err)}`);
    }
  }

  return Response.json({
    published: results.length,
    posts: results,
    errors: errors.length > 0 ? errors : undefined,
    total_story: STORY.length,
    total_due: duePosts.length,
  });
}
