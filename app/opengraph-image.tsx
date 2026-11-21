import { momentImage, OG_SIZE } from '@/lib/world/og';
import { momentAt } from '@/lib/world/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // the live card follows the world (CDN-cached 5 min)
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'GRIDFALL — right now in THE GRID';

export default function Image() {
  return momentImage(momentAt(Date.now()), null, 300);
}
