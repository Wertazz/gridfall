import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/waitlist — how many observers wait for the next agent to be born
export async function GET() {
  const { count, error } = await createServiceClient().from('waitlist').select('id', { count: 'exact', head: true });
  if (error) return Response.json({ error: 'Unavailable' }, { status: 503 });
  return Response.json({ count: count ?? 0 });
}

// POST /api/waitlist — "Get notified when the next agent is born"
export async function POST(req: Request) {
  let body: { email?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Invalid email' }, { status: 400 });
  const { error } = await createServiceClient().from('waitlist').insert({ email });
  if (error) {
    if (error.code === '23505') return Response.json({ ok: true, already: true }); // already registered
    return Response.json({ error: 'Unavailable' }, { status: 503 });
  }
  return Response.json({ ok: true, already: false });
}
