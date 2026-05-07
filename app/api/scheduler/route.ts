import { createServiceClient } from '@/lib/supabase';
import { STORY } from '@/lib/story-scheduler';
import { runSchedulerEngine } from '@/lib/scheduler-engine';

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  if (req.headers.get('x-vercel-cron') === '1') return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'launch_date')
    .single();

  if (!setting?.value) {
    return Response.json({ error: 'launch_date not found in settings' }, { status: 500 });
  }

  const launchDate = new Date(setting.value);
  const { published, posts, errors } = await runSchedulerEngine(supabase, launchDate);

  if (published === 0 && errors.length === 0) {
    return Response.json({ published: 0, message: 'Nothing to publish' });
  }

  return Response.json({
    published,
    posts,
    errors: errors.length > 0 ? errors : undefined,
    total_story: STORY.length,
  });
}
