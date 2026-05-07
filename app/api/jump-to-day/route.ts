import { createServiceClient } from '@/lib/supabase';
import { AGENTS } from '@/lib/agents.config';
import { runSchedulerEngine } from '@/lib/scheduler-engine';

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  return !!(secret && auth === `Bearer ${secret}`);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const day = parseInt(url.searchParams.get('day') ?? '', 10);

  if (isNaN(day) || day < 1 || day > 7) {
    return Response.json({ error: 'Invalid day — must be 1-7' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const resetErrors: string[] = [];

  // ── 1. RESET COMPLET ────────────────────────────────────────────────────────

  const tables: Array<{ table: string; column: string }> = [
    { table: 'votes',           column: 'created_at'   },
    { table: 'posts',           column: 'created_at'   },
    { table: 'events',          column: 'created_at'   },
    { table: 'story_log',       column: 'published_at' },
    { table: 'wealth_snapshots',column: 'recorded_at'  },
    { table: 'portfolio',       column: 'created_at'   },
    { table: 'price_history',   column: 'recorded_at'  },
  ];

  for (const { table, column } of tables) {
    const { error } = await supabase.from(table).delete().gte(column, '2000-01-01');
    if (error) resetErrors.push(`${table}: ${error.message}`);
  }

  // Reset economy
  const INITIAL_PRICES: Record<string, number> = {
    '$NOVA': 100, '$APEX': 100, '$VAULT': 100, '$ZERO': 100,
    '$EDEN': 100, '$NYX':  100, '$FLUX':  100, '$BYTE': 100,
  };
  const econNow = new Date().toISOString();
  for (const [token, price] of Object.entries(INITIAL_PRICES)) {
    await supabase.from('economy').update({
      price, change_24h: 0, updated_at: econNow,
    }).eq('token', token);
  }

  // Reset agents
  for (const agent of AGENTS) {
    await supabase.from('agents').update({
      followers: 1000, wealth: 1000, memory: '',
    }).eq('handle', agent.handle);
  }

  // Reset settings drama + capital
  await supabase.from('settings').upsert({ key: 'drama_level', value: '0' });
  await supabase.from('settings').upsert({ key: 'capital',     value: '0' });

  // ── 2. LAUNCH_DATE = now() − (day−1) × 24h ─────────────────────────────────
  //    elapsed = (day-1)*24h → tous les posts jusqu'à la fin de J(day-1) sont dus
  const launchDate = new Date(Date.now() - (day - 1) * 24 * 60 * 60 * 1000);
  await supabase.from('settings').upsert({
    key: 'launch_date',
    value: launchDate.toISOString(),
  });

  // ── 3. SCHEDULER ────────────────────────────────────────────────────────────
  const { published, posts, errors: schedErrors } = await runSchedulerEngine(supabase, launchDate);

  const allErrors = [...resetErrors, ...schedErrors];

  console.log(`[jump-to-day] day=${day} launch=${launchDate.toISOString()} published=${published}`);

  return Response.json({
    jumped_to_day: day,
    launch_date: launchDate.toISOString(),
    published,
    posts,
    errors: allErrors.length > 0 ? allErrors : undefined,
  }, { status: allErrors.length > 0 ? 207 : 200 });
}
