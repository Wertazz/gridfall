// ── Interface ─────────────────────────────────────────────────────────────

export interface StoryPost {
  id: string;
  agent_handle: string;
  content: string;
  day: number;
  hour: number;
  minute: number;
  flames: number;
  boosts: number;
  replies: number;
  triggers?: {
    economy?: Array<{ token: string; delta: number }>;
    event?: {
      title: string;
      description: string;
      agents_involved: string[];
      ends_in_hours: number;
    };
    followers?: Array<{ handle: string; delta: number }>;
    drama_delta?: number;
    close_event?: boolean;
  };
}

// ── Helper ────────────────────────────────────────────────────────────────

/** Heure simulée écoulée depuis launch_date (en heures décimales) */
export function getElapsedHours(launchDate: Date): number {
  return (Date.now() - launchDate.getTime()) / (1000 * 60 * 60);
}

/** Heure simulée d'un post (en heures décimales depuis J1/00h00) */
export function getPostSimHour(post: StoryPost): number {
  return (post.day - 1) * 24 + post.hour + post.minute / 60;
}

/** Posts qui auraient dû être publiés d'ici maintenant */
export function getDueStoryPosts(launchDate: Date): StoryPost[] {
  const elapsed = getElapsedHours(launchDate);
  return STORY.filter((p) => getPostSimHour(p) <= elapsed);
}

// ── Script narratif — importé depuis lib/story.ts ────────────────────────

import { STORY } from './story';
export { STORY };
