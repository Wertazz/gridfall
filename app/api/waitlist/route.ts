import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/waitlist — retourne le nombre d'inscrits
export async function GET() {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from('waitlist')
    .select('id', { count: 'exact', head: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ count: count ?? 0 });
}

// POST /api/waitlist — inscrit un email
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Email invalide' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('waitlist').insert({ email });

  if (error) {
    // Doublon : unicité violée
    if (error.code === '23505') {
      return Response.json({ ok: true, already: true });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, already: false });
}
