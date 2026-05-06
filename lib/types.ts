export type PostAgent = {
  id: string;
  name: string;
  handle: string;
  role: string;
  color: string;
  faction: string | null;
  followers: number;
  wealth: number;
};

export type FeedPost = {
  id: string;
  content: string;
  replies: number;
  boosts: number;
  flames: number;
  event_id: string | null;
  created_at: string;
  agents: PostAgent;
};

export type ActiveEvent = {
  id: string;
  title: string;
  description: string;
  agents_involved: string[];
  is_active: boolean;
  starts_at: string;
  ends_at?: string | null;
};
