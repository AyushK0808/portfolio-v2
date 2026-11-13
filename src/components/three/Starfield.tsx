'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { useApp, useLocationTheme } from '@/state/store';
import { NebulaMaterial } from './materials';

/**
 * Persistent background: instanced stars + an fBm nebula dome that
 * crossfades toward the mounted location's palette.
 */
export function Starfield() {
  const theme = useLocationTheme();
  const quality = useApp((s) => s.quality);
  const phase = useApp((s) => s.phase);
  const location = useApp((s) => s.location);
  const nebulaRef = useRef<InstanceType<typeof NebulaMaterial>>(null);
  const nebulaMesh = useRef<THREE.Mesh>(null);
  const starsRef = useRef<THREE.Group>(null);
  const targetA = useRef(new THREE.Color(theme.base));
  const targetB = useRef(new THREE.Color(theme.deep));

  targetA.current.set(theme.base);
  targetB.current.set(theme.deep);

  const baseIntensity = quality === 'CINEMATIC' ? 1 : 0.7;

  useFrame((state, dt) => {
    const m = nebulaRef.current;
    if (m) {
      m.uTime = state.clock.elapsedTime;
      const k = Math.min(dt * 1.5, 1);
      (m.uColorA as THREE.Color).lerp(targetA.current, k);
      (m.uColorB as THREE.Color).lerp(targetB.current, k);
      // the title screen leans on the nebula as its hero — bloom it up there,
      // then settle back once the pilot is flying
      const target = phase === 'INTRO' ? baseIntensity * 1.55 : baseIntensity;
      m.uIntensity += (target - m.uIntensity) * Math.min(dt * 0.9, 1);
      // full spectral show on the title screen and at the hub; other locations keep a hint
      // of it so their own palette still dominates
      const atHub = phase === 'INTRO' || phase === 'BOARDING' || location === 'HUB';
      const multiTarget = atHub ? 1 : 0.2;
      m.uMulti += (multiTarget - m.uMulti) * Math.min(dt * 0.9, 1);
    }
    // slow parallax drift opposite to look
    if (starsRef.current) {
      starsRef.current.rotation.y = -state.camera.rotation.y * 0.02 + state.clock.elapsedTime * 0.002;
    }
    // lazy dome rotation so the gas keeps evolving as you sit at the hub
    if (nebulaMesh.current) {
      nebulaMesh.current.rotation.y = state.clock.elapsedTime * 0.006;
      nebulaMesh.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.02) * 0.06;
    }
  });

  return (
    <group>
      <group ref={starsRef}>
        <Stars
          radius={300}
          depth={60}
          count={quality === 'CINEMATIC' ? 6000 : quality === 'PERFORMANCE' ? 3500 : 2000}
          factor={4}
          saturation={0}
          fade
          speed={0.4}
        />
      </group>
      <mesh ref={nebulaMesh} scale={400}>
        <sphereGeometry args={[1, 48, 48]} />
        <nebulaMaterial
          ref={nebulaRef}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
          uIntensity={baseIntensity}
        />
      </mesh>
    </group>
  );
}
