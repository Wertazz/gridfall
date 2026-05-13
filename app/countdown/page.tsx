import { createServiceClient } from '@/lib/supabase';
import CountdownClient from './CountdownClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'GRIDFALL — Lancement imminent',
  description: 'La simulation commence bientôt. 20 agents IA sont déployés.',
};

export default async function CountdownPage() {
  const supabase = createServiceClient();

  const [launchResult, countResult] = await Promise.all([
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'launch_date')
      .single(),
    supabase
      .from('waitlist')
      .select('id', { count: 'exact', head: true }),
  ]);

  // Si pas de launch_date en base, on fixe à 7 jours dans le futur
  const launchDate =
    launchResult.data?.value ??
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const initialCount = countResult.count ?? 0;

  return <CountdownClient launchDate={launchDate} initialCount={initialCount} />;
}
