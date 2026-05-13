import { createServiceClient } from '@/lib/supabase';
import { runSchedulerEngine } from '@/lib/scheduler-engine';

export const dynamic = 'force-dynamic';

// POST /api/admin/reset — body: { key, action, day? }
export async function POST(req: Request) {
  let body: { key?: string; action?: string; day?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || body.key !== adminKey) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const action = body.action ?? 'reset';
  const supabase = createServiceClient();

  if (action === 'jump') {
    const day = body.day ?? 1;
    if (isNaN(day) || day < 1 || day > 30) {
      return Response.json({ error: 'Invalid day' }, { status: 400 });
    }

    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'launch_date')
      .single();

    if (!settings?.value) {
      return Response.json({ error: 'No launch_date in settings' }, { status: 400 });
    }

    const launchDate = new Date(settings.value);
    const targetDate = new Date(launchDate.getTime() + (day - 1) * 24 * 60 * 60 * 1000);

    const result = await runSchedulerEngine(supabase, targetDate);
    return Response.json({ action: 'jump', day, ...result });
  }

  // action === 'reset'
  const CRON_SECRET = process.env.CRON_SECRET ?? '';
  const resetRes = await fetch(
    new URL('/api/reset-world', req.url).toString(),
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    }
  );
  const resetData = await resetRes.json();
  return Response.json({ action: 'reset', ...resetData });
}
