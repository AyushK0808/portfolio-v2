'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * What circles a city planet: traffic lanes (thin streams of ship lights) and
 * a few orbital stations seen as lit silhouettes. Both sell the scale — the
 * planet is big enough to have rush hour in orbit.
 */

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let dotTexture: THREE.CanvasTexture | null = null;
/** a soft round point, so ship lights are dots rather than squares */
function getDotTexture(): THREE.CanvasTexture {
  if (dotTexture) return dotTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  dotTexture = new THREE.CanvasTexture(c);
  dotTexture.colorSpace = THREE.SRGBColorSpace;
  return dotTexture;
}

interface Lane {
  /** orbit radius as a multiple of the planet's */
  r: number;
  /** tilt of the orbit plane: [about X, about Z] */
  tilt: [number, number];
  /** radians per second; the sign is the direction of travel */
  speed: number;
  count: number;
  seed: number;
}

const LANES: Lane[] = [
  { r: 1.07, tilt: [0.18, 0.1], speed: 0.034, count: 300, seed: 11 },
  { r: 1.085, tilt: [0.18, 0.1], speed: -0.03, count: 260, seed: 12 },
  { r: 1.13, tilt: [-0.42, 0.3], speed: 0.024, count: 260, seed: 13 },
  { r: 1.19, tilt: [0.9, -0.2], speed: -0.019, count: 220, seed: 14 },
  { r: 1.26, tilt: [-1.15, 0.55], speed: 0.014, count: 200, seed: 15 },
];

const SHIP_COLORS = ['#FFE2B0', '#FFC27A', '#FFF4E0', '#9FD8FF', '#FF9A6B'];

/** one lane: ship lights bunched into convoys along a narrow band */
function TrafficLane({ lane, radius }: { lane: Lane; radius: number }) {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const rng = seeded(lane.seed);
    const pos = new Float32Array(lane.count * 3);
    const col = new Float32Array(lane.count * 3);
    const c = new THREE.Color();
    // convoys: lights cluster around a handful of points on the ring
    const convoys = Array.from({ length: 14 }, () => rng() * Math.PI * 2);
    for (let i = 0; i < lane.count; i++) {
      const inConvoy = rng() < 0.7;
      const a = inConvoy
        ? convoys[Math.floor(rng() * convoys.length)] + (rng() - 0.5) * 0.28
        : rng() * Math.PI * 2;
      const rr = radius * lane.r + (rng() - 0.5) * radius * 0.006;
      pos[i * 3] = Math.cos(a) * rr;
      pos[i * 3 + 1] = (rng() - 0.5) * radius * 0.012;
      pos[i * 3 + 2] = Math.sin(a) * rr;
      c.set(SHIP_COLORS[Math.floor(rng() * SHIP_COLORS.length)]).multiplyScalar(0.55 + rng() * 0.6);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [lane, radius]);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * lane.speed;
  });

  return (
    <group rotation={[lane.tilt[0], 0, lane.tilt[1]]}>
      <points ref={ref} geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          map={getDotTexture()}
          size={radius * 0.0075}
          sizeAttenuation
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </points>
    </group>
  );
}

/** streams of ship lights circling a planet of the given radius */
export function OrbitalTraffic({ radius }: { radius: number }) {
  return (
    <>
      {LANES.map((lane) => (
        <TrafficLane key={lane.seed} lane={lane} radius={radius} />
      ))}
    </>
  );
}

/** dark plated metal that ignores the scene fog, so the silhouette holds at range */
function StationHull() {
  return <meshStandardMaterial color="#3d424a" metalness={0.8} roughness={0.55} fog={false} />;
}

function StationGlow({ color, intensity = 2 }: { color: string; intensity?: number }) {
  return (
    <meshStandardMaterial
      color="#000"
      emissive={color}
      emissiveIntensity={intensity}
      toneMapped={false}
      fog={false}
    />
  );
}

/** a ring station: hub drum, habitat wheel on spokes, spires, lit window bands */
function Station({ scale, variant }: { scale: number; variant: number }) {
  const wheel = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (wheel.current) wheel.current.rotation.y = t * 0.12;
    // red navigation beacon: a short flash every couple of seconds
    if (beacon.current) beacon.current.emissiveIntensity = (t * 0.5 + variant * 0.37) % 1 < 0.12 ? 4 : 0.3;
  });
  const spokes = variant === 1 ? 3 : 4;
  return (
    <group scale={scale}>
      {/* hub drum with two window bands */}
      <mesh>
        <cylinderGeometry args={[0.42, 0.42, 1.5, 16]} />
        <StationHull />
      </mesh>
      {[-0.4, 0.4].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.43, 0.025, 6, 32]} />
          <StationGlow color="#FFD9A0" intensity={2.4} />
        </mesh>
      ))}
      {/* spires */}
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.03, 0.12, 1.2, 8]} />
        <StationHull />
      </mesh>
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[0.14, 0.04, 0.9, 8]} />
        <StationHull />
      </mesh>
      <mesh position={[0, 1.98, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial ref={beacon} color="#000" emissive="#FF3B30" emissiveIntensity={0.3} toneMapped={false} fog={false} />
      </mesh>
      {/* habitat wheel */}
      <group ref={wheel}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.7, 0.13, 10, 56]} />
          <StationHull />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.84, 0.02, 6, 72]} />
          <StationGlow color="#FFE9C4" intensity={2.6} />
        </mesh>
        {Array.from({ length: spokes }, (_, i) => (
          <mesh key={i} rotation={[0, (i / spokes) * Math.PI, 0]}>
            <boxGeometry args={[3.4, 0.07, 0.07]} />
            <StationHull />
          </mesh>
        ))}
        {variant === 2 && (
          // a second, smaller wheel stacked above
          <group position={[0, 0.55, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1.0, 0.09, 8, 40]} />
              <StationHull />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1.1, 0.016, 6, 48]} />
              <StationGlow color="#9FD8FF" intensity={2.2} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

interface StationOrbit {
  /** where it starts, as a direction from the planet's centre */
  dir: [number, number, number];
  /** orbit radius as a multiple of the planet's */
  r: number;
  scale: number;
  variant: number;
}

/**
 * Placed for the Experience lane, which looks at the planet from its +X/+Z
 * side: one far out by the sunlit limb, one near and high in front of the
 * night side, one mid-distance against open space.
 */
const STATIONS: StationOrbit[] = [
  { dir: [0.8, 0.35, -0.4], r: 1.2, scale: 1.6, variant: 2 },
  { dir: [0.6, 0.22, 0.77], r: 1.12, scale: 0.9, variant: 0 },
  { dir: [0.88, 0.28, 0.1], r: 1.3, scale: 1.3, variant: 1 },
];

/** a few lit platforms in slow orbit */
export function OrbitalStations({ radius }: { radius: number }) {
  const orbit = useRef<THREE.Group>(null);
  const places = useMemo(
    () =>
      STATIONS.map((s) => new THREE.Vector3(...s.dir).normalize().multiplyScalar(radius * s.r)),
    [radius],
  );
  useFrame((state) => {
    // slow enough that they hold their places for a visit, but never look pinned
    if (orbit.current) orbit.current.rotation.y = state.clock.elapsedTime * 0.0012;
  });
  return (
    <group ref={orbit}>
      {STATIONS.map((s, i) => (
        <group key={i} position={places[i]} rotation={[0.3 + i * 0.4, i * 1.1, 0.2]}>
          <Station scale={s.scale} variant={s.variant} />
        </group>
      ))}
    </group>
  );
}
