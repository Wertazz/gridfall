import WorldClient from '@/components/world/WorldClient';

export default function Home({ searchParams }: { searchParams: { focus?: string } }) {
  return <WorldClient focus={searchParams.focus ?? null} />;
}
