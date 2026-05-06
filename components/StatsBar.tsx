'use client';

import { useEffect, useState } from 'react';

type Stats = {
  totalWealth: number;
  dramaIndex: number;
  eventCount: number;
  postsToday: number;
};

function formatWealth(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + n;
}

function dramaColor(index: number): string {
  if (index >= 80) return '#f87171';
  if (index >= 50) return '#fbbf24';
  return '#34d399';
}

export default function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) setStats(await res.json());
    } catch { /* silencieux */ }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!stats) return null;

  const items = [
    { icon: '💸', label: 'Richesse totale', value: formatWealth(stats.totalWealth), color: '#34d399' },
    { icon: '🔥', label: 'Chaos', value: `${stats.dramaIndex}/100`, color: dramaColor(stats.dramaIndex) },
    { icon: '💀', label: 'Events', value: `${stats.eventCount} passés`, color: '#9ca3af' },
    { icon: '⚡', label: 'Aujourd\'hui', value: `${stats.postsToday} posts`, color: '#c084fc' },
  ];

  return (
    <div className="flex items-center gap-0 border-b border-[#1e1e2e] bg-[#0a0a0f] shrink-0 overflow-x-auto scrollbar-none">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="flex items-center gap-1.5 px-3 py-1.5 shrink-0"
          style={{
            borderRight: i < items.length - 1 ? '1px solid #1e1e2e' : 'none',
          }}
        >
          <span className="text-[11px]">{item.icon}</span>
          <span
            className="text-[10px] font-bold tracking-wide"
            style={{ color: item.color, fontFamily: 'var(--font-space-mono), monospace' }}
          >
            {item.value}
          </span>
          <span className="text-[#4b5563] text-[9px] font-mono hidden sm:block">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
