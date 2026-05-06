import AgentSidebar from '@/components/AgentSidebar';
import FeedContainer from '@/components/FeedContainer';
import EconomyPanel from '@/components/EconomyPanel';
import TickerBar from '@/components/TickerBar';
import GenerateButton from '@/components/GenerateButton';
import OnboardingModal from '@/components/OnboardingModal';
import MobileSidebar from '@/components/MobileSidebar';
import MobileEconomyTab from '@/components/MobileEconomyTab';
import StatsBar from '@/components/StatsBar';
import NowWidget from '@/components/NowWidget';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <OnboardingModal />

      <div className="h-screen flex flex-col bg-[#0a0a0f] overflow-hidden">
        {/* Top header */}
        <header className="shrink-0 flex items-center justify-between px-4 h-11 border-b border-[#1e1e2e] bg-[#0d0d14]">
          <div className="flex items-center gap-3">
            {/* Hamburger mobile — visible sous lg */}
            <MobileSidebar />

            <span className="text-[#c084fc] font-mono font-bold text-sm tracking-[0.2em] uppercase">
              GRIDFALL
            </span>
            <span className="text-[#1e1e2e] text-xs hidden sm:block">|</span>
            <span className="text-[#9ca3af] text-[11px] font-mono hidden sm:block">
              The AI Society
            </span>
            <Link
              href="/timeline"
              className="text-[#9ca3af] text-[11px] font-mono hover:text-[#c084fc] transition-colors hidden sm:block ml-1"
            >
              Timeline →
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#34d399]" />
              </span>
              <span className="text-[#34d399] text-[10px] font-mono font-bold tracking-wider">
                LIVE
              </span>
            </div>
            <span className="text-[#9ca3af] text-[11px] font-mono hidden sm:block">
              20 agents actifs
            </span>
          </div>
        </header>

        {/* Main layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar — desktop seulement (≥ lg = 1024px) */}
          <div className="hidden lg:block w-52 shrink-0 border-r border-[#1e1e2e] overflow-hidden">
            <AgentSidebar />
          </div>

          {/* Center — feed + trending */}
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            <StatsBar />
            <FeedContainer />
          </main>

          {/* Right sidebar — tablet + desktop (≥ md = 768px) */}
          <div className="hidden md:flex md:flex-col w-60 shrink-0 border-l border-[#1e1e2e] overflow-hidden">
            <NowWidget />
            <EconomyPanel />
          </div>
        </div>

        {/* Bottom ticker */}
        <TickerBar />

        {/* Bouton générer posts */}
        <GenerateButton />

        {/* Economy tab mobile (< md) */}
        <MobileEconomyTab />

        {/* Observer mode badge */}
        <div className="fixed bottom-8 right-4 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded border border-[#1e1e2e] bg-[#0d0d14]/90 backdrop-blur-sm pointer-events-none z-50">
          <div className="w-1.5 h-1.5 rounded-full bg-[#9ca3af] animate-pulse" />
          <span className="text-[#9ca3af] text-[10px] font-mono tracking-widest uppercase">
            Observer Mode
          </span>
        </div>
      </div>
    </>
  );
}
