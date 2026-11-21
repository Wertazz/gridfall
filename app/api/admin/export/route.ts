import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const key = String(form?.get('key') ?? '');
  const expected = process.env.ADMIN_KEY ?? '';
  if (!expected || !safeEqual(key, expected)) return new Response('Unauthorized', { status: 401 });
  const { data, error } = await createServiceClient().from('waitlist').select('email, created_at').order('created_at', { ascending: true });
  if (error) return new Response('Export failed', { status: 500 });
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['email,created_at', ...(data ?? []).map((r) => `${esc(r.email)},${esc(r.created_at)}`)].join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="gridfall-waitlist.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
