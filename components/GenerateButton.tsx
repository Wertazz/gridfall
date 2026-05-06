'use client';

import { useState } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function GenerateButton() {
  const [status, setStatus] = useState<Status>('idle');
  const [lastResult, setLastResult] = useState<{ generated: number; agents: string[] } | null>(null);

  async function handleClick() {
    setStatus('loading');
    setLastResult(null);
    try {
      const res = await fetch('/api/trigger', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.generated >= 0) {
        setLastResult(data);
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
    // Reset après 5s
    setTimeout(() => {
      setStatus('idle');
      setLastResult(null);
    }, 5000);
  }

  return (
    <div className="fixed bottom-8 left-4 z-50 flex flex-col items-start gap-2">
      {/* Résultat */}
      {status === 'success' && lastResult && (
        <div className="px-3 py-2 rounded border border-[#34d399]/30 bg-[#0d0d14] max-w-48">
          <p className="text-[#34d399] text-[10px] font-mono font-bold">
            ✓ {lastResult.generated} post{lastResult.generated !== 1 ? 's' : ''} générés
          </p>
          {lastResult.agents.length > 0 && (
            <p className="text-[#9ca3af] text-[10px] font-mono mt-0.5 truncate">
              @{lastResult.agents.join(', @')}
            </p>
          )}
        </div>
      )}
      {status === 'error' && (
        <div className="px-3 py-1.5 rounded border border-[#f87171]/30 bg-[#0d0d14]">
          <p className="text-[#f87171] text-[10px] font-mono">✗ Erreur — vérifier les clés API</p>
        </div>
      )}

      {/* Bouton */}
      <button
        onClick={handleClick}
        disabled={status === 'loading'}
        className="group flex items-center gap-2 px-3 py-2 rounded border transition-all duration-150 disabled:cursor-not-allowed"
        style={{
          borderColor: status === 'loading' ? '#9ca3af40' : '#c084fc40',
          backgroundColor:
            status === 'loading' ? '#9ca3af08' : 'rgba(192,132,252,0.08)',
          color: status === 'loading' ? '#9ca3af' : '#c084fc',
        }}
      >
        {status === 'loading' ? (
          <>
            <svg
              className="animate-spin h-3 w-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            <span className="text-[11px] font-mono">Génération...</span>
          </>
        ) : (
          <>
            <span className="text-sm group-hover:scale-110 transition-transform">⚡</span>
            <span className="text-[11px] font-mono font-bold tracking-wider">Générer posts</span>
          </>
        )}
      </button>
    </div>
  );
}
