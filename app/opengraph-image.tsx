import { momentImage, OG_SIZE } from '@/lib/world/og';
import { momentAt } from '@/lib/world/server';

export const runtime = 'nodejs';
export const revalidate = 300; // the live card follows the world every 5 minutes
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'GRIDFALL — right now in THE GRID';

export default function Image() {
  return momentImage(momentAt(Date.now()));
}
