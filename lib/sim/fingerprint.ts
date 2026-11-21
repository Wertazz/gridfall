// Identifies the simulation version: hash of the world after its first two days.
import { genesisState, replay } from './step';
import { stateHash } from './state';

let fp: string | null = null;
export function simFingerprint(): string {
  if (!fp) fp = stateHash(replay(genesisState(), 48));
  return fp;
}
