'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useApp } from '@/state/store';
import { COLORS } from '@/lib/theme';
import { audio } from '@/systems/audio';
import { HeroShip } from './three/HeroShip';
import { SHIP_POS } from '@/systems/flightplan';
import { Starfield } from './three/Starfield';

/**
 * Standalone 3D hangar view of the AYK-08. Its own isolated Canvas (the main
 * flight-deck Canvas is unmounted while this is open, so only one WebGL context
 * is ever live). Drag to orbit, scroll to zoom; the ship ambience layer plays
 * here (driven by AudioDirector in App).
 */
export function ShipViewer() {
  const close = useApp((s) => s.closeShipView);

  return (
    <div className="deck-cursor fixed inset-0" style={{ background: COLORS.void }}>
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        style={{ background: COLORS.void }}
      >
        <color attach="background" args={[COLORS.void]} />
        <PerspectiveCamera
          makeDefault
          fov={42}
          near={0.1}
          far={2000}
          position={[SHIP_POS[0] + 9, SHIP_POS[1] + 4, SHIP_POS[2] + 12]}
        />
        <OrbitControls
          target={SHIP_POS}
          enablePan={false}
          minDistance={7}
          maxDistance={30}
          autoRotate
          autoRotateSpeed={0.5}
          enableDamping
          dampingFactor={0.08}
        />
        <ambientLight intensity={0.22} color={COLORS.spaceDeep} />
        <Starfield />
        <Suspense fallback={null}>
          <HeroShip display />
        </Suspense>
      </Canvas>

      {/* canopy chrome */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden select-none"
        style={{ zIndex: 40 }}
      >
        <div className="absolute inset-0 canopy-scanlines" />

        <div className="absolute left-4 top-4 md:left-6 md:top-6">
          <div className="font-hud" style={{ color: COLORS.hudCyan, fontSize: '0.9rem' }}>
            AYK-08 — HANGAR INSPECTION
          </div>
          <div
            className="font-data mt-1"
            style={{ color: COLORS.textSecondary, fontSize: '0.6875rem' }}
          >
            PORTFOLIO CLASS VESSEL · EXTERNAL SURVEY
          </div>
          <div className="font-data mt-1" style={{ color: COLORS.textMuted, fontSize: '0.6875rem' }}>
            DRAG TO ORBIT · SCROLL TO ZOOM
          </div>
        </div>

        <div className="absolute right-4 top-4 md:right-6 md:top-6 pointer-events-auto">
          <button
            className="hud-btn"
            onClick={close}
            onMouseEnter={() => audio.blip()}
            style={{ fontSize: '0.8125rem', padding: '10px 22px' }}
          >
            ✕ CLOSE HANGAR
          </button>
        </div>
      </div>
    </div>
  );
}
