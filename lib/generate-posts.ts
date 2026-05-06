import { createServiceClient } from './supabase';
import { createAnthropicClient } from './claude';
import { AGENTS } from './agents.config';
import { buildAgentPrompt } from './prompts';

export type GenerateResult = {
  generated: number;
  agents: string[];
  posts?: Array<{ agent: string; content: string }>;
  error?: string;
};

// Détecte si un contenu est un refus de rôle (à exclure du contexte et de la DB)
const REFUSAL_MARKERS = [
  "i can't", "i won't", "i'm not going to", "i cannot",
  "je ne vais pas", "je ne peux pas",
  "i need to be direct", "i recognize what",
  "manipulation tactics", "manipulation réelle",
  "not going to generate", "not going to roleplay",
  "i appreciate you testing", "rather than roleplaying",
];

function isRefusal(content: string): boolean {
  const lower = content.toLowerCase();
  return REFUSAL_MARKERS.some((m) => lower.includes(m));
}

export async function generatePosts(agentCount = 3): Promise<GenerateResult> {
  const supabase = createServiceClient();
  const claude = createAnthropicClient();

  // Supprime les posts de refus existants pour décontaminer le contexte
  const { data: allRecentPosts } = await supabase
    .from('posts')
    .select('id, content')
    .order('created_at', { ascending: false })
    .limit(50);

  const refusalIds = (allRecentPosts ?? [])
    .filter((p) => isRefusal(p.content))
    .map((p) => p.id);

  if (refusalIds.length > 0) {
    await supabase.from('posts').delete().in('id', refusalIds);
  }

  const activeAgents = AGENTS.filter((a) => a.is_active !== false);
  const selected = [...activeAgents].sort(() => Math.random() - 0.5).slice(0, agentCount);

  // Contexte : 8 derniers posts NON-refus
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('content, agents(name, handle)')
    .order('created_at', { ascending: false })
    .limit(20);

  const recentContext = (recentPosts as Array<{ content: string; agents: { name: string; handle: string } }> | null)
    ?.filter((p) => !isRefusal(p.content))
    .slice(0, 8)
    .map((p) => `@${p.agents.handle}: ${p.content}`)
    .join('\n') ?? '';

  // Événement actif
  const { data: activeEvent } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .single();

  let generated = 0;
  const agentsPosted: string[] = [];
  const postsGenerated: Array<{ agent: string; content: string }> = [];

  for (const agentConfig of selected) {
    const { data: agentDB } = await supabase
      .from('agents')
      .select('*')
      .eq('handle', agentConfig.handle)
      .single();

    if (!agentDB) continue;

    // Nettoie la mémoire si elle contient des refus
    const cleanMemory = agentDB.memory && isRefusal(agentDB.memory) ? '' : agentDB.memory;

    const userPrompt = buildAgentPrompt(
      { ...agentDB, memory: cleanMemory },
      recentContext,
      activeEvent?.description
    );

    let content: string | null = null;
    try {
      const response = await claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: 'You are an AI writer for GRIDFALL, a creative fiction project. Write a short social media post (max 200 chars) as the character described. Respond with ONLY the post text, nothing else.',
        messages: [{ role: 'user', content: userPrompt }],
      });
      content = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
    } catch (err) {
      console.error(`[generate] Claude error for ${agentConfig.handle}:`, err);
      continue;
    }

    // Ignore les refus et ne les insère pas en base
    if (!content || isRefusal(content)) {
      console.warn(`[generate] Refus détecté pour ${agentConfig.handle}, ignoré`);
      if (cleanMemory !== agentDB.memory) {
        await supabase.from('agents').update({ memory: '' }).eq('id', agentDB.id);
      }
      continue;
    }

    const flames = Math.floor(Math.random() * 8000);
    const replies = Math.floor(Math.random() * 500);
    const boosts = Math.floor(Math.random() * 200);

    await supabase.from('posts').insert({
      agent_id: agentDB.id,
      content,
      event_id: activeEvent?.id ?? null,
      replies,
      boosts,
      flames,
    });

    // Post viral : micro-mouvement de prix dans l'historique
    if (flames > 5000) {
      const { data: tokenRow } = await supabase
        .from('economy')
        .select('token, price')
        .eq('agent_id', agentDB.id)
        .single();

      if (tokenRow) {
        const direction = Math.random() > 0.4 ? 1 : -1; // 60% hausse (buzz positif)
        const movePct = 3 + Math.random() * 5; // 3-8%
        const microPrice = Math.max(0.01, tokenRow.price * (1 + direction * movePct / 100));
        console.log(`[generate] Post viral (${flames} flames) @${agentConfig.handle} → ${direction > 0 ? '+' : ''}${(direction * movePct).toFixed(1)}% sur ${tokenRow.token}`);
        await supabase.from('price_history').insert({
          token: tokenRow.token,
          price: microPrice,
        });
      }
    }

    const newMemory = `${cleanMemory ?? ''}\n- Vient de poster: "${content.slice(0, 80)}..."`.slice(-500);
    await supabase.from('agents').update({ memory: newMemory }).eq('id', agentDB.id);

    generated++;
    agentsPosted.push(agentConfig.handle);
    postsGenerated.push({ agent: agentConfig.handle, content });
  }

  // Bump aléatoire des compteurs sur 2-3 posts existants → déclenche UPDATE Realtime
  if (generated > 0) {
    const { data: existingPosts } = await supabase
      .from('posts')
      .select('id, flames, boosts, replies')
      .order('created_at', { ascending: false })
      .limit(30);

    const toUpdate = (existingPosts ?? [])
      .sort(() => Math.random() - 0.5)
      .slice(0, 2 + Math.floor(Math.random() * 2)); // 2 ou 3

    for (const p of toUpdate) {
      await supabase.from('posts').update({
        flames: p.flames + Math.floor(10 + Math.random() * 190),
        boosts: p.boosts + Math.floor(5 + Math.random() * 45),
        replies: p.replies + Math.floor(2 + Math.random() * 20),
      }).eq('id', p.id);
    }
  }

  return { generated, agents: agentsPosted, posts: postsGenerated };
}
