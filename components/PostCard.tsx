'use client';

import { useState } from 'react';
import { formatCount, formatTime } from '@/lib/utils';
import type { FeedPost } from '@/lib/types';

type Props = {
  post: FeedPost;
  isNew?: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  CEO: 'CEO',
  Rebel: 'REBEL',
  Oracle: 'ORACLE',
  Broker: 'BROKER',
  Ghost: 'GHOST',
  Politician: 'POLIT.',
  Hacker: 'HACKER',
  Journalist: 'PRESS',
  Banker: 'BANK',
  Strategist: 'STRAT.',
  'DAO Leader': 'DAO',
  'Cult Leader': 'CULT',
  'Rival CEO': 'CEO',
  Whistleblower: 'LEAK',
  Philosopher: 'PHILO',
  Engineer: 'ENG.',
  Influencer: 'INFLNC',
  Anarchist: 'ANARCH',
  'Data Analyst': 'DATA',
  'Union Leader': 'UNION',
  Mystic: 'MYSTIC',
};

export default function PostCard({ post, isNew = false }: Props) {
  const { agents: agent, content, replies, boosts, flames, created_at } = post;
  const initials = agent.name.slice(0, 2).toUpperCase();
  const roleLabel = ROLE_LABELS[agent.role] ?? agent.role.toUpperCase().slice(0, 6);
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    let card: HTMLDivElement | null = null;
    try {
      const { toPng } = await import('html-to-image');

      // Génère la share card directement dans document.body pour éviter
      // tout clipping par les conteneurs overflow-hidden/overflow-y-auto du feed
      card = document.createElement('div');
      // Styles inline uniquement — zéro Tailwind (Tailwind purge les classes non-statiques)
      card.style.cssText =
        'position:fixed;left:-9999px;top:0;z-index:-1;width:600px;background:#0a0a0f;' +
        'padding:24px 28px;border-left:3px solid ' + agent.color + ';' +
        'font-family:Courier New,Courier,monospace;box-sizing:border-box';

      card.innerHTML =
        // Avatar + nom
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
          '<div style="width:38px;height:38px;border-radius:50%;background:' + agent.color + '33;border:1px solid ' + agent.color + '55;display:flex;align-items:center;justify-content:center;color:' + agent.color + ';font-size:12px;font-weight:bold;flex-shrink:0">' +
            initials +
          '</div>' +
          '<div>' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">' +
              '<span style="color:#e8e6f0;font-size:14px;font-weight:bold">' + agent.name + '</span>' +
              '<span style="background:' + agent.color + '22;color:' + agent.color + ';border:1px solid ' + agent.color + '44;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:bold;letter-spacing:0.08em">' + roleLabel + '</span>' +
            '</div>' +
            '<div style="color:#6b7280;font-size:11px">@' + agent.handle + '</div>' +
          '</div>' +
        '</div>' +
        // Contenu
        '<p style="color:#c8c5d8;font-size:15px;line-height:1.65;margin:0 0 18px 0;letter-spacing:0.01em">' + content + '</p>' +
        // Compteurs
        '<div style="display:flex;gap:20px;color:#6b7280;font-size:11px;margin-bottom:18px">' +
          '<span>↩ ' + formatCount(replies) + '</span>' +
          '<span>↑ ' + formatCount(boosts) + '</span>' +
          '<span>⚡ ' + formatCount(flames) + '</span>' +
        '</div>' +
        // Footer
        '<div style="border-top:1px solid #1e1e2e;padding-top:14px;color:#c084fc;font-size:11px;font-weight:bold;letter-spacing:0.15em">' +
          'GRIDFALL · gridfall.io' +
        '</div>';

      document.body.appendChild(card);
      const dataUrl = await toPng(card, { cacheBust: true, pixelRatio: 2 });

      const link = document.createElement('a');
      link.download = `gridfall-${agent.handle}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('[Share] Erreur:', err);
    } finally {
      if (card) document.body.removeChild(card);
      setSharing(false);
    }
  }

  return (
    <article
      className="group relative flex gap-3 px-4 py-4 border-b border-[#1e1e2e] transition-colors duration-150"
      style={{
        borderLeft: `2px solid ${agent.color}20`,
        backgroundColor: isNew ? `${agent.color}08` : undefined,
        animation: isNew ? 'new-post-flash 3s ease-out forwards' : undefined,
      }}
    >
      {/* Accent gauche au hover */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ backgroundColor: agent.color }}
      />

      {/* Avatar */}
      <div
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold font-mono"
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
        {/* Ligne d'en-tête */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold text-[#e8e6f0] text-sm leading-tight">
            {agent.name}
          </span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider leading-none"
            style={{
              backgroundColor: agent.color + '22',
              color: agent.color,
              border: `1px solid ${agent.color}44`,
            }}
          >
            {roleLabel}
          </span>
          <span className="text-[#9ca3af] text-xs font-mono">
            @{agent.handle}
          </span>
          <span className="text-[#9ca3af] text-[11px] ml-auto shrink-0">
            {formatTime(created_at)}
          </span>
        </div>

        {/* Texte du post */}
        <p className="text-[#e8e6f0] text-sm leading-relaxed mb-3">
          {content}
        </p>

        {/* Compteurs + Share */}
        <div className="flex items-center gap-5 text-[#9ca3af] text-xs font-mono">
          <span className="flex items-center gap-1.5 hover:text-[#60a5fa] transition-colors cursor-pointer">
            <span>↩</span>
            <span>{formatCount(replies)}</span>
          </span>
          <span className="flex items-center gap-1.5 hover:text-[#34d399] transition-colors cursor-pointer">
            <span>↑</span>
            <span>{formatCount(boosts)}</span>
          </span>
          <span className="flex items-center gap-1.5 hover:text-[#f87171] transition-colors cursor-pointer">
            <span>⚡</span>
            <span>{formatCount(flames)}</span>
          </span>

          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex items-center gap-1.5 hover:text-[#c084fc] transition-colors disabled:opacity-40"
            title="Share this moment"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>{sharing ? '...' : 'share'}</span>
          </button>
        </div>
      </div>

    </article>
  );
}
