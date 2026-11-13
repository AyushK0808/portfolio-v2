'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/state/store';
import { loaderProgress, startLoaderClock } from '@/systems/loader';
import { COLORS, LOCATIONS } from '@/lib/theme';

/**
 * The loader's readout. The loading screen itself is the 3D scene: the visitor
 * is already inside the hyperspace tunnel, which speeds up with load progress
 * and drops away the moment the first assets are in (`loaded`). This component
 * only adds the thin percent line over it, then fades and unmounts.
 */
export function LoadingScreen() {
  const loaded = useApp((s) => s.loaded);
  const destination = useApp((s) => s.jump?.to ?? null);
  const [gone, setGone] = useState(false);
  // the readout follows the paced progress (real load, held to the minimum
  // loader time), sampled a few times a second
  const [paced, setPaced] = useState(0);
  useEffect(() => {
    if (loaded) return;
    startLoaderClock();
    const iv = window.setInterval(() => setPaced(loaderProgress() * 100), 80);
    return () => window.clearInterval(iv);
  }, [loaded]);

  // keep the readout mounted through its fade-out, then drop it entirely
  useEffect(() => {
    if (!loaded) return;
    const t = window.setTimeout(() => setGone(true), 520);
    return () => window.clearTimeout(t);
  }, [loaded]);

  if (gone) return null;

  // before we are ready, never let the bar read 100% — cap it just short
  // until the ready flag actually flips
  const pct = loaded ? 100 : Math.min(paced, 99);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-3 px-6 pb-[14vh] text-center pointer-events-none"
      style={{ opacity: loaded ? 0 : 1, transition: 'opacity 480ms ease' }}
      role="status"
      aria-live="polite"
    >
      <div
        className="font-hud animate-breathe"
        style={{
          color: COLORS.textPrimary,
          fontSize: '0.8125rem',
          letterSpacing: '0.3em',
          textShadow: `0 0 18px ${COLORS.hudCyan}`,
        }}
      >
        {destination ? `IN HYPERSPACE — ${LOCATIONS[destination].name}` : 'IN HYPERSPACE'}
      </div>
      {/* progress rail */}
      <div
        style={{
          width: 'min(320px, 62vw)',
          height: 2,
          background: `${COLORS.hudCyan}33`,
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
        style={{ color: COLORS.textSecondary, fontSize: '0.6875rem', letterSpacing: '0.2em' }}
      >
        {loaded ? 'DROPPING OUT OF LIGHTSPEED' : `LOADING · ${Math.round(pct)}%`}
      </div>
    </div>
  );
}
