import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

// Minimal: export the waitlist. The key is checked server-side only; nothing secret ships to the browser.
export default function Admin() {
  return (
    <main className="min-h-screen bg-[#050508] text-[#e8e6f0] font-mono flex items-center justify-center px-6">
      <form method="POST" action="/api/admin/export" className="w-full max-w-sm border border-[#1e1e2e] rounded p-5">
        <p className="text-[10px] tracking-[0.4em] text-[#f87171]">RESTRICTED</p>
        <label htmlFor="key" className="block mt-4 text-[11px] text-[#9ca3af]">Admin key</label>
        <input id="key" name="key" type="password" required autoComplete="off" className="mt-1 w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-sm outline-none focus:border-[#c084fc]/50" />
        <button className="mt-4 w-full py-2 rounded bg-[#c084fc] text-black text-sm font-bold">Export waitlist (CSV)</button>
      </form>
    </main>
  );
}
