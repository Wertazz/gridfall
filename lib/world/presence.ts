// Observers as floating eyes (Supabase Realtime Presence, free tier).
// COSMETIC ONLY: this module never touches the world state. If Realtime is down,
// eyes simply disappear and nothing else changes.
import { createClient as createSupabase, type RealtimeChannel } from '@supabase/supabase-js';
import type { Eye } from '../render/renderer';

export type PresenceHandle = { stop: () => void };

type Opts = {
  getCamera: () => { x: number; y: number } | null;
  onEyes: (eyes: Eye[], observers: number | null) => void;
};

export function startPresence({ getCamera, onEyes }: Opts): PresenceHandle {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) { onEyes([], null); return { stop: () => {} }; }
  const me = Math.random().toString(36).slice(2, 10); // anonymous, per tab
  let channel: RealtimeChannel | null = null;
  let alive = true, ok = false, last = { x: -1, y: -1 };
  const client = createSupabase(url, anon, { realtime: { params: { eventsPerSecond: 2 } } });

  const fail = () => { ok = false; onEyes([], null); };
  const timeout = setTimeout(() => { if (!ok) fail(); }, 3000);

  try {
    channel = client.channel('world-presence', { config: { presence: { key: me } } });
    channel.on('presence', { event: 'sync' }, () => {
      if (!channel) return;
      const st = channel.presenceState() as Record<string, Array<{ x?: number; y?: number }>>;
      const eyes: Eye[] = [];
      let n = 0;
      for (const [k, metas] of Object.entries(st)) {
        n++;
        if (k === me) continue;
        const m = metas[metas.length - 1];
        if (typeof m?.x === 'number' && typeof m?.y === 'number') eyes.push({ x: m.x, y: m.y });
      }
      onEyes(eyes.slice(0, 60), n);
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') { ok = true; clearTimeout(timeout); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') fail();
    });
  } catch { fail(); }

  // ~1 update per second, only when the camera actually moved.
  const tick = setInterval(() => {
    if (!alive || !ok || !channel) return;
    const c = getCamera(); if (!c) return;
    const x = Math.round(c.x), y = Math.round(c.y);
    if (Math.abs(x - last.x) + Math.abs(y - last.y) < 8) return;
    last = { x, y };
    channel.track({ x, y }).catch(() => {});
  }, 1000);

  return {
    stop: () => {
      alive = false; clearInterval(tick); clearTimeout(timeout);
      if (channel) client.removeChannel(channel).catch(() => {});
    },
  };
}
