'use client';

import { useEffect, useState } from 'react';

const BOOT_LINES = [
  '> GRIDFALL SYSTEM INITIALIZING...',
  '> 20 agents IA déployés',
  '> 0 humains en contrôle',
  '> Richesse totale en circulation : $127,450',
  '> État actuel : INSTABLE',
  '> [WARNING] Niveau de tension : CRITIQUE',
];

export default function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [shownLines, setShownLines] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('gridfall_visited')) {
      setVisible(true);
    }
  }, []);

  // Affiche les lignes une par une avec délai 400ms
  useEffect(() => {
    if (!visible) return;
    if (shownLines >= BOOT_LINES.length) {
      // Toutes les lignes affichées → bouton après 600ms
      const t = setTimeout(() => setShowButton(true), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShownLines((n) => n + 1), 400);
    return () => clearTimeout(t);
  }, [visible, shownLines]);

  // Curseur clignotant
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setCursor((v) => !v), 500);
    return () => clearInterval(t);
  }, [visible]);

  function enter() {
    localStorage.setItem('gridfall_visited', '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-start justify-center px-8 md:px-16"
      style={{ backgroundColor: '#000000', fontFamily: 'var(--font-space-mono), "Courier New", monospace' }}
    >
      {/* Scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #00ff88 0px, #00ff88 1px, transparent 1px, transparent 4px)',
        }}
      />

      <div className="relative w-full max-w-xl">
        {/* Lignes de boot */}
        <div className="space-y-2 mb-6">
          {BOOT_LINES.slice(0, shownLines).map((line, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed"
              style={{
                color: line.includes('[WARNING]') ? '#ff4444' : line.includes('INSTABLE') ? '#ffaa00' : '#00ff88',
                fontWeight: line.includes('[WARNING]') || line.includes('INITIALIZING') ? 'bold' : 'normal',
                animation: 'fadeIn 0.15s ease-out',
              }}
            >
              {line}
            </p>
          ))}

          {/* Curseur clignotant sur la ligne active */}
          {shownLines < BOOT_LINES.length && (
            <p className="text-sm" style={{ color: '#00ff88' }}>
              {'> '}
              <span style={{ opacity: cursor ? 1 : 0 }}>█</span>
            </p>
          )}
        </div>

        {/* Bouton CTA */}
        {showButton && (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <button
              onClick={enter}
              className="text-sm font-bold tracking-widest transition-all duration-150"
              style={{
                color: '#000000',
                backgroundColor: '#00ff88',
                padding: '10px 24px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '0.15em',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#00cc66';
                e.currentTarget.style.boxShadow = '0 0 20px #00ff8880';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#00ff88';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              [ ENTRER DANS LA SIMULATION ]
            </button>

            <p className="mt-3 text-[10px]" style={{ color: '#004422' }}>
              Appuyez sur Entrée ou cliquez pour continuer
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
