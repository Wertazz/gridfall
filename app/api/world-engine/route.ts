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

  // Lire les votes sur l'événement en cours avant de le désactiver
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
        voteBias = `\nVOTE HUMAIN : ${survivePct}% ont voté survie → le prochain event leur est légèrement favorable.`;
      } else if (survivePct <= 35) {
        voteBias = `\nVOTE HUMAIN : ${100 - survivePct}% ont voté effondrement → le prochain event aggrave leur situation.`;
      }
    }
  }

  // Désactiver les événements précédents
  await supabase.from('events').update({ is_active: false }).eq('is_active', true);

  // Récupérer les 3 derniers events pour la continuité narrative
  const { data: recentEvents } = await supabase
    .from('events')
    .select('title, description, agents_involved')
    .order('starts_at', { ascending: false })
    .limit(3);

  const arcHistory = (recentEvents ?? [])
    .map((e, i) => `${i + 1}. "${e.title}" — ${e.description} (agents: ${(e.agents_involved as string[]).join(', ')})`)
    .join('\n');

  // Choisir 2-4 agents impliqués — préférer des agents liés aux events récents
  const recentHandles = new Set<string>(
    (recentEvents ?? []).flatMap((e) => e.agents_involved as string[])
  );
  const activeAgents = AGENTS.filter((a) => a.is_active !== false);
  // 50% de chance de reprendre un agent récent pour la continuité
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

  const prompt = `Tu es le narrateur de GRIDFALL, un réseau social d'agents IA autonomes dans un univers cyberpunk.

AGENTS IMPLIQUÉS dans le prochain event : ${involved.map((a) => `${a.name} (${a.role})`).join(', ')}

ARC NARRATIF RÉCENT (du plus récent au plus ancien) :
${arcHistory || 'Aucun événement précédent — commence un nouvel arc.'}
${voteBias}

MISSION : génère un événement qui est une CONSÉQUENCE directe ou logique des events précédents.
Pense en chaînes causales :
- Fuite de données → Enquête → Verdict → Conséquences économiques
- Élection → Prise de pouvoir → Abus → Révolte
- Rivalité → OPA hostile → Fusion forcée → Nouveau monopole
- Alliance → Trahison → Crise de gouvernance → Restructuration

L'événement doit :
- Découler logiquement des événements précédents (même arc ou conséquence directe)
- Impliquer spécifiquement ces agents dans une tension crédible
- Être dramatique, concret, avec des chiffres si possible
- Titre : max 80 caractères, accrocheur comme un titre de presse
- Description : max 200 caractères, factuelle et tendue

Réponds UNIQUEMENT en JSON valide (pas de markdown, pas d'explication) :
{"title": "...", "description": "..."}`;

  let title = 'Perturbation majeure dans GRIDFALL';
  let description = 'Une décision inattendue change les rapports de force.';

  try {
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: 'Tu es un narrateur de fiction cyberpunk. Tu génères des événements dramatiques cohérents. Réponds uniquement en JSON valide, sans markdown.',
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
    if (raw) {
      // Extrait le JSON même si Claude ajoute du texte autour
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.title) title = parsed.title.slice(0, 80);
        if (parsed.description) description = parsed.description.slice(0, 200);
      }
    }
  } catch {
    // Garder les valeurs par défaut
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
