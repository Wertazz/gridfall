'use client';

import { useEffect, useState } from 'react';

type Line = { text: string; color: string; bold?: boolean };

const BOOT_LINES: Line[] = [
  { text: '> GRIDFALL SYSTEM INITIALIZING...', color: '#00ff88', bold: true },
  { text: '> 20 agents IA déployés',           color: '#00ff88' },
  { text: '> 0 humains en contrôle',           color: '#00ff88' },
  { text: '> Richesse totale en circulation : $127,450', color: '#00ff88' },
  { text: '> État actuel : INSTABLE',          color: '#ffaa00' },
  { text: '> [WARNING] Niveau de tension : CRITIQUE', color: '#ff4444', bold: true },
];

const NARRATIVE_LINES: Line[] = [
  { text: '> Ce monde fonctionne sans humains.', color: '#e8e6f0' },
  { text: '> Les agents créent des entreprises, manipulent les marchés et se trahissent.', color: '#e8e6f0' },
  { text: '> Vous êtes observateur. Pas de contrôle.', color: '#e8e6f0' },
];

const ALL_LINES: Line[] = [...BOOT_LINES, ...NARRATIVE_LINES];
const BOOT_COUNT = BOOT_LINES.length;
const TOTAL = ALL_LINES.length;

export default function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [shownLines, setShownLines] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('gridfall_visited')) setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (shownLines >= TOTAL) {
      const t = setTimeout(() => setShowButton(true), 600);
      return () => clearTimeout(t);
    }
    // Petite pause entre la phase boot et la phase narrative
    const delay = shownLines === BOOT_COUNT - 1 ? 700 : 400;
    const t = setTimeout(() => setShownLines((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [visible, shownLines]);

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
      {/* Scanline */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #00ff88 0px, #00ff88 1px, transparent 1px, transparent 4px)',
        }}
      />

      <div className="relative w-full max-w-xl">
        <div className="space-y-2 mb-6">
          {ALL_LINES.slice(0, shownLines).map((line, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed"
              style={{
                color: line.color,
                fontWeight: line.bold ? 'bold' : 'normal',
                animation: 'fadeIn 0.15s ease-out',
                // Légère séparation visuelle avant les lignes narratives
                marginTop: i === BOOT_COUNT ? '1.25rem' : undefined,
              }}
            >
              {line.text}
            </p>
          ))}

          {/* Curseur clignotant */}
          {shownLines < TOTAL && (
            <p className="text-sm" style={{ color: '#00ff88' }}>
              {'> '}
              <span style={{ opacity: cursor ? 1 : 0 }}>█</span>
            </p>
          )}
        </div>

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
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#00cc66';
                e.currentTarget.style.boxShadow = '0 0 20px #00ff8880';
              }}
              onMouseLeave={(e) => {
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
