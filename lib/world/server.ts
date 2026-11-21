// Server-side world access (OG images, metadata): checkpoint from disk + bounded replay.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CHECKPOINT_HOURS, GENESIS_MS, MINUTE_MS } from '../sim/config';
import { genesisState, replay } from '../sim/step';
import { deserialize, type WorldState } from '../sim/state';
import { momentFromState, type Moment } from './moment';
export type { Moment };
import { simFingerprint } from '../sim/fingerprint';

function loadCheckpoint(k: number): WorldState | null {
  if (k <= 0) return null;
  const dir = path.join(process.cwd(), 'public', 'checkpoints');
  try {
    const idx = JSON.parse(readFileSync(path.join(dir, 'index.json'), 'utf8')) as { fingerprint?: string };
    if (idx.fingerprint !== simFingerprint()) return null;
    const f = path.join(dir, `${k}.bin`);
    if (!existsSync(f)) return null;
    const buf = readFileSync(f);
    const words = new Int32Array(buf.length / 4);
    for (let i = 0; i < words.length; i++) words[i] = buf.readInt32LE(i * 4);
    return deserialize(words);
  } catch { return null; }
}

export function parseIso(iso: string): number | null {
  const t = Date.parse(decodeURIComponent(iso));
  if (!Number.isFinite(t) || t < GENESIS_MS) return null;
  return t;
}

/** The macro state at real time t, plus the most remarkable event of the preceding world hours. */
export function momentAt(t: number): Moment | null {
  const minute = Math.floor((t - GENESIS_MS) / MINUTE_MS);
  if (minute < 0) return null;
  const hour = Math.floor(minute / 60) + 1;
  let k = Math.floor(hour / CHECKPOINT_HOURS);
  let s: WorldState | null = null;
  while (k > 0 && !s) { s = loadCheckpoint(k); if (!s) k--; }
  if (!s || s.hour > hour) s = genesisState();
  if (hour - s.hour > 20_000) return null; // refuse unbounded work
  return momentFromState(replay(s, hour), t);
}
