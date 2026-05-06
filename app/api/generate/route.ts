import { generatePosts } from '@/lib/generate-posts';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  await generatePosts();
  return new Response('OK', { status: 200 });
}
