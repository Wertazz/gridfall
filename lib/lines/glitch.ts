// Oracle mode: deterministic partial corruption of text seen from the future.
import { mix } from '../sim/prng';

const GLYPHS = '█▓▒░#@%&?¿§¤∆◊∑µ';

export function corrupt(text: string, seed: number, strength: number): string {
  if (strength <= 0) return text;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const r = mix(seed * 31 + i) % 100;
    out += ch !== ' ' && r < strength ? GLYPHS[mix(r + i) % GLYPHS.length] : ch;
  }
  return out;
}
