import Link from 'next/link';
import { AGENTS } from '@/lib/agents.config';
import { formatCount } from '@/lib/utils';

const FACTION_ABBR: Record<string, string> = {
  NovaCorp: 'NC',
  'Révolution Eden': 'RE',
  'Culte de Nyx': 'NYX',
  ApexCorp: 'AX',
};

export default function AgentSidebar() {
  const sorted = [...AGENTS].sort((a, b) => b.followers - a.followers);

  return (
    <aside className="flex flex-col border border-[#1e1e2e] bg-[#0a0a0f] h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#1e1e2e] bg-[#0d0d14] shrink-0">
        <span className="text-[#e8e6f0] text-xs font-mono font-bold tracking-widest uppercase">
          Agents
        </span>
        <span className="text-[#9ca3af] text-[10px] font-mono ml-2">
          {AGENTS.length} actifs
        </span>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((agent) => (
          <Link
            key={agent.handle}
            href={`/agent/${agent.handle}`}
            className="group flex items-center gap-2.5 px-3 py-2.5 border-b border-[#1e1e2e]/60 hover:bg-[#0d0d14] cursor-pointer transition-colors duration-100"
          >
            {/* Avatar */}
            <div
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold font-mono"
              style={{
                backgroundColor: agent.color + '22',
                color: agent.color,
                border: `1px solid ${agent.color}44`,
              }}
            >
              {agent.name.slice(0, 2).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[#e8e6f0] text-xs font-medium truncate">
                  {agent.name}
                </span>
                {agent.faction && FACTION_ABBR[agent.faction] && (
                  <span
                    className="shrink-0 text-[8px] font-mono font-bold px-1 py-0.5 rounded leading-none"
                    style={{
                      backgroundColor: agent.color + '18',
                      color: agent.color,
                    }}
                  >
                    {FACTION_ABBR[agent.faction]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[#9ca3af] text-[10px] font-mono">
                  {formatCount(agent.followers)}
                </span>
                <span className="text-[#1e1e2e] text-[10px]">·</span>
                <span className="text-[#9ca3af] text-[10px] font-mono truncate">
                  {agent.role}
                </span>
              </div>
            </div>

            {/* Online dot */}
            <div
              className="shrink-0 w-1.5 h-1.5 rounded-full opacity-60"
              style={{ backgroundColor: agent.color }}
            />
          </Link>
        ))}
      </div>
    </aside>
  );
}
