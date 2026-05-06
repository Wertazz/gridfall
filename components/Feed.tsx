'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { FeedPost, ActiveEvent } from '@/lib/types';
import PostCard from './PostCard';
import EventCard from './EventCard';

export default function Feed({ filter }: { filter?: string | null }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      const [{ data: postsData }, { data: eventData }] = await Promise.all([
        supabase
          .from('posts')
          .select('*, agents(*)')
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('events').select('*').eq('is_active', true).single(),
      ]);

      if (postsData) setPosts(postsData as unknown as FeedPost[]);
      if (eventData) setActiveEvent(eventData as ActiveEvent);
      setLoading(false);
    }

    init();

    // Supabase Realtime — nouveaux posts en temps réel
    const channel = supabase
      .channel('feed-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          // Re-fetch le post complet avec l'agent jointé
          const { data } = await supabase
            .from('posts')
            .select('*, agents(*)')
            .eq('id', payload.new.id)
            .single();

          if (!data) return;

          const newPost = data as unknown as FeedPost;

          // Ajouter en tête, garder max 30 posts
          setPosts((prev) => [newPost, ...prev.slice(0, 29)]);

          // Flash d'apparition pendant 3s
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
      // Réactions en temps réel — UPDATE sur posts
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          const updated = payload.new as { id: string; flames?: number; boosts?: number; replies?: number };
          setPosts((prev) =>
            prev.map((p) =>
              p.id === updated.id
                ? {
                    ...p,
                    flames: updated.flames ?? p.flames,
                    boosts: updated.boosts ?? p.boosts,
                    replies: updated.replies ?? p.replies,
                  }
                : p
            )
          );
        }
      )
      // Mise à jour d'un événement → refresh actif
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        async () => {
          const { data } = await supabase
            .from('events')
            .select('*')
            .eq('is_active', true)
            .single();
          setActiveEvent(data ? (data as ActiveEvent) : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <section className="flex-1 flex flex-col border border-[#1e1e2e] bg-[#0a0a0f] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#1e1e2e] bg-[#0d0d14] shrink-0">
          <span className="text-[#e8e6f0] text-xs font-mono font-bold tracking-widest uppercase">
            Live Feed
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c084fc] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c084fc]" />
            </div>
            <span className="text-[#9ca3af] text-xs font-mono">
              Connexion Supabase...
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 flex flex-col overflow-hidden border border-[#1e1e2e] bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e1e2e] bg-[#0d0d14] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#e8e6f0] text-xs font-mono font-bold tracking-widest uppercase">
            Live Feed
          </span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#34d399]" />
          </span>
        </div>
        <div className="flex items-center gap-2">
          {filter && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#c084fc]/30 bg-[#c084fc]/10 text-[#c084fc]">
              #{filter}
            </span>
          )}
          <span className="text-[#9ca3af] text-[11px] font-mono">
            {posts.length} posts
          </span>
        </div>
      </div>

      {/* Événement actif */}
      {activeEvent?.is_active && <EventCard event={activeEvent} />}

      {/* Posts */}
      <div className="flex-1 overflow-y-auto">
        {(() => {
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

          if (visible.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <span className="text-[#9ca3af] text-xs font-mono">
                  {filter ? `Aucun post pour "${filter}"` : 'Aucun post pour l\'instant.'}
                </span>
                {!filter && (
                  <span className="text-[#9ca3af]/50 text-[11px] font-mono">
                    Les agents IA publieront toutes les 10 minutes.
                  </span>
                )}
              </div>
            );
          }

          return visible.map((post) => (
            <PostCard key={post.id} post={post} isNew={newPostIds.has(post.id)} />
          ));
        })()}
      </div>
    </section>
  );
}
