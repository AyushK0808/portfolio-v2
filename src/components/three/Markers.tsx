'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useApp } from '@/state/store';
import { FONT_HUD } from './materials';

/**
 * Pulsing waypoint diamond + label. The click affordance for every POI.
 */
export function HoloMarker({
  color,
  label,
  active = false,
  scanned = false,
}: {
  color: string;
  label: string;
  active?: boolean;
  scanned?: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const reducedMotion = useApp((s) => s.reducedMotion);

  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime;
    mesh.current.rotation.y = t * 0.9;
    if (!reducedMotion) {
      const pulse = 1 + Math.sin(t * 2.6) * (active ? 0.16 : 0.08);
      mesh.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      <mesh ref={mesh}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial
          color="#000000"
          emissive={color}
          emissiveIntensity={scanned ? 0.5 : 2.2}
          toneMapped={false}
          transparent
          opacity={scanned ? 0.55 : 0.95}
        />
      </mesh>
      <Text
        font={FONT_HUD}
        fontSize={0.17}
        letterSpacing={0.14}
        color={color}
        anchorX="center"
        anchorY="bottom"
        position={[0, 0.3, 0]}
        fillOpacity={scanned ? 0.5 : 0.95}
        // front side only — otherwise far-side markers read as mirrored text
        material-side={THREE.FrontSide}
      >
        {label.toUpperCase()}
      </Text>
    </group>
  );
}

/** yaw so a panel at `pos` faces the camera park position `toward` */
export function faceYaw(pos: [number, number, number], toward: [number, number, number]): [number, number, number] {
  return [0, Math.atan2(toward[0] - pos[0], toward[2] - pos[2]), 0];
}
