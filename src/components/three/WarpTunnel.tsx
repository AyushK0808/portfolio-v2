'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useApp } from '@/state/store';
import { SECTORS } from '@/lib/theme';
import { warpEnvelope } from '@/systems/flightplan';
import { WarpMaterial } from './materials';

/**
 * Hyperspace streak cylinder wrapped around the camera during WARP.
 * Streak color crossfades cyan → destination sector (bible §7.4).
 */
export function WarpTunnel() {
  const mat = useRef<InstanceType<typeof WarpMaterial>>(null);
  const phase = useApp((s) => s.phase);
  const warpTarget = useApp((s) => s.warpTarget);
  const warpStartedAt = useApp((s) => s.warpStartedAt);
  const warpDuration = useApp((s) => s.warpDuration);
  const reducedMotion = useApp((s) => s.reducedMotion);

  useFrame((state) => {
    const m = mat.current;
    if (!m) return;
    m.uTime = state.clock.elapsedTime;
    if (phase === 'WARP' && !reducedMotion) {
      const now = performance.now();
      m.uProgress = warpEnvelope(warpStartedAt, now, warpDuration);
      m.uRaw = Math.min(Math.max((now - warpStartedAt) / warpDuration, 0), 1);
    } else {
      m.uProgress = 0;
      m.uRaw = 0;
    }
    if (warpTarget) {
      (m.uColorTo as THREE.Color).set(SECTORS[warpTarget].base);
    }
  });

  if (phase !== 'WARP' || reducedMotion) return null;

  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={10}>
      <cylinderGeometry args={[5, 5, 80, 48, 1, true]} />
      <warpMaterial
        ref={mat}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
