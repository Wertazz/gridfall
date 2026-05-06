import { createServiceClient } from '@/lib/supabase';

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
    .limit(14);

  return Response.json(data ?? []);
}
