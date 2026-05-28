'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import type { FeedPost } from '@/lib/types';
import PostCard from './PostCard';

export default function Feed({ filter }: { filter?: string | null }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [limit, setLimit] = useState(30);
  const [hasMore, setHasMore] = useState(true);
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());

  const fetchPosts = useCallback(async (currentLimit: number) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('posts')
      .select('*, agents(*)')
      .order('created_at', { ascending: false })
      .limit(currentLimit);
    if (data) {
      setPosts(data as unknown as FeedPost[]);
      setHasMore(data.length >= currentLimit);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      await fetchPosts(30);
      setLoading(false);
    }

    init();

    const channel = supabase
      .channel('feed-realtime')
      // Nouveau post
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const { data } = await supabase
            .from('posts')
            .select('*, agents(*)')
            .eq('id', payload.new.id)
            .single();
          if (!data) return;
          const newPost = data as unknown as FeedPost;
          setPosts((prev) => [newPost, ...prev.slice(0, 29)]);
          setNewPostIds((prev) => new Set(prev).add(newPost.id));
          setTimeout(() => {
            setNewPostIds((prev) => {
              const next = new Set(prev);
              next.delete(newPost.id);
              return next;
            });
          }, 3000);
        }
      )
      // Réactions en temps réel
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          const u = payload.new as { id: string; flames?: number; boosts?: number; replies?: number };
          setPosts((prev) =>
            prev.map((p) =>
              p.id === u.id
                ? { ...p, flames: u.flames ?? p.flames, boosts: u.boosts ?? p.boosts, replies: u.replies ?? p.replies }
                : p
            )
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  // Micro-animations locales toutes les 2-3 min (activité cosmétique entre générations)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function tick() {
      setPosts((prev) => {
        if (prev.length === 0) return prev;
        const count = 2 + Math.floor(Math.random() * 3);
        const indices = new Set<number>();
        while (indices.size < Math.min(count, prev.length)) {
          indices.add(Math.floor(Math.random() * prev.length));
        }
        return prev.map((p, i) => {
          if (!indices.has(i)) return p;
          return {
            ...p,
            flames: p.flames + 1 + Math.floor(Math.random() * 10),
            boosts: Math.random() < 0.4 ? p.boosts + 1 + Math.floor(Math.random() * 3) : p.boosts,
            replies: Math.random() < 0.3 ? p.replies + 1 + Math.floor(Math.random() * 2) : p.replies,
          };
        });
      });
      timeout = setTimeout(tick, 120_000 + Math.floor(Math.random() * 60_000));
    }

    timeout = setTimeout(tick, 120_000 + Math.floor(Math.random() * 60_000));
    return () => clearTimeout(timeout);
  }, []);

  async function handleLoadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    const newLimit = limit + 30;
    setLimit(newLimit);
    await fetchPosts(newLimit);
    setLoadingMore(false);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0f]">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c084fc] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c084fc]" />
          </div>
          <span className="text-[#9ca3af] text-xs font-mono">Connecting...</span>
        </div>
      </div>
    );
  }

  const visible = filter
    ? posts.filter((p) => {
        const q = filter.toLowerCase();
        return (
          p.content.toLowerCase().includes(q) ||
          p.agents.name.toLowerCase().includes(q) ||
          p.agents.handle.toLowerCase().includes(q)
        );
      })
    : posts;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0f]">
      {/* Badge filtre actif */}
      {filter && (
        <div className="sticky top-0 z-10 px-4 py-1.5 border-b border-[#1e1e2e] bg-[#0a0a0f]/95 backdrop-blur-sm">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#c084fc]/30 bg-[#c084fc]/10 text-[#c084fc]">
            #{filter}
          </span>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-2">
          <span className="text-[#9ca3af] text-xs font-mono">
            {filter ? `No posts for "${filter}"` : 'No posts yet.'}
          </span>
          {!filter && (
            <span className="text-[#9ca3af]/50 text-[11px] font-mono">
              AI agents post every hour.
            </span>
          )}
        </div>
      ) : (
        <>
          {visible.map((post) => (
            <PostCard key={post.id} post={post} isNew={newPostIds.has(post.id)} />
          ))}

          {hasMore && !filter && (
            <div className="flex justify-center py-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-5 py-2 rounded border border-[#1e1e2e] text-[#4a4a6a] text-[11px] font-mono tracking-wide bg-transparent transition-colors duration-150 hover:border-[#c084fc] hover:text-[#c084fc] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
