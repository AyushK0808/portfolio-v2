'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { useApp, useLocationTheme } from '@/state/store';
import { COLORS } from '@/lib/theme';
import { FONT_HUD } from './materials';

/**
 * Holographic stand-in shown by <Suspense> while an incoming location's
 * component and 3D assets stream in. A slowly spinning wireframe reticle in the
 * location's palette plus a readout, so dropping out of lightspeed never lands
 * the pilot in an empty void — the real set-dressing fades in over it.
 */
export function LocationPlaceholder() {
  const theme = useLocationTheme();
  // the title/boarding phases frame the exterior hero ship — no in-world
  // hologram there (the DOM loading screen owns the first load)
  const exterior = useApp((s) => s.phase === 'INTRO' || s.phase === 'BOARDING');
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current) group.current.rotation.y = t * 0.35;
    if (inner.current) {
      inner.current.rotation.x = t * 0.6;
      inner.current.rotation.z = t * 0.25;
      const s = 1 + Math.sin(t * 2.2) * 0.06;
      inner.current.scale.setScalar(s);
    }
  });

  if (exterior) return null;

  return (
    <group position={[0, 1, -14]}>
      <group ref={group}>
        {/* outer scaffold ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.2, 0.02, 8, 64]} />
          <meshBasicMaterial color={theme.base} transparent opacity={0.5} toneMapped={false} />
        </mesh>
        <group ref={inner}>
          <mesh>
            <icosahedronGeometry args={[1.7, 1]} />
            <meshBasicMaterial color={theme.bright} wireframe transparent opacity={0.7} toneMapped={false} />
          </mesh>
        </group>
      </group>

      <Billboard position={[0, -3.4, 0]}>
        <Text font={FONT_HUD} fontSize={0.34} color={theme.base} anchorX="center" letterSpacing={0.14}>
          {`RESOLVING ${theme.name}`}
        </Text>
        <Text
          font={FONT_HUD}
          fontSize={0.2}
          position={[0, -0.55, 0]}
          color={COLORS.textMuted}
          anchorX="center"
          letterSpacing={0.24}
        >
          STAND BY…
        </Text>
      </Billboard>

      <pointLight color={theme.base} intensity={3} distance={30} decay={1.6} />
    </group>
  );
}

/**
 * Sibling of the active location inside its <Suspense> boundary. Because it
 * only commits once the boundary has resolved, its mount is a reliable "this
 * location's component + assets are loaded" signal — which <JumpController>
 * waits on before dropping the pilot out of lightspeed.
 */
export function LocationReadyBeacon() {
  const setLocationReady = useApp((s) => s.setLocationReady);
  useEffect(() => {
    setLocationReady(true);
  }, [setLocationReady]);
  return null;
}
