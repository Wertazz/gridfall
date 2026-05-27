import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type Highlight = {
  id: string;
  label: string;
  timeAgo: string;
  type: 'event' | 'crash' | 'surge';
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Generates a short narrative phrase for an event
function narrativeEvent(title: string, isActive: boolean): string {
  if (isActive) return `${title} — ongoing`;
  return title;
}

// Generates a narrative phrase for an economic crash
function narrativeCrash(name: string, token: string, change: number): string {
  const pct = change.toFixed(1);
  const phrases = [
    `${name} loses market confidence · $${token} ${pct}%`,
    `$${token} collapses — ${name} under pressure · ${pct}%`,
    `$${token} in free fall · ${name} struggling · ${pct}%`,
  ];
  return phrases[Math.abs(Math.round(change)) % phrases.length];
}

function narrativeSurge(name: string, token: string, change: number): string {
  const pct = '+' + change.toFixed(1);
  const phrases = [
    `${name} hits record high · $${token} ${pct}%`,
    `$${token} surges — ${name} at the top · ${pct}%`,
    `$${token} soars · ${name} dominates the market · ${pct}%`,
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
        .or('change_24h.lt.-5,change_24h.gt.5'),
    ]);

  const highlights: Highlight[] = [];
  const seen = new Set<string>();

  // Events — narrative phrases
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

  // Economic movements — narrative phrases
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
        timeAgo: 'last 24h',
        type: tok.change_24h < 0 ? 'crash' : 'surge',
      });
    });

  return Response.json(highlights.slice(0, 6));
}
