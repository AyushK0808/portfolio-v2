'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useApp } from '@/state/store';
import { COLORS } from '@/lib/theme';
import { Model } from './Model';

/**
 * AYK-08 — the pilot's ship, seen from outside on the title screen and in the
 * hangar view. The hull is now the spaceship.glb asset (auto-fit + centered);
 * the cruise sway, streaming space dust and local light rig are kept so it still
 * reads as a living beauty pass. Mounted during BOOT/POWERUP and in ShipViewer.
 */

const SHIP_URL = '/3d/spaceship.glb';
useGLTF.preload(SHIP_URL);

/* deterministic PRNG so the dust lanes are identical every visit */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ──────────── space dust streaming past (motion cue) ─────────── */

const DUST_COUNT = 150;

function DustStream() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const phase = useApp((s) => s.phase);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lanes = useMemo(() => {
    const rng = mulberry32(20817);
    return Array.from({ length: DUST_COUNT }, () => {
      let x = 0;
      let y = 0;
      // keep motes out of the hull volume so streaks never spear the ship
      do {
        x = (rng() * 2 - 1) * 24;
        y = (rng() * 2 - 1) * 8 + 1;
      } while (Math.abs(x) < 3.6 && Math.abs(y - 0.5) < 3);
      return { x, y, z: -40 + rng() * 56, sp: 9 + rng() * 8, len: 0.6 + rng() * 1.3 };
    });
  }, []);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    const boost = phase === 'POWERUP' ? 1.5 : 1;
    for (let i = 0; i < DUST_COUNT; i++) {
      const l = lanes[i];
      l.z += l.sp * boost * dt;
      if (l.z > 16) l.z -= 56;
      dummy.position.set(l.x, l.y, l.z);
      dummy.scale.set(1, 1, l.len);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, DUST_COUNT]} frustumCulled={false}>
      <boxGeometry args={[0.016, 0.016, 1]} />
      <meshBasicMaterial
        color="#A8E9FF"
        transparent
        opacity={0.38}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/* ────────────────────────── root ─────────────────────────── */

export function HeroShip() {
  const sway = useRef<THREE.Group>(null);
  const amp = useRef(0);
  const reducedMotion = useApp((s) => s.reducedMotion);
  const setShipLoaded = useApp((s) => s.setShipLoaded);

  // HeroShip sits inside a <Suspense>, so this effect only commits once the
  // ship GLB has resolved and the hull is actually on screen — that's the
  // signal the initial loading screen waits for before lifting.
  useEffect(() => {
    setShipLoaded(true);
  }, [setShipLoaded]);

  useFrame((state, dt) => {
    const s = useApp.getState();
    const t = state.clock.elapsedTime;
    // cruise sway on the title screen; eased to zero for POWERUP so the ship
    // holds still while the boarding camera dives toward it
    const target = s.phase === 'BOOT' && !s.reducedMotion ? 1 : 0;
    amp.current += (target - amp.current) * Math.min(dt * 2.5, 1);
    const g = sway.current;
    if (g) {
      g.rotation.z = Math.sin(t * 0.7) * 0.05 * amp.current;
      g.rotation.x = Math.sin(t * 0.53 + 1) * 0.022 * amp.current;
      g.rotation.y = Math.sin(t * 0.31) * 0.02 * amp.current;
      g.position.y = Math.sin(t * 0.8) * 0.1 * amp.current;
    }
  });

  return (
    <group>
      <group ref={sway}>
        {/* the real hull — auto-fit to roughly the old procedural footprint,
            centered on the title-orbit focus so the beauty pass frames it */}
        <Model url={SHIP_URL} fit={15} position={[0, 0.75, -1]} />
        {/* ship-local light rig (mounted only while the exterior shows) */}
        <hemisphereLight args={['#35506B', '#0A0E17', 0.6]} />
        <directionalLight position={[6, 8, -9]} color="#BFE9FF" intensity={1.8} />
        <directionalLight position={[-7, 3, 10]} color="#7FB4CC" intensity={1.0} />
        <directionalLight position={[0, -6, -4]} color="#FFC24B" intensity={0.4} />
        <pointLight position={[0, 1.4, 4]} color={COLORS.hudCyanBright} intensity={12} distance={16} decay={1.8} />
      </group>
      {!reducedMotion && <DustStream />}
    </group>
  );
}
