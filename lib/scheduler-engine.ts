/**
 * Moteur d'exécution du scheduler — partagé entre /api/scheduler et /api/jump-to-day.
 * Publie tous les posts dus depuis `launchDate` qui ne sont pas déjà dans story_log.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getDueStoryPosts } from './story-scheduler';

export interface SchedulerResult {
  published: number;
  posts: string[];
  errors: string[];
}

export async function runSchedulerEngine(
  supabase: SupabaseClient,
  launchDate: Date,
): Promise<SchedulerResult> {
  // Posts déjà publiés
  const { data: published } = await supabase
    .from('story_log')
    .select('story_id');
  const publishedIds = new Set(
    (published ?? []).map((r: { story_id: string }) => r.story_id),
  );

  const duePosts = getDueStoryPosts(launchDate).filter(
    (p) => !publishedIds.has(p.id),
  );

  const results: string[] = [];
  const errors: string[] = [];

  for (const storyPost of duePosts) {
    try {
      // Agent en DB
      const { data: agentDB } = await supabase
        .from('agents')
        .select('id')
        .eq('handle', storyPost.agent_handle)
        .single();

      if (!agentDB) {
        errors.push(`Agent not found: ${storyPost.agent_handle}`);
        continue;
      }

      // Event actif (optionnel)
      const { data: activeEvent } = await supabase
        .from('events')
        .select('id')
        .eq('is_active', true)
        .single();

      // Insertion du post
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

      // ── Timestamp simulé pour ce post ───────────────────────────────────────
      // Chaque post reçoit le timestamp narratif exact (launchDate + offset),
      // pas l'heure réelle. Cela garantit que price_history reflète la chronologie
      // de la fiction (la chute de $NOVA au J4 08h reste visible comme une falaise).
      const simTimestamp = new Date(
        launchDate.getTime() +
        ((storyPost.day - 1) * 24 + storyPost.hour) * 60 * 60 * 1000 +
        storyPost.minute * 60 * 1000,
      );

      // ── Snapshot des prix AVANT les triggers economy ────────────────────────
      // Nécessaire pour que sell utilise le prix d'avant la mise à jour du post
      const triggers = storyPost.triggers;
      const priceSnapshot = new Map<string, number>();
      if (triggers?.sell || triggers?.economy) {
        const { data: econRows } = await supabase
          .from('economy')
          .select('token, price');
        for (const row of (econRows ?? [])) {
          priceSnapshot.set(row.token, row.price);
        }
      }
      // ── Triggers ────────────────────────────────────────────────────────────

      if (triggers?.close_event) {
        await supabase.from('events').update({ is_active: false }).eq('is_active', true);
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
        for (const { token: rawToken, delta } of triggers.economy) {
          // Normalise : 'NOVA' → '$NOVA' pour matcher la table economy
          const token = rawToken.startsWith('$') ? rawToken : `$${rawToken}`;
          const { data: econRow } = await supabase
            .from('economy')
            .select('price, change_24h')
            .eq('token', token)
            .single();

          if (econRow) {
            const newPrice = Math.max(0.01, econRow.price * (1 + delta / 100));
            const roundedPrice = Math.round(newPrice * 100) / 100;
            const newChange = Math.max(-99, Math.min(999,
              (econRow.change_24h ?? 0) * 0.7 + delta,
            ));
            await supabase.from('economy').update({
              price: roundedPrice,
              change_24h: Math.round(newChange * 10) / 10,
              updated_at: new Date().toISOString(),
            }).eq('token', token);

            await supabase.from('price_history').insert({
              token,
              price: roundedPrice,
              recorded_at: simTimestamp.toISOString(),
            });

            // Sync portfolios
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
        await supabase.from('settings').upsert({ key: 'drama_level', value: String(next) });
      }

      if (triggers?.wealth_all !== undefined) {
        await supabase
          .from('agents')
          .update({ wealth: triggers.wealth_all })
          .gte('id', '00000000-0000-0000-0000-000000000000');
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
          const newWealth = Math.round(invAgent.wealth - cost);
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
        // Prix pré-triggers : snapshot fetché avant les economy updates de ce post
        const normalizedSellToken = sv.token.startsWith('$') ? sv.token : `$${sv.token}`;
        const sellPrice = priceSnapshot.get(normalizedSellToken) ?? 0;
        // Normalise le token du portfolio pour matcher la valeur stockée lors de l'invest
        const portfolioToken = sv.token.startsWith('$') ? sv.token : `$${sv.token}`;
        const { data: portfolioRow } = await supabase
          .from('portfolio')
          .select('id, quantity')
          .eq('token', portfolioToken)
          .eq('agent_id', sellAgent?.id ?? '')
          .single();
        if (sellAgent && sellPrice > 0 && portfolioRow) {
          const proceeds = Math.round(sv.quantity * sellPrice);
          const newWealth = Math.round(sellAgent.wealth + proceeds);
          const remaining = portfolioRow.quantity - sv.quantity;
          if (remaining <= 0) {
            await supabase.from('portfolio').delete().eq('id', portfolioRow.id);
          } else {
            await supabase.from('portfolio').update({ quantity: remaining }).eq('id', portfolioRow.id);
          }
          // Utilise eq('handle') plutôt que eq('id') — plus robuste et pas de risque de null UUID
          const { error: sellWealthErr } = await supabase
            .from('agents')
            .update({ wealth: newWealth })
            .eq('handle', sv.seller);
          if (sellWealthErr) {
            errors.push(`Sell wealth update failed for ${sv.seller}: ${sellWealthErr.message}`);
          }
          await supabase.from('wealth_snapshots').insert({
            agent_handle: sv.seller,
            wealth: newWealth,
          });
        } else {
          errors.push(
            `Sell skipped for ${sv.seller}: ` +
            `agent=${!!sellAgent} price=${sellPrice} portfolio=${!!portfolioRow} ` +
            `token=${portfolioToken}`,
          );
        }
      }

      // reset_world ignoré dans jump-to-day (pas de récursion)

      // Log story_log
      await supabase.from('story_log').insert({ story_id: storyPost.id });
      results.push(storyPost.id);
    } catch (err) {
      errors.push(`Unexpected error for ${storyPost.id}: ${String(err)}`);
    }
  }

  return { published: results.length, posts: results, errors };
}
