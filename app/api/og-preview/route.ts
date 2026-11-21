// Development only: renders the OG card on the edge runtime (next/og's node runtime is broken on Windows).
import { momentImage } from '@/lib/world/og';
import { momentFromState } from '@/lib/world/moment';
import { genesisState, replay } from '@/lib/sim/step';
import { GENESIS_MS, MINUTE_MS } from '@/lib/sim/config';

export const runtime = 'edge';

export function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 });
  const t = Number(new URL(req.url).searchParams.get('t')) || Date.now();
  const hour = Math.floor((t - GENESIS_MS) / MINUTE_MS / 60) + 1;
  if (hour > 3000) return new Response('too far for preview', { status: 400 });
  return momentImage(momentFromState(replay(genesisState(), hour), t));
}
