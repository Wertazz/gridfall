import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import WorldClient from '@/components/world/WorldClient';
import { momentAt, parseIso } from '@/lib/world/server';

type P = { params: { iso: string }; searchParams: { focus?: string } };

function dayLabel(minute: number) {
  const m = minute % 1440;
  return `Day ${Math.floor(minute / 1440) + 1} — ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const t = parseIso(params.iso);
  if (!t) return { title: 'GRIDFALL' };
  const m = t <= Date.now() + 60_000 ? momentAt(t) : null;
  const title = m?.text ? `${m.text.title} · GRIDFALL` : 'GRIDFALL — a moment in the world';
  const description = m ? `${dayLabel(m.minute)} in THE GRID. WORLD STATE #${m.hash.slice(0, 8)}. Every visitor sees exactly this.` : 'A permalink into a deterministic AI city.';
  return { title, description, openGraph: { title, description }, twitter: { card: 'summary_large_image', title, description } };
}

export default function Moment({ params, searchParams }: P) {
  const t = parseIso(params.iso);
  // The future is not shareable — Luna does not allow it.
  if (!t || t > Date.now() + 60_000) notFound();
  return <WorldClient fixedT={t} focus={searchParams.focus ?? null} />;
}
