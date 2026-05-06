import { createServiceClient } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('event_id');
  if (!eventId) return Response.json({ survive: 0, collapse: 0 });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('votes')
    .select('choice')
    .eq('event_id', eventId);

  const survive = data?.filter((v) => v.choice === 'survive').length ?? 0;
  const collapse = data?.filter((v) => v.choice === 'collapse').length ?? 0;

  return Response.json({ survive, collapse });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { event_id, choice, voter_fingerprint } = body;

  if (!event_id || !choice || !voter_fingerprint) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('votes')
    .upsert(
      { event_id, choice, voter_fingerprint },
      { onConflict: 'event_id,voter_fingerprint' }
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
