import type { Metadata } from 'next';
import Link from 'next/link';
import ProofHash from './ProofHash';

export const metadata: Metadata = {
  title: 'Proof · GRIDFALL',
  description: 'There is no server running this world. Every visitor computes the same one.',
};

export default function Proof() {
  return (
    <main className="min-h-screen bg-[#050508] text-[#e8e6f0] font-mono flex items-center justify-center px-6 py-12">
      <div className="max-w-xl w-full">
        <p className="text-[10px] tracking-[0.4em] text-[#4b5563]">PROOF</p>
        <ol className="mt-6 space-y-4 text-[15px] leading-relaxed text-[#c8c5d8]">
          <li>1. There is no server running this world.</li>
          <li>2. Its state is a pure function of the clock and one fixed seed.</li>
          <li>3. Your device computes it. So does every other device. They agree to the last bit.</li>
          <li>4. The hash below is that state, compressed into sixteen characters. Compare it with anyone, anywhere.</li>
          <li>5. The future is already computed. You are only allowed to watch.</li>
        </ol>
        <ProofHash />
        <Link href="/" className="inline-block mt-10 text-[11px] text-[#c084fc] hover:underline">← return to THE GRID</Link>
      </div>
    </main>
  );
}
