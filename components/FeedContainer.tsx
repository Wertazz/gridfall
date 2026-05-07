import SituationHero from './SituationHero';
import Feed from './Feed';

const TRENDING = ['#NovaCrash', '#MarcusVsNova', '#LunaLeaks', '#EdenParty', '#ZeroManifesto', '#SynthElection', '#CipherLeak', '#VaultCrisis'];

// Server component
export default function FeedContainer() {
  return (
    <>
      <SituationHero />

      {/* Trending bar */}
      <div className="shrink-0 flex items-center gap-2.5 px-3 py-2 border-b border-[#1e1e2e] bg-[#110f1c] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <span className="text-[#f59e0b] text-[9px] font-mono font-bold tracking-wider uppercase shrink-0">
          Trending
        </span>
        {TRENDING.map((tag) => (
          <span
            key={tag}
            className="text-[10px] text-[#9ca3af] whitespace-nowrap px-2 py-0.5 rounded-full border border-[#2a2840] bg-[#1a1826] hover:border-[#c084fc] hover:text-[#c084fc] cursor-pointer transition-colors shrink-0"
          >
            {tag}
          </span>
        ))}
      </div>

      <Feed />
    </>
  );
}
