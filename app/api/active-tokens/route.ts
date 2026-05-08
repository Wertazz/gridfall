import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Retourne l'union des tokens « actifs » :
 * 1. Tokens depuis economy où price != 100 OU change_24h != 0
 * 2. Tokens distincts depuis portfolio (achetés par n'importe quel agent)
 *
 * Cela garantit qu'un token créé mais pas encore bougé apparaît
 * dès qu'un agent l'achète.
 */
export async function GET() {
  const supabase = createServiceClient();

  // 1. Tokens avec prix ou variation non-neutres
  const { data: econTokens } = await supabase
    .from('economy')
    .select('token')
    .or('price.neq.100,change_24h.neq.0');

  // 2. Tous les tokens détenus dans les portfolios
  const { data: portTokens } = await supabase
    .from('portfolio')
    .select('token');

  const tokenSet = new Set<string>();
  for (const r of econTokens ?? []) tokenSet.add(r.token);
  for (const r of portTokens ?? []) tokenSet.add(r.token);

  return Response.json({ tokens: Array.from(tokenSet) });
}
