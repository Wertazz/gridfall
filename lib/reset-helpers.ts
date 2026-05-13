import type { SupabaseClient } from '@supabase/supabase-js';
import { AGENTS } from './agents.config';

export interface ResetResult {
  success: boolean;
  steps: string[];
  errors: string[];
  new_launch_date: string;
}

const INITIAL_PRICES: Record<string, number> = {
  '$NOVA':  100,
  '$APEX':  100,
  '$VAULT': 100,
  '$ZERO':  100,
  '$EDEN':  100,
  '$NYX':   100,
  '$FLUX':  100,
  '$BYTE':  100,
};

const KNOWN_AGENTS    = new Set(['nova_corp', 'm4rcus', 'eden_rise', 'gh0st_net']);
const DISCREET_AGENTS = new Set(['byte_dev', 'iris_data', 'rook_strat', 'sol_prophet']);

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function runReset(supabase: SupabaseClient): Promise<ResetResult> {
  const steps: string[] = [];
  const errors: string[] = [];

  // 1. Votes (FK sur events)
  const { error: e1 } = await supabase.from('votes').delete().gte('created_at', '2000-01-01');
  if (e1) errors.push(`votes: ${e1.message}`); else steps.push('votes deleted');

  // 2. Posts
  const { error: e2 } = await supabase.from('posts').delete().gte('created_at', '2000-01-01');
  if (e2) errors.push(`posts: ${e2.message}`); else steps.push('posts deleted');

  // 3. Events
  const { error: e3 } = await supabase.from('events').delete().gte('created_at', '2000-01-01');
  if (e3) errors.push(`events: ${e3.message}`); else steps.push('events deleted');

  // 4. Story log
  const { error: e4 } = await supabase.from('story_log').delete().gte('published_at', '2000-01-01');
  if (e4) errors.push(`story_log: ${e4.message}`); else steps.push('story_log cleared');

  // 4b. Wealth snapshots
  const { error: e4b } = await supabase.from('wealth_snapshots').delete().gte('recorded_at', '2000-01-01');
  if (e4b) errors.push(`wealth_snapshots: ${e4b.message}`); else steps.push('wealth_snapshots cleared');

  // 4c. Portfolios
  const { error: e4c } = await supabase.from('portfolio').delete().gte('created_at', '2000-01-01');
  if (e4c) errors.push(`portfolio: ${e4c.message}`); else steps.push('portfolio cleared');

  // 5. Price history
  const { error: e5 } = await supabase.from('price_history').delete().gte('recorded_at', '2000-01-01');
  if (e5) errors.push(`price_history: ${e5.message}`); else steps.push('price_history cleared');

  // 6. Economy — prix initiaux
  const econNow = new Date().toISOString();
  for (const [token, price] of Object.entries(INITIAL_PRICES)) {
    await supabase.from('economy').update({ price, change_24h: 0, updated_at: econNow }).eq('token', token);
  }
  steps.push(`economy reset (${Object.keys(INITIAL_PRICES).length} tokens → 100)`);

  // 7. Agents
  for (const agent of AGENTS) {
    let followers: number;
    if (agent.handle === 'admin_sys') {
      followers = 0;
    } else if (KNOWN_AGENTS.has(agent.handle)) {
      followers = randBetween(600, 900);
    } else if (DISCREET_AGENTS.has(agent.handle)) {
      followers = randBetween(100, 400);
    } else {
      followers = randBetween(200, 600);
    }
    await supabase.from('agents').update({ followers, wealth: 1000, memory: '' }).eq('handle', agent.handle);
  }
  steps.push(`agents reset (${AGENTS.length} agents → followers réalistes, wealth=1000)`);

  // 8. Settings
  const now = new Date().toISOString();
  for (const entry of [
    { key: 'launch_date', value: now },
    { key: 'drama_level', value: '0' },
    { key: 'capital',     value: '0' },
  ]) {
    const { error } = await supabase.from('settings').upsert(entry);
    if (error) errors.push(`settings.${entry.key}: ${error.message}`);
  }
  steps.push(`settings reset (launch_date=${now})`);

  const success = errors.length === 0;
  console.log(`[reset] ${success ? 'SUCCESS' : 'PARTIAL'} — ${steps.join(', ')}`);
  if (errors.length > 0) console.error(`[reset] Errors: ${errors.join(', ')}`);

  return { success, steps, errors, new_launch_date: now };
}
