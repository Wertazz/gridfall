import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const supabase = createServiceClient();

  // Récupère les 47 derniers points historiques + le prix live de economy
  const [historyRes, liveRes] = await Promise.all([
    supabase
      .from('price_history')
      .select('price, recorded_at')
      .eq('token', params.token)
      .order('recorded_at', { ascending: false }) // DESC → les plus récents d'abord
      .limit(47),
    supabase
      .from('economy')
      .select('price, updated_at')
      .eq('token', params.token)
      .single(),
  ]);

  // Remet dans l'ordre chronologique (ASC)
  const history = (historyRes.data ?? []).reverse();

  const livePrice = liveRes.data?.price;

  console.log(`[price-history/${params.token}] history last:`, history.at(-1)?.price, '| live economy:', livePrice);

  // Ajoute le prix actuel comme dernier point — toujours le plus récent sur l'axe X
  if (livePrice !== undefined) {
    history.push({ price: livePrice, recorded_at: new Date().toISOString() });
  }

  return Response.json(history);
}
