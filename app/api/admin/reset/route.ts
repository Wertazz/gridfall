import { createServiceClient } from '@/lib/supabase';
import { runSchedulerEngine } from '@/lib/scheduler-engine';

export const dynamic = 'force-dynamic';

function isAuthorized(req: Request): boolean {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const adminKey = process.env.ADMIN_KEY;
  return !!(adminKey && key === adminKey);
}

// POST /api/admin/reset?key=ADMIN_KEY&action=reset|jump&day=N
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'reset';
  const supabase = createServiceClient();

  if (action === 'jump') {
    const day = parseInt(url.searchParams.get('day') ?? '1', 10);
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

  // action === 'reset' — réplique reset-world
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
