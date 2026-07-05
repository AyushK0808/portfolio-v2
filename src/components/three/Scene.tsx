'use client';

import { Suspense, lazy, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { useApp, useSectorTheme } from '@/state/store';
import { COLORS } from '@/lib/theme';
// bare import so the extend() call always executes — the named imports in
// other files are type-only and get elided by the compiler
import './materials';
import { Starfield } from './Starfield';
import { Cockpit } from './Cockpit';
import { WarpTunnel } from './WarpTunnel';
import { CameraDirector } from './CameraDirector';
import { PostFX } from './PostFX';

const Bridge = lazy(() => import('./sectors/Bridge'));
const SectorA = lazy(() => import('./sectors/SectorA'));
const SectorB = lazy(() => import('./sectors/SectorB'));
const SectorC = lazy(() => import('./sectors/SectorC'));
const SectorD = lazy(() => import('./sectors/SectorD'));
const SectorE = lazy(() => import('./sectors/SectorE'));
const SectorContact = lazy(() => import('./sectors/SectorContact'));

/** exp2 fog + the 3-light global rig, crossfaded to the sector palette */
function Atmosphere() {
  const theme = useSectorTheme();
  const scene = useThree((s) => s.scene);
  const fogRef = useRef<THREE.FogExp2 | null>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const targets = useRef({
    fog: new THREE.Color(),
    key: new THREE.Color(),
    rim: new THREE.Color(),
  });

  useEffect(() => {
    const fog = new THREE.FogExp2(COLORS.spaceDeep, 0.02);
    scene.fog = fog;
    fogRef.current = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  // fog = sector deep tinted toward space, never pure black (bible §2)
  targets.current.fog.set(theme.deep).lerp(new THREE.Color(COLORS.spaceDeep), 0.82);
  targets.current.key.set(theme.base);
  targets.current.rim.set(theme.bright);

  useFrame((_, dt) => {
    const k = Math.min(dt * 1.8, 1);
    const fog = fogRef.current;
    if (fog) {
      fog.color.lerp(targets.current.fog, k);
      fog.density += (theme.fogDensity - fog.density) * k;
    }
    key.current?.color.lerp(targets.current.key, k);
    rim.current?.color.lerp(targets.current.rim, k);
  });

  return (
    <>
      <ambientLight intensity={0.18} color={COLORS.spaceDeep} />
      <directionalLight ref={key} position={[-5, 8, 4]} intensity={0.9} />
      <directionalLight ref={rim} position={[6, 3, 8]} intensity={0.5} />
    </>
  );
}

export function Scene() {
  const sector = useApp((s) => s.sector);
  const phase = useApp((s) => s.phase);
  const reducedMotion = useApp((s) => s.reducedMotion);
  // full-blackout hyperspace: while the tunnel runs, nothing else renders
  const warping = phase === 'WARP' && !reducedMotion;

  return (
    <>
      <PerspectiveCamera makeDefault fov={56} near={0.1} far={2000} position={[0, 1.2, 0]}>
        {/* cockpit + warp tunnel ride with the camera */}
        <group visible={phase !== 'BOOT' && !warping}>
          <Cockpit />
        </group>
        <WarpTunnel />
      </PerspectiveCamera>
      <CameraDirector />
      <Atmosphere />
      <group visible={!warping}>
        <Starfield />
        <Suspense fallback={null}>
          {sector === 'BRIDGE' && <Bridge />}
          {sector === 'A' && <SectorA />}
          {sector === 'B' && <SectorB />}
          {sector === 'C' && <SectorC />}
          {sector === 'D' && <SectorD />}
          {sector === 'E' && <SectorE />}
          {sector === 'CONTACT' && <SectorContact />}
        </Suspense>
      </group>
      <PostFX />
    </>
  );
}
