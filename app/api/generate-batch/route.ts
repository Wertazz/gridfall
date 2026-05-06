import { generatePosts } from '@/lib/generate-posts';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const result = await generatePosts(8);
  return Response.json(result);
}
