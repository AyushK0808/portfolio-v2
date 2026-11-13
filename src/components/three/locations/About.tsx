'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { LOCATIONS } from '@/lib/theme';
import { FLIGHT, GIMBAL_POS, ORRERY_POS, PILOT_ID_POS, STATION_POS } from '@/systems/flightplan';
import { GlowMaterial, HullMaterial } from '../kit';
import { Model } from '../Model';
import { StopMarker, faceYaw } from '../Markers';
import { OceanPlanet, Spin } from '../Worlds';
import { HoloMaterial } from '../materials';

const theme = LOCATIONS.ABOUT;
const STOPS = FLIGHT.ABOUT.stops;

const STATION_URL = '/3d/big_ship.glb';
useGLTF.preload(STATION_URL);

/** home station — the capital vessel anchoring the location, warm amber rig */
function HomeStation() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    // slow yaw drift so the station feels like it's holding position
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.02;
  });

  return (
    <group position={STATION_POS}>
      <group ref={group}>
        {/* no inner <Suspense>: let the model load bubble up to the Scene
            boundary so the placeholder + lightspeed loader wait on it */}
        <Model url={STATION_URL} fit={22} />
      </group>
      {/* warm amber rig so the hull reads in the location palette */}
      <pointLight color={theme.base} intensity={4} distance={60} decay={1.6} />
      <pointLight position={[0, 14, 8]} color={theme.bright} intensity={3} distance={50} decay={1.8} />
      <directionalLight position={[10, 12, 6]} color="#FFE0A8" intensity={1.4} />
    </group>
  );
}

/** the pilot record: a small holographic ID plate floating off the station's bow */
function IdPlate() {
  const mat = useRef<InstanceType<typeof HoloMaterial>>(null);
  const spin = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (mat.current) mat.current.uTime = state.clock.elapsedTime;
    if (spin.current) spin.current.rotation.z = state.clock.elapsedTime * 0.4;
  });
  return (
    <group rotation={faceYaw(PILOT_ID_POS, STOPS[0].pose.pos)}>
      <mesh>
        <planeGeometry args={[1.05, 1.4]} />
        <holoMaterial
          ref={mat}
          uColor={new THREE.Color(theme.base)}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* head + shoulders glyph */}
      <mesh position={[0, 0.2, 0.01]}>
        <circleGeometry args={[0.2, 24]} />
        <meshBasicMaterial color={theme.bright} transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.3, 0.01]}>
        <circleGeometry args={[0.36, 24, 0, Math.PI]} />
        <meshBasicMaterial color={theme.bright} transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <mesh ref={spin} position={[0, 0, -0.02]}>
        <ringGeometry args={[0.92, 0.95, 48, 1, 0, Math.PI * 1.5]} />
        <meshBasicMaterial
          color={theme.base}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * "How I work": a gimbal instrument — three plated rings turning about a lit
 * core, each on its own axis, the way a gyroscope holds its heading.
 */
function Gimbal() {
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);
  const c = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (a.current) a.current.rotation.y = t * 0.35;
    if (b.current) b.current.rotation.x = t * 0.55;
    if (c.current) c.current.rotation.z = t * 0.8;
    if (core.current) core.current.scale.setScalar(1 + Math.sin(t * 2.4) * 0.06);
  });
  return (
    <group>
      <group ref={a}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.55, 0.07, 10, 72]} />
          <HullMaterial tint="#a89a80" />
        </mesh>
        {/* pivot studs where the next ring is carried */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.55, 0, 0]}>
            <sphereGeometry args={[0.11, 12, 10]} />
            <GlowMaterial color={theme.base} intensity={2} />
          </mesh>
        ))}
        <group ref={b}>
          <mesh>
            <torusGeometry args={[1.2, 0.06, 10, 64]} />
            <HullMaterial tint="#8f8a7c" />
          </mesh>
          <group ref={c}>
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.86, 0.05, 10, 56]} />
              <GlowMaterial color={theme.bright} intensity={1.3} />
            </mesh>
          </group>
        </group>
      </group>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.34, 1]} />
        <GlowMaterial color={theme.base} intensity={2.4} />
      </mesh>
      <pointLight color={theme.bright} intensity={6} distance={10} decay={1.6} />
      {/* key light from the ship's side so the plated rings read */}
      <pointLight position={[-2.5, 1.2, 4]} color="#FFE7C2" intensity={10} distance={12} decay={1.6} />
    </group>
  );
}

/** one body per interest: colour, orbit radius, size, speed, orbit tilt */
const ORBITERS = [
  { color: '#5DF2FF', r: 0.95, size: 0.13, speed: 0.9, tilt: 0.25 },
  { color: '#FFD98A', r: 1.3, size: 0.17, speed: 0.62, tilt: -0.4 },
  { color: '#B266FF', r: 1.65, size: 0.12, speed: 0.48, tilt: 0.7 },
  { color: '#35FFB0', r: 2.0, size: 0.15, speed: 0.36, tilt: -0.15 },
  { color: '#FF5A2E', r: 2.35, size: 0.11, speed: 0.28, tilt: 0.5 },
  { color: '#8FCBFF', r: 2.7, size: 0.14, speed: 0.22, tilt: -0.65 },
];

/** "Interests": a small orrery — six bodies circling a warm core, one each */
function Orrery() {
  const bodies = useRef<(THREE.Group | null)[]>([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    bodies.current.forEach((g, i) => {
      if (g) g.rotation.y = t * ORBITERS[i].speed + i * 1.3;
    });
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.3, 24, 18]} />
        <GlowMaterial color={theme.base} intensity={2.2} />
      </mesh>
      {ORBITERS.map((o, i) => (
        <group key={o.color} rotation={[o.tilt, 0, o.tilt * 0.5]}>
          {/* the orbit, drawn faintly */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[o.r, 0.008, 6, 96]} />
            <meshBasicMaterial color={theme.base} transparent opacity={0.3} toneMapped={false} />
          </mesh>
          <group
            ref={(el) => {
              bodies.current[i] = el;
            }}
          >
            <mesh position={[o.r, 0, 0]}>
              <icosahedronGeometry args={[o.size, 1]} />
              <GlowMaterial color={o.color} intensity={2.2} />
            </mesh>
          </group>
        </group>
      ))}
      <pointLight color={theme.bright} intensity={5} distance={10} decay={1.6} />
    </group>
  );
}

/**
 * ABOUT — home world. Four stops: the pilot record (who), the home station
 * (where from: education and focus areas), the gimbal (how I work) and the
 * orrery (interests).
 */
export default function About() {
  return (
    <group>
      {/* Firstlight: the home world, hanging off the port side behind the station */}
      <group position={[-105, -42, -310]}>
        <Spin speed={0.006}>
          <OceanPlanet radius={115} sunDirection={[0.55, 0.38, 0.74]} />
        </Spin>
      </group>
      <HomeStation />

      <group position={PILOT_ID_POS}>
        <IdPlate />
        <StopMarker
          index={0}
          id={STOPS[0].id}
          label={STOPS[0].label}
          color={theme.base}
          position={[0, 1.05, 0]}
        />
      </group>

      <StopMarker
        index={1}
        id={STOPS[1].id}
        label={STOPS[1].label}
        color={theme.base}
        position={[STATION_POS[0], STATION_POS[1] + 6.5, STATION_POS[2] + 3]}
      />

      <group position={GIMBAL_POS}>
        <Gimbal />
        <StopMarker
          index={2}
          id={STOPS[2].id}
          label={STOPS[2].label}
          color={theme.base}
          position={[0, 2.05, 0]}
        />
      </group>

      <group position={ORRERY_POS}>
        <Orrery />
        <StopMarker
          index={3}
          id={STOPS[3].id}
          label={STOPS[3].label}
          color={theme.base}
          position={[0, 1.55, 0]}
        />
      </group>
    </group>
  );
}
