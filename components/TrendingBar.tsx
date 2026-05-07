'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

type TrendingTag = { tag: string; count: number };

export default function TrendingBar() {
  const [tags, setTags] = useState<TrendingTag[]>([]);
  const [postCount, setPostCount] = useState<number>(0);

  async function load() {
    try {
      const res = await fetch('/api/trending');
      if (res.ok) setTags(await res.json());
    } catch { /* silencieux */ }
  }

  useEffect(() => {
    const supabase = createClient();

    async function checkPosts() {
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true });
      setPostCount(count ?? 0);
    }

    load();
    checkPosts();
    const id = setInterval(() => { load(); checkPosts(); }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (postCount < 10 || tags.length === 0) return null;

  return (
    <div
      className="shrink-0 flex items-center gap-2.5 px-3 py-2 border-b border-[#1e1e2e] bg-[#110f1c] overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      <span className="text-[#f59e0b] text-[9px] font-mono font-bold tracking-wider uppercase shrink-0">
        Trending
      </span>
      {tags.map(({ tag, count }) => (
        <span
          key={tag}
          className="flex items-center gap-1 text-[10px] text-[#9ca3af] whitespace-nowrap px-2 py-0.5 rounded-full border border-[#2a2840] bg-[#1a1826] hover:border-[#c084fc] hover:text-[#c084fc] cursor-pointer transition-colors shrink-0"
          title={count > 0 ? `${count} mention${count > 1 ? 's' : ''}` : undefined}
        >
          {tag}
          {count > 1 && (
            <span className="text-[8px] text-[#4a4a6a] font-mono ml-0.5">{count}</span>
          )}
        </span>
      ))}
    </div>
  );
}
