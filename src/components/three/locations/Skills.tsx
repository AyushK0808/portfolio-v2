'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LOCATIONS } from '@/lib/theme';
import { DOCK_NODES, YARD_POS } from '@/systems/flightplan';
import { StopMarker, faceYaw } from '../Markers';
import { GlowMaterial, HullMaterial } from '../kit';
import { GasGiant } from '../Worlds';

const theme = LOCATIONS.SKILLS;

const hull = <HullMaterial tint="#7f8f96" />;
const hullBig = <HullMaterial tint="#74838a" repeat={3} />;
const glow = <GlowMaterial color={theme.base} />;

/** where the gas giant sits, far behind the yard */
const GIANT_POS: [number, number, number] = [70, -35, -250];

/** the yard itself: a slowly turning construction ring with a central spine */
function Yard() {
  const ring = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ring.current) ring.current.rotation.z = state.clock.elapsedTime * 0.03;
  });
  return (
    <group position={YARD_POS}>
      <group rotation={[Math.PI / 2 - 0.25, 0, 0]}>
        <group ref={ring}>
          <mesh>
            <torusGeometry args={[7.5, 0.34, 10, 72]} />
            {hullBig}
          </mesh>
          <mesh>
            <torusGeometry args={[7.5, 0.06, 6, 72]} />
            {glow}
          </mesh>
          {/* spokes */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} rotation={[0, 0, (i / 6) * Math.PI * 2]} position={[0, 0, 0]}>
              <boxGeometry args={[15, 0.16, 0.16]} />
              {hull}
            </mesh>
          ))}
        </group>
      </group>
      {/* central spine */}
      <mesh rotation={[0, 0, Math.PI / 2 - 0.25]}>
        <cylinderGeometry args={[0.9, 1.3, 9, 10]} />
        {hull}
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2 - 0.25]}>
        <cylinderGeometry args={[1.34, 1.34, 0.18, 10]} />
        {glow}
      </mesh>
      <pointLight color={theme.base} intensity={5} distance={70} decay={1.5} />
      <pointLight position={[0, 12, 10]} color={theme.bright} intensity={3} distance={60} decay={1.7} />
    </group>
  );
}

/** one dock: a berthing module with a lit bay, slightly different per skill group */
function Dock({ seed }: { seed: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.5 + seed) * 0.08;
  });
  const long = 1.5 + (seed % 3) * 0.35;
  return (
    <group ref={group}>
      <mesh>
        <boxGeometry args={[long, 0.9, 1.0]} />
        {hull}
      </mesh>
      {/* lit bay facing the ship */}
      <mesh position={[0, 0, 0.51]}>
        <planeGeometry args={[long * 0.72, 0.42]} />
        <meshBasicMaterial color={theme.base} transparent opacity={0.55} toneMapped={false} />
      </mesh>
      {/* gantry arms */}
      <mesh position={[long / 2 + 0.35, 0.3, 0]}>
        <boxGeometry args={[0.7, 0.08, 0.08]} />
        {hull}
      </mesh>
      <mesh position={[-long / 2 - 0.35, -0.3, 0]}>
        <boxGeometry args={[0.7, 0.08, 0.08]} />
        {hull}
      </mesh>
      {/* running lights */}
      <mesh position={[long / 2 + 0.7, 0.3, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        {glow}
      </mesh>
      <mesh position={[-long / 2 - 0.7, -0.3, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        {glow}
      </mesh>
      <pointLight position={[1.2, 1.4, 3.2]} color={theme.bright} intensity={7} distance={11} decay={1.6} />
    </group>
  );
}

/**
 * SKILLS — the yard. Five docks on an arc, one per skill group; the rail sweeps
 * around the front of the ring from the first dock to the last.
 */
export default function Skills() {
  return (
    <group>
      {/* the ringed giant the yard orbits */}
      <group position={GIANT_POS}>
        <GasGiant radius={95} center={GIANT_POS} sunDirection={[-0.55, 0.3, 0.78]} ringTilt={[0.34, 0.16]} />
      </group>
      <Yard />
      {DOCK_NODES.map((n, i) => (
        <group key={n.id} position={n.pos}>
          <group rotation={faceYaw(n.pos, n.park)}>
            <Dock seed={i + 1} />
          </group>
          <StopMarker
            index={i}
            id={n.id}
            label={n.label}
            color={theme.base}
            position={[0, 1.15, 0]}
          />
        </group>
      ))}
    </group>
  );
}
