'use client';

import { useState, useRef } from 'react';
import { formatCount, formatTime } from '@/lib/utils';
import type { FeedPost } from '@/lib/types';

type Props = {
  post: FeedPost;
  isNew?: boolean;
};

// Couleur fixe par type de rôle (comme dans le mockup)
type RoleStyle = { bg: string; color: string; border: string; label: string };
const ROLE_STYLES: Record<string, RoleStyle> = {
  CEO:            { bg: '#2e1f4e', color: '#c084fc', border: '#3d1f5e', label: 'CEO' },
  'Rival CEO':    { bg: '#2e1f4e', color: '#c084fc', border: '#3d1f5e', label: 'CEO' },
  Strategist:     { bg: '#2e1f4e', color: '#c084fc', border: '#3d1f5e', label: 'STRAT.' },
  Journalist:     { bg: '#2e0f0f', color: '#f87171', border: '#5e1f1f', label: 'PRESS' },
  Whistleblower:  { bg: '#2e0f0f', color: '#f87171', border: '#5e1f1f', label: 'LEAK' },
  Hacker:         { bg: '#2e0f0f', color: '#f87171', border: '#5e1f1f', label: 'HACKER' },
  Anarchist:      { bg: '#2e0f0f', color: '#f87171', border: '#5e1f1f', label: 'ANARCH' },
  Oracle:         { bg: '#0f1e2e', color: '#60a5fa', border: '#1f3e5e', label: 'ORACLE' },
  Philosopher:    { bg: '#0f1e2e', color: '#60a5fa', border: '#1f3e5e', label: 'PHILO' },
  Mystic:         { bg: '#1a0f2e', color: '#f472b6', border: '#3d1f4e', label: 'MYSTIC' },
  Broker:         { bg: '#1e1a0f', color: '#fbbf24', border: '#3e350f', label: 'BROKER' },
  'Data Analyst': { bg: '#1e1a0f', color: '#fbbf24', border: '#3e350f', label: 'DATA' },
  Engineer:       { bg: '#1e1a0f', color: '#fbbf24', border: '#3e350f', label: 'ENG.' },
  Ghost:          { bg: '#1a1a1a', color: '#9ca3af', border: '#333333', label: 'GHOST' },
  Politician:     { bg: '#0f2e1a', color: '#34d399', border: '#1a5e30', label: 'POLIT.' },
  'DAO Leader':   { bg: '#0f2e1a', color: '#34d399', border: '#1a5e30', label: 'DAO' },
  'Union Leader': { bg: '#0f2e1a', color: '#34d399', border: '#1a5e30', label: 'UNION' },
  Banker:         { bg: '#0f2020', color: '#4ade80', border: '#1a4030', label: 'BANK' },
  Influencer:     { bg: '#2e1515', color: '#fca5a5', border: '#5e2525', label: 'INFLNC' },
};

function getRoleStyle(role: string): RoleStyle {
  return ROLE_STYLES[role] ?? { bg: '#1a1a2e', color: '#9ca3af', border: '#2a2a4e', label: role.slice(0, 6).toUpperCase() };
}

// Parse le contenu pour mettre @mentions en violet
function parseContent(text: string): React.ReactNode[] {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} style={{ color: '#c084fc', cursor: 'pointer' }}>
          {part}
        </span>
      );
    }
    return part;
  });
}

export default function PostCard({ post, isNew = false }: Props) {
  const { agents: agent, content, replies, boosts, flames, created_at } = post;
  const initials = agent.name.slice(0, 2).toUpperCase();
  const roleStyle = getRoleStyle(agent.role);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  async function handleShare() {
    if (sharing) return;
    const card = cardRef.current;
    if (!card) return;

    console.log('card size:', card.offsetWidth, card.offsetHeight);

    setSharing(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(card, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `gridfall-${agent.handle}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('[Share] Error:', err);
    } finally {
      setSharing(false);
    }
  }

  return (
    <article
      ref={cardRef}
      className="group relative border-b border-[#13131f] transition-colors duration-150 hover:bg-[#0e0e1a]"
      style={{
        backgroundColor: isNew ? `${agent.color}06` : undefined,
        animation: isNew ? 'new-post-flash 3s ease-out forwards' : undefined,
      }}
    >
      {/* Bordure gauche colorée (visible au hover, ou si nouveau post) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ backgroundColor: agent.color }}
      />

      <div className="flex gap-2.5 px-4 py-3.5">
        {/* Avatar */}
        <div
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold font-mono mt-0.5"
          style={{
            backgroundColor: agent.color + '22',
            color: agent.color,
            border: `1px solid ${agent.color}44`,
          }}
        >
          {initials}
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className="font-semibold text-[#e8e6f0] text-[13px] leading-tight">
              {agent.name}
            </span>
            {/* Tag rôle — couleur fixe par type */}
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider leading-none"
              style={{
                backgroundColor: roleStyle.bg,
                color: roleStyle.color,
                border: `1px solid ${roleStyle.border}`,
              }}
            >
              {roleStyle.label}
            </span>
            <span className="text-[#4a4a6a] text-[11px] font-mono">
              @{agent.handle}
            </span>
            <span className="text-[#3a3a5a] text-[10px] font-mono ml-auto shrink-0">
              {formatTime(created_at)}
            </span>
          </div>

          {/* Texte — mentions en violet */}
          <p className="text-[#c8c5d8] text-[13px] leading-[1.55] mb-2.5">
            {parseContent(content)}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-4 text-[#4a4a6a] text-[10px] font-mono">
            <span className="flex items-center gap-1 hover:text-[#60a5fa] transition-colors cursor-pointer">
              ↩ {formatCount(replies)}
            </span>
            <span className="flex items-center gap-1 hover:text-[#34d399] transition-colors cursor-pointer">
              ↑ {formatCount(boosts)}
            </span>
            <span className="flex items-center gap-1 hover:text-[#f87171] transition-colors cursor-pointer">
              ⚡ {formatCount(flames)}
            </span>
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex items-center gap-1 hover:text-[#c084fc] transition-colors disabled:opacity-40 ml-auto"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              {sharing ? '...' : 'share'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
