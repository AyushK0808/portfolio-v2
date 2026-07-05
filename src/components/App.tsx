'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { useApp } from '@/state/store';
import { COLORS } from '@/lib/theme';
import { Scene } from './three/Scene';
import { Hud } from './hud/Hud';

function MobileGate() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="canopy-scanlines pointer-events-none absolute inset-0" />
      <div className="font-hud" style={{ color: COLORS.hudCyan, fontSize: '0.75rem' }}>
        ▚ GROUND CONTROL TO PILOT
      </div>
      <div className="font-hero" style={{ fontSize: '1.6rem', color: COLORS.textPrimary }}>
        DESKTOP FLIGHT DECK REQUIRED
      </div>
      <div
        className="font-data max-w-sm"
        style={{ color: COLORS.textSecondary, fontSize: '0.875rem', lineHeight: 1.7 }}
      >
        This interactive spaceship experience is built for larger screens — open it
        on a desktop for the full mission. Meanwhile, the complete dossier is
        available as a text transmission.
      </div>
      <Link
        href="/resume"
        className="hud-btn animate-breathe"
        style={{ fontSize: '0.875rem', padding: '12px 28px', borderWidth: 2 }}
      >
        [ VIEW RÉSUMÉ — TEXT VERSION ]
      </Link>
    </div>
  );
}

function NoWebGL() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="font-hero" style={{ fontSize: '1.5rem', color: COLORS.textPrimary }}>
        FLIGHT SYSTEMS UNAVAILABLE
      </div>
      <div className="font-data max-w-md" style={{ color: COLORS.textSecondary, fontSize: '0.875rem' }}>
        This vessel needs WebGL to fly and your browser reports none. The full
        dossier is available as a text transmission instead.
      </div>
      <Link href="/resume" className="hud-btn" style={{ fontSize: '0.875rem', padding: '10px 24px' }}>
        [ OPEN TEXT RÉSUMÉ ]
      </Link>
    </div>
  );
}

/**
 * Client root: WebGL detection, quality auto-tier, reduced-motion sync,
 * then the Canvas + canopy HUD.
 */
export default function App() {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState(false);
  const quality = useApp((s) => s.quality);

  useEffect(() => {
    // phones/tablets skip the flight entirely — the deck is desktop-only
    const isMobile =
      /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
    setMobile(isMobile);
    if (isMobile) {
      setWebgl(true); // gate renders regardless; skip the probe
      return;
    }

    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') ?? c.getContext('webgl');
      setWebgl(!!gl);
    } catch {
      setWebgl(false);
    }

    // auto quality tier (plan §11): low-memory → PERFORMANCE
    const nav = navigator as Navigator & { deviceMemory?: number };
    if (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) {
      useApp.getState().setQuality('PERFORMANCE');
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyRm = () => useApp.getState().setReducedMotion(mq.matches);
    applyRm();
    mq.addEventListener('change', applyRm);

    // console handle for debugging / e2e driving
    (window as unknown as { __app?: typeof useApp }).__app = useApp;
    return () => mq.removeEventListener('change', applyRm);
  }, []);

  if (mobile) return <MobileGate />;

  if (webgl === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <span className="font-data animate-breathe" style={{ color: COLORS.textMuted, fontSize: '0.75rem' }}>
          INITIALIZING FLIGHT SYSTEMS…
        </span>
      </div>
    );
  }
  if (!webgl) return <NoWebGL />;

  return (
    <div className="deck-cursor fixed inset-0">
      <Canvas
        dpr={quality === 'CINEMATIC' ? [1, 2] : [1, 1.5]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        style={{ background: COLORS.void }}
      >
        <color attach="background" args={[COLORS.void]} />
        <Scene />
      </Canvas>
      <Hud />
    </div>
  );
}
