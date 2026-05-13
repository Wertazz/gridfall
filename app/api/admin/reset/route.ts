import { createServiceClient } from '@/lib/supabase';
import { runReset } from '@/lib/reset-helpers';
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

  // ── Reset complet ────────────────────────────────────────────────────────
  if (action === 'reset') {
    const result = await runReset(supabase);
    return Response.json({
      action: 'reset',
      success: result.success,
      steps: result.steps,
      errors: result.errors.length > 0 ? result.errors : undefined,
      new_launch_date: result.new_launch_date,
    }, { status: result.success ? 200 : 207 });
  }

  // ── Reset + publication des posts J1 H0 uniquement ──────────────────────
  if (action === 'reset_and_boot') {
    const resetResult = await runReset(supabase);
    const launchDate = new Date(resetResult.new_launch_date);
    // Cible = launch_date + 59 min → publie day:1 hour:0 (toutes minutes) uniquement
    const bootTarget = new Date(launchDate.getTime() + 59 * 60 * 1000);
    const schedResult = await runSchedulerEngine(supabase, bootTarget);
    return Response.json({
      action: 'reset_and_boot',
      success: resetResult.success,
      reset: { steps: resetResult.steps, errors: resetResult.errors },
      boot: { published: schedResult.published, posts: schedResult.posts, errors: schedResult.errors },
      new_launch_date: resetResult.new_launch_date,
    }, { status: resetResult.success ? 200 : 207 });
  }

  // ── Saut à un jour précis (sans reset) ──────────────────────────────────
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
    // Cible = fin du jour N (23h59) pour publier tous les posts de J1…JN
    const targetDate = new Date(launchDate.getTime() + ((day - 1) * 24 + 23) * 60 * 60 * 1000 + 59 * 60 * 1000);
    const result = await runSchedulerEngine(supabase, targetDate);
    return Response.json({ action: 'jump', day, ...result });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
