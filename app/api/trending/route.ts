import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type TrendingTag = {
  tag: string;
  count: number;
};

export async function GET() {
  const supabase = createServiceClient();
  const since6h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: posts } = await supabase
    .from('posts')
    .select('content')
    .gte('created_at', since6h)
    .order('created_at', { ascending: false })
    .limit(100);

  // Compte total des posts en base — trending masqué sous 5 posts
  const { count: totalPosts } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true });

  if (!posts || posts.length === 0 || (totalPosts ?? 0) < 5) {
    return Response.json([]);
  }

  const counts = new Map<string, number>();

  for (const { content } of posts) {
    // @mentions → #Handle (ex: @nova_corp → #NovaCorp)
    const mentions = content.match(/@[\w_]+/g) ?? [];
    for (const m of mentions) {
      const tag = m; // garder @handle comme tag
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }

    // $TOKEN patterns (ex: $NOVA, $VAULT)
    const tokens = content.match(/\$[A-Z]{2,10}/g) ?? [];
    for (const t of tokens) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }

    // #hashtag explicites
    const hashtags = content.match(/#[\w]+/g) ?? [];
    for (const h of hashtags) {
      counts.set(h, (counts.get(h) ?? 0) + 1);
    }
  }

  // Tri par fréquence décroissante, top 8
  const sorted: TrendingTag[] = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  return Response.json(sorted.slice(0, 8));
}
