'use client';

import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { useApp } from '@/state/store';
import { COLORS } from '@/lib/theme';

/**
 * Full-frame boot loader for the very first paint. It sits above the Canvas and
 * holds until the hero ship GLB has actually loaded and is on screen
 * (`shipLoaded`), not merely until the JS chunk mounts — so the pilot never
 * stares at empty space waiting for the vessel to materialize. The drei
 * loader-manager progress drives the readout; once the ship reports in we fade
 * out and unmount.
 */
export function LoadingScreen() {
  const shipLoaded = useApp((s) => s.shipLoaded);
  const { progress, active } = useProgress();
  const [gone, setGone] = useState(false);

  // keep the panel mounted through its fade-out, then drop it entirely
  useEffect(() => {
    if (!shipLoaded) return;
    const t = window.setTimeout(() => setGone(true), 620);
    return () => window.clearTimeout(t);
  }, [shipLoaded]);

  if (gone) return null;

  // before the ship reports in, never let the bar read a stale 100% between
  // asset batches — cap it just short until shipLoaded actually flips
  const pct = shipLoaded ? 100 : Math.min(progress, active ? progress : 96);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6"
      style={{
        background: COLORS.void,
        opacity: shipLoaded ? 0 : 1,
        transition: 'opacity 600ms ease',
        pointerEvents: shipLoaded ? 'none' : 'auto',
      }}
    >
      <div className="canopy-scanlines pointer-events-none absolute inset-0" />

      <div
        className="font-hud"
        style={{ color: COLORS.hudCyan, fontSize: '0.75rem', letterSpacing: '0.3em' }}
      >
        ▚ FLIGHT DECK POWERING UP
      </div>
      <div
        className="font-hero animate-breathe"
        style={{
          fontSize: 'clamp(1.4rem, 4vw, 2.4rem)',
          color: COLORS.textPrimary,
          textShadow: `0 0 24px ${COLORS.hudCyan}88`,
        }}
      >
        MATERIALIZING VESSEL AYK-08
      </div>

      {/* progress rail */}
      <div
        style={{
          width: 'min(420px, 70vw)',
          height: 3,
          background: `${COLORS.hudCyan}22`,
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: COLORS.hudCyanBright,
            boxShadow: `0 0 10px ${COLORS.hudCyanBright}`,
            transition: 'width 240ms ease',
          }}
        />
      </div>
      <div
        className="font-data"
        style={{ color: COLORS.textMuted, fontSize: '0.6875rem', letterSpacing: '0.2em' }}
      >
        {shipLoaded ? 'HULL ONLINE — WELCOME ABOARD' : `LOADING HULL GEOMETRY · ${Math.round(pct)}%`}
      </div>
    </div>
  );
}
