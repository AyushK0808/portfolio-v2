'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LOCATIONS } from '@/lib/theme';
import { BEACON_NODES } from '@/systems/flightplan';
import { StopMarker } from '../Markers';
import { HullMaterial } from '../kit';
import { IcePlanet, Spin } from '../Worlds';

const theme = LOCATIONS.ACHIEVEMENTS;

/** one monument beacon: a slim obelisk with a lit crown */
function Beacon({ seed }: { seed: number }) {
  const halo = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (halo.current) halo.current.rotation.z = t * 0.35 + seed;
  });
  return (
    <group>
      {/* obelisk */}
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.16, 0.42, 3.2, 6]} />
        <HullMaterial tint="#93a4b8" />
      </mesh>
      {/* lit crown */}
      <mesh position={[0, 1.15, 0]}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial color="#000" emissive={theme.base} emissiveIntensity={1.1} toneMapped={false} />
      </mesh>
      <mesh ref={halo} position={[0, 1.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.022, 6, 48]} />
        <meshBasicMaterial color={theme.base} toneMapped={false} />
      </mesh>
      {/* base collar */}
      <mesh position={[0, -2.15, 0]}>
        <cylinderGeometry args={[0.62, 0.7, 0.14, 6]} />
        <meshStandardMaterial color="#000" emissive={theme.base} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <pointLight position={[1.2, 0.6, 3.4]} color={theme.bright} intensity={6} distance={12} decay={1.7} />
    </group>
  );
}

/**
 * ACHIEVEMENTS — four monument beacons climbing away from the ship, one per
 * achievement. The last stop on the route.
 */
export default function Achievements() {
  return (
    <group>
      {/* Cairn: the ice world the beacons stand watch over, aurora at its pole */}
      <group position={[95, -30, -290]} rotation={[0.62, 0, 0.3]}>
        <Spin speed={0.004}>
          <IcePlanet radius={105} sunDirection={[0.9, 0.3, 0.3]} />
        </Spin>
      </group>
      {BEACON_NODES.map((node, i) => (
        <group key={node.id} position={node.pos}>
          <Beacon seed={i * 2.1} />
          <StopMarker
            index={i}
            id={node.id}
            label={node.label}
            color={theme.base}
            position={[0, 2.0, 0]}
          />
        </group>
      ))}
      <directionalLight position={[-6, 10, 4]} color={theme.bright} intensity={0.8} />
    </group>
  );
}
