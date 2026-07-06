'use client';

import { Component, ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Canvas, RootState } from '@react-three/fiber';
import { useApp } from '@/state/store';
import { audio } from '@/systems/audio';
import { COLORS } from '@/lib/theme';
import { Scene } from './three/Scene';
import { Hud } from './hud/Hud';
import { ShipViewer } from './ShipViewer';
import { LoadingScreen } from './LoadingScreen';

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

/** brief notice shown while the WebGL context is rebuilt after a GPU reset */
function RebootNotice() {
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
      <span
        className="font-data animate-breathe"
        style={{ color: COLORS.textMuted, fontSize: '0.75rem' }}
      >
        REINITIALIZING FLIGHT SYSTEMS…
      </span>
    </div>
  );
}

/**
 * Catches the synchronous render crash that follows a lost WebGL context
 * (three touches the null context → "reading 'alpha'"). It reports up so the
 * parent can remount the Canvas on a fresh context instead of white-screening.
 */
class CanvasErrorBoundary extends Component<
  { onError: () => void; fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** drives the ship-ambience audio layer from the flight state machine */
function AudioDirector() {
  const phase = useApp((s) => s.phase);
  const sector = useApp((s) => s.sector);
  const shipView = useApp((s) => s.shipView);
  useEffect(() => {
    // spaceship.mp3 plays on the 3D ship view + every mission except comms
    const wantShip = shipView || (phase === 'MISSION' && sector !== 'CONTACT');
    audio.shipAmbience(wantShip);
  }, [phase, sector, shipView]);
  return null;
}

/**
 * The flight deck: Canvas + HUD, wrapped so a lost GPU context recovers
 * cleanly. Windows GPUs occasionally reset the WebGL context (TDR); left
 * unhandled the canvas white-screens and, on the next frame, the post-processing
 * composer reads the now-null context → "Cannot read properties of null
 * (reading 'alpha')". That throw is uncaught (it fires inside the rAF render
 * loop, so a React error boundary can't catch it), so the primary defence is to
 * halt the loop the instant the context drops, then rebuild the whole Canvas
 * (fresh renderer + composer) on a bumped key.
 */
function Deck() {
  const quality = useApp((s) => s.quality);
  const [gen, setGen] = useState(0);
  const [recovering, setRecovering] = useState(false);

  const recover = useCallback(() => {
    setRecovering(true);
    setGen((g) => g + 1);
    window.setTimeout(() => setRecovering(false), 700);
  }, []);

  const onCreated = useCallback(
    (state: RootState) => {
      const renderer = state.gl;

      // A lost context makes gl.getContextAttributes() return null; the
      // post-processing composer reads `renderer.getContext().getContextAttributes().alpha`
      // every frame and throws uncaught ("reading 'alpha'"). loseContext()
      // dispatches asynchronously, so the loop can render one dead-context frame
      // before our handler below fires — cache the attributes on the raw context
      // and never hand back null, killing the throw at its source. Recovery
      // (remount) still swaps in a fresh context.
      const rawGl = renderer.getContext() as WebGLRenderingContext;
      const nativeGetAttrs = rawGl.getContextAttributes?.bind(rawGl);
      if (nativeGetAttrs) {
        const cached =
          nativeGetAttrs() ?? ({ alpha: false, depth: true, stencil: false } as WebGLContextAttributes);
        rawGl.getContextAttributes = () => nativeGetAttrs() ?? cached;
      }

      renderer.domElement.addEventListener(
        'webglcontextlost',
        (e) => {
          e.preventDefault(); // keep the loss recoverable
          // stop R3F's loop synchronously so PostFX can't render another frame
          // against the dead context before React tears this Canvas down
          state.setFrameloop('never');
          recover();
        },
        { once: true },
      );
    },
    [recover],
  );

  return (
    <div className="deck-cursor fixed inset-0">
      {/* safety net for a context-loss throw that surfaces during React render */}
      <CanvasErrorBoundary key={gen} onError={recover} fallback={null}>
        <Canvas
          dpr={quality === 'CINEMATIC' ? [1, 2] : [1, 1.5]}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          style={{ background: COLORS.void }}
          onCreated={onCreated}
        >
          <color attach="background" args={[COLORS.void]} />
          <Scene />
        </Canvas>
      </CanvasErrorBoundary>
      <Hud />
      {recovering && <RebootNotice />}
      {/* first-paint boot loader — holds until the hero ship is on screen */}
      <LoadingScreen />
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
  const shipView = useApp((s) => s.shipView);

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

  // the ship view runs its own isolated Canvas — unmount the deck so only one
  // WebGL context is ever live at a time
  return (
    <>
      <AudioDirector />
      {shipView ? <ShipViewer /> : <Deck />}
    </>
  );
}
