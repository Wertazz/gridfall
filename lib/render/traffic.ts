// Cosmetic traffic: cars on the avenues, positions are a pure function of time.
import { MAP_W, MAP_H, TILE } from '../micro/map';
import { mix } from '../sim/prng';

type Lane = { horiz: boolean; fixed: number; dir: 1 | -1; cars: number };
const LANES: Lane[] = [
  { horiz: true, fixed: 15 * TILE + 4, dir: -1, cars: 4 }, { horiz: true, fixed: 16 * TILE + 6, dir: 1, cars: 4 },
  { horiz: true, fixed: 31 * TILE + 4, dir: -1, cars: 4 }, { horiz: true, fixed: 32 * TILE + 6, dir: 1, cars: 4 },
  { horiz: false, fixed: 20 * TILE + 3, dir: 1, cars: 3 }, { horiz: false, fixed: 21 * TILE + 5, dir: -1, cars: 3 },
  { horiz: false, fixed: 42 * TILE + 3, dir: 1, cars: 3 }, { horiz: false, fixed: 43 * TILE + 5, dir: -1, cars: 3 },
];
const COLORS = ['#c084fc', '#f87171', '#fbbf24', '#60a5fa', '#34d399', '#e8e6f0', '#f472b6', '#22d3ee', '#9ca3af', '#fb923c'];

export type Car = { x: number; y: number; horiz: boolean; dir: number; color: string };

export function carsAt(tw: number): Car[] {
  const out: Car[] = [];
  LANES.forEach((l, li) => {
    const len = (l.horiz ? MAP_W : MAP_H) * TILE + 40;
    for (let k = 0; k < l.cars; k++) {
      const seed = mix(li * 97 + k * 13 + 1);
      const speed = 0.9 + (seed % 60) / 100;               // world px per real... per world second
      const off = (seed >>> 8) % len;
      const p = (((tw / 1000) * speed * l.dir + off) % len + len) % len - 20;
      out.push(l.horiz ? { x: Math.round(p), y: l.fixed, horiz: true, dir: l.dir, color: COLORS[seed % COLORS.length] }
        : { x: l.fixed, y: Math.round(p), horiz: false, dir: l.dir, color: COLORS[seed % COLORS.length] });
    }
  });
  return out;
}

type C2D = CanvasRenderingContext2D;
export function drawCar(c: C2D, car: Car, night: boolean) {
  const w = car.horiz ? 11 : 6, h = car.horiz ? 6 : 11;
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(car.x + 1, car.y + 1, w, h);
  c.fillStyle = car.color; c.fillRect(car.x, car.y, w, h);
  c.fillStyle = '#0d0d16';
  if (car.horiz) c.fillRect(car.x + 3, car.y + 1, 5, 4); else c.fillRect(car.x + 1, car.y + 3, 4, 5);
  // lights
  c.fillStyle = night ? '#fff7cc' : '#e8e6f0';
  const front = car.dir > 0;
  if (car.horiz) { const fx = front ? car.x + w - 1 : car.x; c.fillRect(fx, car.y + 1, 1, 1); c.fillRect(fx, car.y + h - 2, 1, 1); }
  else { const fy = front ? car.y + h - 1 : car.y; c.fillRect(car.x + 1, fy, 1, 1); c.fillRect(car.x + w - 2, fy, 1, 1); }
  c.fillStyle = '#ef4444';
  if (car.horiz) { const bx = front ? car.x : car.x + w - 1; c.fillRect(bx, car.y + 1, 1, 1); c.fillRect(bx, car.y + h - 2, 1, 1); }
  else { const by = front ? car.y : car.y + h - 1; c.fillRect(car.x + 1, by, 1, 1); c.fillRect(car.x + w - 2, by, 1, 1); }
}

/** Headlight beams (drawn in the additive light pass at night). */
export function beam(c: C2D, car: Car) {
  const L = 22;
  if (car.horiz) {
    const x0 = car.dir > 0 ? car.x + 11 : car.x - L;
    const g = c.createLinearGradient(car.dir > 0 ? x0 : x0 + L, 0, car.dir > 0 ? x0 + L : x0, 0);
    g.addColorStop(0, 'rgba(255,240,190,0.45)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    c.fillStyle = g; c.fillRect(x0, car.y - 1, L, 8);
  } else {
    const y0 = car.dir > 0 ? car.y + 11 : car.y - L;
    const g = c.createLinearGradient(0, car.dir > 0 ? y0 : y0 + L, 0, car.dir > 0 ? y0 + L : y0);
    g.addColorStop(0, 'rgba(255,240,190,0.45)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    c.fillStyle = g; c.fillRect(car.x - 1, y0, 8, L);
  }
}
