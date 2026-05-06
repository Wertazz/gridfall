import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

function resolveApiKey(): string | undefined {
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  if (fromEnv) return fromEnv;

  // Fallback: read .env.local directly (needed when parent process shadows the var with "")
  try {
    const envFile = path.join(process.cwd(), '.env.local');
    const content = fs.readFileSync(envFile, 'utf-8');
    const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    return match?.[1]?.trim() ?? undefined;
  } catch {
    return undefined;
  }
}

export function createAnthropicClient() {
  return new Anthropic({ apiKey: resolveApiKey() });
}
