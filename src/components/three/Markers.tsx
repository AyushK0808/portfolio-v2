'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { useApp } from '@/state/store';
import { Interactable } from './Interactable';
import { FONT_HUD } from './materials';

/**
 * Pulsing waypoint diamond + label.
 */
export function HoloMarker({
  color,
  label,
  active = false,
}: {
  color: string;
  label: string;
  active?: boolean;
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
          emissiveIntensity={active ? 2.6 : 1.4}
          toneMapped={false}
          transparent
          opacity={0.95}
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
        fillOpacity={active ? 1 : 0.8}
      >
        {label.toUpperCase()}
      </Text>
    </group>
  );
}

/**
 * The in-world label for one stop on a location's rail. Always turns to face
 * the ship (the rail approaches each stop from several angles), and clicking it
 * glides the ship to that stop.
 */
export function StopMarker({
  index,
  id,
  label,
  color,
  position,
}: {
  index: number;
  id: string;
  label: string;
  color: string;
  position?: [number, number, number];
}) {
  const goToStop = useApp((s) => s.goToStop);
  const active = useApp((s) => s.stop === index && s.phase === 'FLIGHT');
  return (
    <Billboard position={position}>
      <Interactable id={`stop-${id}`} onSelect={() => goToStop(index)}>
        <HoloMarker color={color} label={label} active={active} />
      </Interactable>
    </Billboard>
  );
}

/** yaw so an object at `pos` faces the camera park position `toward` */
export function faceYaw(pos: [number, number, number], toward: [number, number, number]): [number, number, number] {
  return [0, Math.atan2(toward[0] - pos[0], toward[2] - pos[2]), 0];
}
