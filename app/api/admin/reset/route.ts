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
  console.log(`[admin/reset] action=${action} day=${body.day ?? '-'}`);
  const supabase = createServiceClient();

  // ── Reset complet (DB vide, launch_date = now) ───────────────────────────
  if (action === 'reset') {
    const result = await runReset(supabase);
    console.log('[admin/reset] reset done:', result.steps, 'errors:', result.errors);
    return Response.json({
      action: 'reset',
      success: result.success,
      steps: result.steps,
      errors: result.errors.length > 0 ? result.errors : undefined,
      new_launch_date: result.new_launch_date,
    }, { status: result.success ? 200 : 207 });
  }

  // ── Reset + boot J1H0+H1 ────────────────────────────────────────────────
  // Formule identique à jump-to-day :
  //   launchDate = Date.now() - elapsed_cible
  //   elapsed = 2h → publie tous les posts simHour ≤ 2 (day:1 hour:0 et hour:1)
  if (action === 'reset_and_boot') {
    const resetResult = await runReset(supabase);
    console.log('[admin/reset] reset done, steps:', resetResult.steps, 'errors:', resetResult.errors);

    // Recule launch_date de 2h : elapsed = 2h, posts hour:0 et hour:1 dus
    const bootLaunchDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
    console.log('[admin/reset] boot launchDate (now-2h):', bootLaunchDate.toISOString());

    // Mise à jour de launch_date en DB pour que le scheduler continue correctement
    await supabase.from('settings').upsert({
      key: 'launch_date',
      value: bootLaunchDate.toISOString(),
    });

    const schedResult = await runSchedulerEngine(supabase, bootLaunchDate);
    console.log('[admin/reset] boot done — published:', schedResult.published, 'posts:', schedResult.posts, 'errors:', schedResult.errors);

    return Response.json({
      action: 'reset_and_boot',
      success: resetResult.success,
      reset: { steps: resetResult.steps, errors: resetResult.errors },
      boot: { published: schedResult.published, posts: schedResult.posts, errors: schedResult.errors },
      new_launch_date: bootLaunchDate.toISOString(),
    }, { status: resetResult.success ? 200 : 207 });
  }

  // ── Saut à un jour précis (sans reset) ──────────────────────────────────
  // Formule copiée de /api/jump-to-day :
  //   launchDate = Date.now() - (day-1)*24h
  //   → elapsed = (day-1)*24h → tous les posts de J1 à J(day-1) sont dus
  if (action === 'jump') {
    const day = body.day ?? 1;
    if (isNaN(day) || day < 1 || day > 30) {
      return Response.json({ error: 'Invalid day' }, { status: 400 });
    }

    const jumpLaunchDate = new Date(Date.now() - (day - 1) * 24 * 60 * 60 * 1000);
    console.log(`[admin/reset] jump day=${day} launchDate:`, jumpLaunchDate.toISOString());

    // Met à jour launch_date en DB
    await supabase.from('settings').upsert({
      key: 'launch_date',
      value: jumpLaunchDate.toISOString(),
    });

    const result = await runSchedulerEngine(supabase, jumpLaunchDate);
    console.log('[admin/reset] jump done — published:', result.published, 'errors:', result.errors);

    return Response.json({ action: 'jump', day, ...result });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
