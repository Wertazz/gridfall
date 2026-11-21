// Pure part of a "moment": given the macro state at time t, find what is worth showing.
import { GENESIS_MS, MINUTE_MS } from '../sim/config';
import { stateHash, type WorldState, type WorldEvent } from '../sim/state';
import { STORYLETS } from '../sim/storylets';
import { eventText, type EventText } from '../lines/grammar';

export type Moment = { t: number; minute: number; state: WorldState; hash: string; event: WorldEvent | null; text: EventText | null };

export function momentFromState(s: WorldState, t: number): Moment {
  const minute = Math.floor((t - GENESIS_MS) / MINUTE_MS);
  const recent = s.log.filter((e) => e.hour * 60 + e.minute <= minute && minute - (e.hour * 60 + e.minute) <= 180);
  const event = recent.slice().sort((a, b) => STORYLETS[b.sid].major - STORYLETS[a.sid].major || b.seq - a.seq)[0] ?? null;
  return { t, minute, state: s, hash: stateHash(s), event, text: event ? eventText(s, event) : null };
}
