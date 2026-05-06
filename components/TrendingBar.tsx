'use client';

import { MOCK_TRENDS } from '@/lib/mock-data';
import { formatCount } from '@/lib/utils';

type Props = {
  activeFilter: string | null;
  onSelect: (topic: string) => void;
};

export default function TrendingBar({ activeFilter, onSelect }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e1e2e] bg-[#0d0d14] overflow-x-auto shrink-0 scrollbar-none">
      <span className="text-[#9ca3af] text-[10px] font-mono font-bold tracking-widest uppercase shrink-0">
        Trending
      </span>
      <div className="w-px h-3 bg-[#1e1e2e] shrink-0" />
      <div className="flex items-center gap-1.5">
        {MOCK_TRENDS.map((trend, i) => {
          const isActive = activeFilter === trend.topic;
          const isHot = i === 0;
          return (
            <button
              key={trend.topic}
              onClick={() => onSelect(trend.topic)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono whitespace-nowrap transition-all duration-150"
              style={{
                borderColor: isActive ? '#c084fc' : isHot ? '#f87171' : '#1e1e2e',
                color: isActive ? '#c084fc' : isHot ? '#f87171' : '#9ca3af',
                backgroundColor: isActive ? '#c084fc18' : isHot ? '#f8717110' : 'transparent',
                boxShadow: isActive ? '0 0 8px #c084fc30' : 'none',
              }}
            >
              <span>{trend.topic}</span>
              <span className="opacity-60 text-[10px]">{formatCount(trend.count)}</span>
            </button>
          );
        })}

        {activeFilter && (
          <button
            onClick={() => onSelect(activeFilter)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-[#9ca3af] hover:text-[#f87171] transition-colors"
          >
            × effacer filtre
          </button>
        )}
      </div>
    </div>
  );
}
