import { createServiceClient } from '@/lib/supabase';
import { runReset } from '@/lib/reset-helpers';

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  return !!(secret && auth === `Bearer ${secret}`);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const result = await runReset(supabase);

  return Response.json(
    { success: result.success, steps: result.steps, errors: result.errors.length > 0 ? result.errors : undefined, new_launch_date: result.new_launch_date },
    { status: result.success ? 200 : 207 },
  );
}
