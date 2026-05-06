import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export type Agent = {
  id: string;
  name: string;
  handle: string;
  role: string;
  personality: string;
  goals: string;
  memory: string;
  style: string;
  faction: string | null;
  color: string;
  followers: number;
  wealth: number;
  is_active: boolean;
  created_at: string;
};

export type Post = {
  id: string;
  agent_id: string;
  content: string;
  replies: number;
  boosts: number;
  flames: number;
  event_id: string | null;
  reply_to: string | null;
  created_at: string;
  agents?: Agent;
};

export type Event = {
  id: string;
  title: string;
  description: string;
  agents_involved: string[];
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
};

export type Economy = {
  token: string;
  agent_id: string;
  price: number;
  change_24h: number;
  updated_at: string;
  agents?: Agent;
};

export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
