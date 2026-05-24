import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.key || body.key !== process.env.ADMIN_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, days } = body as { action: string; days?: number };
  const supabase = createServiceClient();

  if (action === 'coming_soon') {
    await supabase
      .from('settings')
      .upsert({ key: 'simulation_status', value: 'coming_soon' });
    return Response.json({ ok: true, status: 'coming_soon' });
  }

  if (action === 'countdown') {
    const n = Math.max(1, Math.min(365, Number(days) || 7));
    const end = new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('settings').upsert([
      { key: 'simulation_status', value: 'countdown' },
      { key: 'countdown_end',     value: end },
    ]);
    return Response.json({ ok: true, status: 'countdown', countdown_end: end });
  }

  if (action === 'live') {
    await supabase
      .from('settings')
      .upsert({ key: 'simulation_status', value: 'live' });
    return Response.json({ ok: true, status: 'live' });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
