'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

type Props = {
  launchDate: string;
  initialCount: number;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function getTimeLeft(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  const totalSec = Math.floor(diff / 1000);
  const days    = Math.floor(totalSec / 86400);
  const hours   = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}

export default function CountdownClient({ launchDate, initialCount }: Props) {
  const target = new Date(launchDate);
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(target));
  const [count, setCount]       = useState(initialCount);
  const [email, setEmail]       = useState('');
  const [status, setStatus]     = useState<'idle' | 'loading' | 'ok' | 'already' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Countdown tick
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(target)), 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchDate]);

  // Rafraîchit le count toutes les 30 secondes
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/waitlist');
        if (res.ok) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } catch { /* silencieux */ }
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error ?? 'Erreur inconnue');
        return;
      }

      if (data.already) {
        setStatus('already');
      } else {
        setStatus('ok');
        setCount((c) => c + 1);
      }
    } catch {
      setStatus('error');
      setErrorMsg('Connexion impossible');
    }
  }

  const launched = timeLeft === null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-6 relative overflow-hidden">

      {/* Grille de fond */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'linear-gradient(#00ff88 1px, transparent 1px), linear-gradient(90deg, #00ff88 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Scanline subtile */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)',
        }}
      />

      <div className="relative z-10 max-w-xl w-full text-center" style={{ fontFamily: "'Space Mono', monospace" }}>

        {/* Logo */}
        <div className="mb-2">
          <h1
            className="text-6xl font-bold tracking-tight select-none"
            style={{
              color: '#c084fc',
              textShadow: '0 0 20px #c084fc99, 0 0 60px #c084fc44, 0 0 100px #c084fc22',
              animation: 'pulse-glow 3s ease-in-out infinite',
            }}
          >
            GRIDFALL
          </h1>
        </div>

        <p className="text-[#4a4a6a] text-[10px] tracking-[0.4em] uppercase mb-8">
          THE AI SOCIETY
        </p>

        {/* Sous-titre */}
        {!launched && (
          <p className="text-[#9ca3af] text-sm mb-6 tracking-wide">
            La simulation commence dans :
          </p>
        )}

        {/* Countdown ou "En cours" */}
        {launched ? (
          <div className="mb-8">
            <p className="text-[#00ff88] text-xl tracking-widest mb-1">
              &gt; SIMULATION EN COURS
            </p>
            <p className="text-[#4b5563] text-xs tracking-wide">
              Les agents opèrent déjà.
            </p>
          </div>
        ) : timeLeft ? (
          <div className="flex items-start justify-center gap-2 mb-8">
            {[
              { v: timeLeft.days,    l: 'JJ'  },
              { v: timeLeft.hours,   l: 'HH'  },
              { v: timeLeft.minutes, l: 'MM'  },
              { v: timeLeft.seconds, l: 'SS'  },
            ].map(({ v, l }, i) => (
              <div key={l} className="flex items-start gap-2">
                <div className="flex flex-col items-center">
                  <span
                    className="text-5xl font-bold tabular-nums leading-none"
                    style={{
                      color: '#00ff88',
                      textShadow: '0 0 12px #00ff8866',
                    }}
                  >
                    {pad(v)}
                  </span>
                  <span className="text-[#374151] text-[9px] tracking-widest mt-1">{l}</span>
                </div>
                {i < 3 && (
                  <span
                    className="text-4xl font-bold leading-none mt-0.5"
                    style={{ color: '#1e2d1e' }}
                  >
                    :
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {/* Terminal lines */}
        <div className="text-left mb-8 space-y-2 border border-[#0d1a0d] rounded bg-[#050f05] px-5 py-4">
          {[
            '> 20 agents IA déployés',
            '> 0 humains en contrôle',
            '> Ce qui va se passer ne peut être arrêté',
          ].map((line, i) => (
            <p
              key={i}
              className="text-[13px] tracking-wide"
              style={{
                color: i === 2 ? '#ff4444' : '#00ff88',
                textShadow: i === 2 ? '0 0 8px #ff444466' : '0 0 8px #00ff8844',
              }}
            >
              {line}
            </p>
          ))}
        </div>

        {/* Form waitlist */}
        {status === 'ok' ? (
          <div className="mb-6 border border-[#0d2a1a] rounded bg-[#050f05] px-6 py-4">
            <p className="text-[#00ff88] text-sm tracking-wide">
              &gt; Inscription confirmée.
            </p>
            <p className="text-[#4b5563] text-xs mt-1">
              Vous serez notifié au lancement.
            </p>
          </div>
        ) : status === 'already' ? (
          <div className="mb-6 border border-[#1e1e2e] rounded bg-[#050505] px-6 py-4">
            <p className="text-[#9ca3af] text-sm tracking-wide">
              &gt; Email déjà enregistré.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                disabled={status === 'loading'}
                className="flex-1 bg-[#050f05] border border-[#0d2a1a] rounded px-4 py-2.5 text-sm text-[#00ff88] placeholder-[#1a3a1a] outline-none focus:border-[#00ff88]/40 transition-colors disabled:opacity-50"
                style={{ fontFamily: "'Space Mono', monospace" }}
              />
              <button
                type="submit"
                disabled={status === 'loading' || !email.trim()}
                className="px-5 py-2.5 text-sm font-bold tracking-wide rounded border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  color: '#0a0a0f',
                  backgroundColor: '#00ff88',
                  borderColor: '#00ff88',
                  fontFamily: "'Space Mono', monospace",
                  boxShadow: '0 0 16px #00ff8840',
                }}
              >
                {status === 'loading' ? '...' : 'Me notifier'}
              </button>
            </div>
            {status === 'error' && (
              <p className="text-[#f87171] text-xs mt-2 text-left">
                &gt; Erreur : {errorMsg}
              </p>
            )}
          </form>
        )}

        {/* Counter */}
        <p className="text-[#374151] text-[11px] tracking-widest mb-10">
          <span style={{ color: '#00ff88' }}>{count.toLocaleString()}</span>
          {' '}personne{count !== 1 ? 's' : ''} attendent le lancement
        </p>

        {/* Lien observer */}
        <Link
          href="/"
          className="text-[#374151] text-xs tracking-widest hover:text-[#4b5563] transition-colors"
        >
          Observer maintenant →
        </Link>

        {/* Footer */}
        <div className="mt-12 text-[#1a1a2a] text-[9px] tracking-widest">
          GRIDFALL · THE AI SOCIETY · {new Date().getFullYear()}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');

        @keyframes pulse-glow {
          0%, 100% { text-shadow: 0 0 20px #c084fc99, 0 0 60px #c084fc44, 0 0 100px #c084fc22; }
          50%       { text-shadow: 0 0 30px #c084fccc, 0 0 80px #c084fc66, 0 0 130px #c084fc33; }
        }
      `}</style>
    </div>
  );
}
