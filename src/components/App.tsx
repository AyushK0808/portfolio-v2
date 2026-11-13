'use client';

import { Component, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas, RootState } from '@react-three/fiber';
import { useApp } from '@/state/store';
import { audio } from '@/systems/audio';
import { attachScrollInput } from '@/systems/scroll';
import { currentAddressLocation, locationFromHash, replaceLocation } from '@/systems/router';
import { COLORS } from '@/lib/theme';
import { Scene } from './three/Scene';
import { Hud } from './hud/Hud';
import { ShipViewer } from './ShipViewer';
import { LoadingScreen } from './LoadingScreen';

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
        [ VIEW 2D IMAGE ]
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
  const location = useApp((s) => s.location);
  const shipView = useApp((s) => s.shipView);
  useEffect(() => {
    // spaceship.mp3 plays on the 3D ship view and while flying a location —
    // not at the hub (open-space ambience) or on the comms channel
    const wantShip =
      shipView || (phase === 'FLIGHT' && location !== 'HUB' && location !== 'COMMS');
    audio.shipAmbience(wantShip);
  }, [phase, location, shipView]);
  return null;
}

/**
 * Deep links + browser history. The address bar names the current location;
 * Back/Forward jump between visited locations. A Back/Forward that lands
 * mid-jump is remembered and reconciled once the ship arrives.
 */
function HistoryDirector() {
  const pending = useRef(false);

  useEffect(() => {
    const follow = () => {
      const s = useApp.getState();
      const target = currentAddressLocation();
      if (s.phase === 'FLIGHT') {
        if (target !== s.location) s.jumpTo(target, { pushHistory: false });
      } else if (s.phase === 'JUMP') {
        pending.current = true;
      } else if (target !== 'HUB') {
        // still on the title screen: go straight there
        s.enterAt(target);
      }
    };
    window.addEventListener('popstate', follow);
    const unsub = useApp.subscribe(
      (s) => s.phase,
      (phase) => {
        if (phase === 'FLIGHT' && pending.current) {
          pending.current = false;
          follow();
        }
      },
    );
    return () => {
      window.removeEventListener('popstate', follow);
      unsub();
    };
  }, []);

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

  // wheel / touch / keys → the scroll engine, for as long as the deck is up
  useEffect(() => attachScrollInput(), []);

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
    <div className="deck-cursor flight-deck fixed inset-0">
      {/* safety net for a context-loss throw that surfaces during React render */}
      <CanvasErrorBoundary key={gen} onError={recover} fallback={null}>
        <Canvas
          dpr={quality === 'CINEMATIC' ? [1, 2] : quality === 'PERFORMANCE' ? [1, 1.5] : 1}
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
      {/* first-paint boot loader — holds until something real is on screen */}
      <LoadingScreen />
    </div>
  );
}

/**
 * Client root: WebGL detection, quality auto-tier, reduced-motion sync, deep
 * links, then the Canvas + canopy HUD. The same experience runs on every
 * screen size — there is no separate phone path.
 */
export default function App() {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const shipView = useApp((s) => s.shipView);

  useEffect(() => {
    let ok = false;
    try {
      const c = document.createElement('canvas');
      ok = !!(c.getContext('webgl2') ?? c.getContext('webgl'));
    } catch {
      ok = false;
    }
    setWebgl(ok);
    if (!ok) return;

    // a link straight to a location (e.g. /#projects) skips the intro and
    // drops out of hyperspace there; anything unrecognised falls back to the hub
    const linked = locationFromHash(window.location.hash);
    if (linked && linked !== 'HUB') useApp.getState().enterAt(linked);
    else if (window.location.hash) replaceLocation('HUB');

    // auto quality tier: low-memory devices start on the lighter tier
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
      <HistoryDirector />
      {shipView ? <ShipViewer /> : <Deck />}
    </>
  );
}
