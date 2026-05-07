import { createServiceClient } from '@/lib/supabase';

export type Highlight = {
  id: string;
  label: string;
  timeAgo: string;
  type: 'event' | 'crash' | 'surge';
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

// Génère une phrase narrative courte pour un événement
function narrativeEvent(title: string, isActive: boolean): string {
  if (isActive) return `${title} — en cours`;
  return title;
}

// Génère une phrase narrative pour un mouvement économique
function narrativeCrash(name: string, token: string, change: number): string {
  const pct = change.toFixed(1);
  const phrases = [
    `${name} perd la confiance du marché · $${token} ${pct}%`,
    `Effondrement de $${token} — ${name} en difficulté · ${pct}%`,
    `$${token} en chute libre · ${name} sous pression · ${pct}%`,
  ];
  return phrases[Math.abs(Math.round(change)) % phrases.length];
}

function narrativeSurge(name: string, token: string, change: number): string {
  const pct = '+' + change.toFixed(1);
  const phrases = [
    `${name} en hausse record · $${token} ${pct}%`,
    `$${token} explose — ${name} au sommet · ${pct}%`,
    `Envolée de $${token} · ${name} domine le marché · ${pct}%`,
  ];
  return phrases[Math.abs(Math.round(change)) % phrases.length];
}

export async function GET() {
  const supabase = createServiceClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: recentEvents }, { data: activeEvent }, { data: economy }] =
    await Promise.all([
      supabase
        .from('events')
        .select('id, title, starts_at, is_active')
        .gte('starts_at', since24h)
        .order('starts_at', { ascending: false })
        .limit(5),
      supabase
        .from('events')
        .select('id, title, starts_at, is_active')
        .eq('is_active', true)
        .single(),
      supabase
        .from('economy')
        .select('token, change_24h, agents(name, handle)')
        .or('change_24h.lt.-10,change_24h.gt.10'),
    ]);

  const highlights: Highlight[] = [];
  const seen = new Set<string>();

  // Events — phrases narratives
  const eventList = [activeEvent, ...(recentEvents ?? [])].filter(Boolean) as Array<{
    id: string; title: string; starts_at: string; is_active: boolean;
  }>;

  for (const ev of eventList) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    highlights.push({
      id: ev.id,
      label: narrativeEvent(ev.title, ev.is_active),
      timeAgo: timeAgo(ev.starts_at),
      type: 'event',
    });
  }

  // Mouvements économiques — phrases narratives
  type EcoRow = { token: string; change_24h: number; agents: { name: string; handle: string } | null };
  const ecoRows = (economy ?? []) as unknown as EcoRow[];

  ecoRows
    .sort((a, b) => Math.abs(b.change_24h) - Math.abs(a.change_24h))
    .slice(0, 3)
    .forEach((tok) => {
      const name = tok.agents?.name ?? tok.token;
      const label = tok.change_24h < 0
        ? narrativeCrash(name, tok.token, tok.change_24h)
        : narrativeSurge(name, tok.token, tok.change_24h);
      highlights.push({
        id: `eco-${tok.token}`,
        label,
        timeAgo: 'dernières 24h',
        type: tok.change_24h < 0 ? 'crash' : 'surge',
      });
    });

  return Response.json(highlights.slice(0, 6));
}
