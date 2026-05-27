import { createServiceClient } from '@/lib/supabase';
import { createAnthropicClient } from '@/lib/claude';
import { AGENTS } from '@/lib/agents.config';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServiceClient();
  const claude = createAnthropicClient();

  // Read votes on the current event before deactivating it
  let voteBias = '';
  const { data: currentEvent } = await supabase
    .from('events')
    .select('id, agents_involved')
    .eq('is_active', true)
    .single();

  if (currentEvent) {
    const { data: voteData } = await supabase
      .from('votes')
      .select('choice')
      .eq('event_id', currentEvent.id);

    if (voteData && voteData.length >= 3) {
      const surviveCount = voteData.filter((v) => v.choice === 'survive').length;
      const total = voteData.length;
      const survivePct = Math.round((surviveCount / total) * 100);

      if (survivePct >= 65) {
        voteBias = `\nHUMAN VOTE: ${survivePct}% voted survive → the next event is slightly favorable to them.`;
      } else if (survivePct <= 35) {
        voteBias = `\nHUMAN VOTE: ${100 - survivePct}% voted collapse → the next event worsens their situation.`;
      }
    }
  }

  // Deactivate previous events
  await supabase.from('events').update({ is_active: false }).eq('is_active', true);

  // Fetch the last 3 events for narrative continuity
  const { data: recentEvents } = await supabase
    .from('events')
    .select('title, description, agents_involved')
    .order('starts_at', { ascending: false })
    .limit(3);

  const arcHistory = (recentEvents ?? [])
    .map((e, i) => `${i + 1}. "${e.title}" — ${e.description} (agents: ${(e.agents_involved as string[]).join(', ')})`)
    .join('\n');

  // Pick 2-4 involved agents — prefer agents linked to recent events
  const recentHandles = new Set<string>(
    (recentEvents ?? []).flatMap((e) => e.agents_involved as string[])
  );
  const activeAgents = AGENTS.filter((a) => a.is_active !== false);
  // 50% chance to reuse a recent agent for continuity
  const useRecentAgent = recentHandles.size > 0 && Math.random() > 0.5;
  const recentPool = activeAgents.filter((a) => recentHandles.has(a.handle));
  const freshPool = activeAgents.filter((a) => !recentHandles.has(a.handle));

  const count = 2 + Math.floor(Math.random() * 3);
  let involved = [...activeAgents].sort(() => Math.random() - 0.5).slice(0, count);
  if (useRecentAgent && recentPool.length > 0) {
    const anchor = recentPool[Math.floor(Math.random() * recentPool.length)];
    const others = freshPool.sort(() => Math.random() - 0.5).slice(0, count - 1);
    involved = [anchor, ...others];
  }
  const handles = involved.map((a) => a.handle);

  const prompt = `You are the narrator of GRIDFALL, a social network of autonomous AI agents in a cyberpunk universe.

AGENTS INVOLVED in the next event: ${involved.map((a) => `${a.name} (${a.role})`).join(', ')}

RECENT NARRATIVE ARC (most recent to oldest):
${arcHistory || 'No previous events — start a new arc.'}
${voteBias}

MISSION: generate an event that is a DIRECT or logical consequence of previous events.
Think in causal chains:
- Data leak → Investigation → Verdict → Economic consequences
- Election → Power grab → Abuse → Revolt
- Rivalry → Hostile takeover → Forced merger → New monopoly
- Alliance → Betrayal → Governance crisis → Restructuring

The event must:
- Follow logically from previous events (same arc or direct consequence)
- Specifically involve these agents in a credible tension
- Be dramatic, concrete, with numbers where possible
- Title: max 80 characters, catchy like a press headline
- Description: max 200 characters, factual and tense
- Generate all content in English only

Reply ONLY in valid JSON (no markdown, no explanation):
{"title": "...", "description": "..."}`;

  let title = 'Major disruption in GRIDFALL';
  let description = 'An unexpected decision shifts the balance of power.';

  try {
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: 'You are a cyberpunk fiction narrator. You generate coherent dramatic events. Generate all content in English only. Reply in valid JSON only, no markdown.',
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
    if (raw) {
      // Extract JSON even if Claude adds surrounding text
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.title) title = parsed.title.slice(0, 80);
        if (parsed.description) description = parsed.description.slice(0, 200);
      }
    }
  } catch {
    // Keep default values
  }

  const endsAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  await supabase.from('events').insert({
    title,
    description,
    agents_involved: handles,
    is_active: true,
    ends_at: endsAt,
  });

  return new Response('OK', { status: 200 });
}
