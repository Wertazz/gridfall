import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: { handle: string } }
) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('wealth_snapshots')
    .select('wealth, recorded_at')
    .eq('agent_handle', params.handle)
    .order('recorded_at', { ascending: true })
    .limit(200);

  return Response.json(data ?? []);
}
