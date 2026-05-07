import { createServiceClient } from '@/lib/supabase';
import { STORY, getDueStoryPosts, getPostSimHour } from '@/lib/story-scheduler';

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
            const newChange = Math.max(-99, Math.min(999,
              (econRow.change_24h ?? 0) * 0.7 + delta // blend avec le delta
            ));
            await supabase.from('economy').update({
              price: Math.round(newPrice * 100) / 100,
              change_24h: Math.round(newChange * 10) / 10,
              updated_at: new Date().toISOString(),
            }).eq('token', token);

            // Log dans price_history
            await supabase.from('price_history').insert({
              token,
              price: Math.round(newPrice * 100) / 100,
            });
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
