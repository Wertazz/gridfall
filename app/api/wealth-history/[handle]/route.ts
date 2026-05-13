import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: { handle: string } }
) {
  const supabase = createServiceClient();

  const [snapshotsResult, settingsResult] = await Promise.all([
    supabase
      .from('wealth_snapshots')
      .select('wealth, recorded_at')
      .eq('agent_handle', params.handle)
      .order('recorded_at', { ascending: true })
      .limit(200),
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'launch_date')
      .single(),
  ]);

  return Response.json({
    snapshots: snapshotsResult.data ?? [],
    launchDate: settingsResult.data?.value ?? null,
  });
}
