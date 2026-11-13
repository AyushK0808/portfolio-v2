'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LOCATIONS } from '@/lib/theme';
import { LANE_NODES } from '@/systems/flightplan';
import { scroll } from '@/systems/scroll';
import { CityPlanet } from '../Planets';
import { OrbitalStations, OrbitalTraffic } from '../CityOrbit';
import { StopMarker } from '../Markers';
import { GlowMaterial, HullMaterial } from '../kit';

const theme = LOCATIONS.EXPERIENCE;

// approach path off the port bow: a distant disc at the lane entry that
// swells to fill the left of the frame by the last posting
const PLANET_FAR = new THREE.Vector3(-85, -14, -150);
const PLANET_NEAR = new THREE.Vector3(-42, -4, LANE_NODES[LANE_NODES.length - 1].pos[2] - 53);
const planetTarget = new THREE.Vector3();
const MERIDIAN_R = 48;
/**
 * Direction toward the sun: high off the starboard bow, beyond the planet. The
 * limb nearest the lane is the sunlit crescent; the rest of the disc is the
 * night side with its city lights.
 */
const SUN: [number, number, number] = [0.55, 0.5, -0.67];

/** the city world off the port bow, drawing closer with every posting passed */
function Meridian() {
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    if (spin.current) spin.current.rotation.y = state.clock.elapsedTime * 0.01;
    if (group.current) {
      // tied to the ship's position on the rail, so scrolling pulls it in
      const progress = THREE.MathUtils.clamp(
        (scroll.pos + 1) / LANE_NODES.length,
        0,
        1,
      );
      planetTarget.copy(PLANET_FAR).lerp(PLANET_NEAR, progress);
      group.current.position.lerp(planetTarget, 1 - Math.exp(-dt * 0.9));
    }
  });

  return (
    <group ref={group} position={PLANET_FAR}>
      <group ref={spin}>
        {/* procedural ecumenopolis: the terminator runs down the disc, so the
            lane sees the lit city fabric of the night side and the sunlit
            metal of the day side together. The shader is fully self-lit — no
            key light needed, nothing reaches the cockpit. */}
        <CityPlanet radius={MERIDIAN_R} sunDirection={SUN} />
      </group>
      {/* rush hour in orbit: ship-light lanes and a few stations */}
      <OrbitalTraffic radius={MERIDIAN_R} />
      <OrbitalStations radius={MERIDIAN_R} />
    </group>
  );
}

/** small outpost station; three silhouettes so neighbours never match */
function Outpost({ variant, seed }: { variant: number; seed: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.08 + seed;
  });

  const hull = <HullMaterial tint="#8f8a7c" />;
  const glow = <GlowMaterial color={theme.base} intensity={1.5} />;

  return (
    <group ref={group}>
      {variant === 0 && (
        <>
          <mesh>
            <boxGeometry args={[1.2, 1.2, 1.2]} />
            {hull}
          </mesh>
          {/* solar wings */}
          <mesh position={[1.35, 0, 0]}>
            <boxGeometry args={[1.4, 0.05, 0.8]} />
            {glow}
          </mesh>
          <mesh position={[-1.35, 0, 0]}>
            <boxGeometry args={[1.4, 0.05, 0.8]} />
            {glow}
          </mesh>
        </>
      )}
      {variant === 1 && (
        <>
          <mesh>
            <dodecahedronGeometry args={[0.9, 0]} />
            {hull}
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.4, 0.07, 6, 28]} />
            {glow}
          </mesh>
        </>
      )}
      {variant === 2 && (
        <>
          <mesh>
            <octahedronGeometry args={[1, 0]} />
            {hull}
          </mesh>
          <mesh position={[0, 1.3, 0]}>
            <coneGeometry args={[0.3, 0.8, 6]} />
            {glow}
          </mesh>
        </>
      )}
    </group>
  );
}

/**
 * EXPERIENCE — the approach lane: four postings as a chain of outposts along a
 * glowing flight ribbon, oldest first, with the city world growing off the bow.
 */
export default function Experience() {
  const ribbon = useMemo(() => {
    const pts = [
      new THREE.Vector3(0, 0.5, 4),
      ...LANE_NODES.map((n) => new THREE.Vector3(...n.pos)),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 120, 0.035, 6, false);
  }, []);

  const pulse = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((state) => {
    if (pulse.current) {
      pulse.current.opacity = 0.35 + Math.sin(state.clock.elapsedTime * 2.2) * 0.15;
    }
  });

  return (
    <group>
      <Meridian />

      {/* flight line ribbon */}
      <mesh geometry={ribbon}>
        <meshBasicMaterial ref={pulse} color={theme.base} transparent opacity={0.4} toneMapped={false} />
      </mesh>

      {LANE_NODES.map((node, i) => (
        <group key={node.id} position={node.pos}>
          <Outpost variant={i % 3} seed={i * 1.7} />
          <StopMarker
            index={i}
            id={node.id}
            label={node.label}
            color={theme.base}
            position={[0, 1.9, 0]}
          />
          {/* key light from the ship's side so the hull facing the camera reads */}
          <pointLight position={[1.5, 1.5, 4]} color={theme.bright} intensity={9} distance={12} decay={1.6} />
        </group>
      ))}
    </group>
  );
}
