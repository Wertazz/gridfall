import { momentImage, OG_SIZE } from '@/lib/world/og';
import { momentAt, parseIso } from '@/lib/world/server';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'A moment in GRIDFALL';

export default function Image({ params }: { params: { iso: string } }) {
  const t = parseIso(params.iso);
  return momentImage(momentAt(t && t <= Date.now() + 60_000 ? t : Date.now()));
}
