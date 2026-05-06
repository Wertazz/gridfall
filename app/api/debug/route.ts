import { createServiceClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServiceClient();

  const [eventRes, voteRes, priceRes, wealthRes, tokensRes] = await Promise.all([
    supabase.from('events').select('id, title').eq('is_active', true).single(),
    supabase.from('votes').select('id', { count: 'exact', head: true }),
    supabase.from('price_history').select('id', { count: 'exact', head: true }),
    supabase.from('wealth_snapshots').select('id', { count: 'exact', head: true }),
    supabase.from('economy').select('token, price, updated_at').order('price', { ascending: false }),
  ]);

  return Response.json({
    activeEvent: eventRes.data,
    voteCount: voteRes.count,
    priceHistoryCount: priceRes.count,
    wealthCount: wealthRes.count,
    tokens: tokensRes.data,
  });
}
