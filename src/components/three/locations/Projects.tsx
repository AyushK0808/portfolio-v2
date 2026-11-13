'use client';

import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useApp } from '@/state/store';
import { LOCATIONS } from '@/lib/theme';
import { DRIFT_NODES, GITHUB_STOP_ID } from '@/systems/flightplan';
import { PROJECTS, Project } from '@/content/projects';
import { Model } from '../Model';
import { StopMarker } from '../Markers';
import { GlowMaterial, HullMaterial, RockField, RockSpec } from '../kit';

const theme = LOCATIONS.PROJECTS;

const PROPS_URL = '/3d/asset_package.glb';
useGLTF.preload(PROPS_URL);

const drng = (a: number) => {
  const x = Math.sin(a * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** how far down the rail the belt extends (last node's z, with margin) */
const BELT_Z = DRIFT_NODES[DRIFT_NODES.length - 1].pos[2];

/**
 * Belt set dressing: cratered rocks (generated in code) strewn along the whole
 * rail, plus a couple of tumbling derelict props. Slowly spun as one group so
 * the field feels alive.
 */
function Belt() {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.z += dt * 0.004;
  });

  const rocks = useMemo<RockSpec[]>(
    () =>
      Array.from({ length: 90 }, (_, i) => {
        // keep a clear corridor around the rail: rocks sit 10+ units off-axis,
        // with the big ones pushed further out
        const big = drng(i + 1300);
        const r = 10 + drng(i) * 34 + big * 10;
        const a = drng(i + 500) * Math.PI * 2;
        return {
          pos: [
            Math.cos(a) * r,
            Math.sin(a) * r * 0.62,
            8 + drng(i + 900) * (BELT_Z - 40),
          ] as [number, number, number],
          scale: 0.35 + big * big * 3.4,
          rot: [drng(i) * 6.28, drng(i + 1) * 6.28, drng(i + 2) * 6.28] as [number, number, number],
        };
      }),
    [],
  );

  const props: { pos: [number, number, number]; rot: [number, number, number]; fit: number }[] = [
    { pos: [12, 5, -30], rot: [0.5, 0.8, 0.2], fit: 3.2 },
    { pos: [-13, -6, -52], rot: [1.1, 0.3, 0.9], fit: 3.6 },
  ];

  return (
    <group ref={spin}>
      <RockField rocks={rocks} />
      <Suspense fallback={null}>
        {props.map((pk, i) => (
          <Model key={`prop-${i}`} url={PROPS_URL} fit={pk.fit} position={pk.pos} rotation={pk.rot} />
        ))}
      </Suspense>
    </group>
  );
}

/** distinct low-poly artifact per project mesh type */
function ArtifactMesh({ type, seed }: { type: Project['mesh']; seed: number }) {
  const group = useRef<THREE.Group>(null);
  const reducedMotion = useApp((s) => s.reducedMotion);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y = t * (0.1 + (seed % 3) * 0.05) + seed;
    group.current.rotation.x = seed * 0.7;
    if (!reducedMotion) group.current.position.y = Math.sin(t * 0.7 + seed) * 0.15;
  });

  const hull = <HullMaterial tint="#8a84a0" />;
  const glow = <GlowMaterial color={theme.base} />;

  return (
    <group ref={group}>
      {type === 'satellite' && (
        <>
          <mesh><boxGeometry args={[0.7, 0.7, 0.9]} />{hull}</mesh>
          <mesh position={[1.0, 0, 0]}><boxGeometry args={[1.1, 0.04, 0.6]} />{glow}</mesh>
          <mesh position={[-1.0, 0, 0]}><boxGeometry args={[1.1, 0.04, 0.6]} />{glow}</mesh>
        </>
      )}
      {type === 'derelict' && (
        <>
          <mesh rotation={[0.4, 0, 0.9]}><cylinderGeometry args={[0.45, 0.6, 1.7, 7]} />{hull}</mesh>
          <mesh position={[0.5, 0.6, 0]} rotation={[0.9, 0.4, 0]}><boxGeometry args={[0.5, 0.5, 0.5]} />{hull}</mesh>
          <mesh position={[0, -0.5, 0.3]}><sphereGeometry args={[0.12, 6, 6]} />{glow}</mesh>
        </>
      )}
      {type === 'shard' && (
        <mesh scale={[0.5, 1.5, 0.5]}><octahedronGeometry args={[0.9, 0]} />{glow}</mesh>
      )}
      {type === 'probe' && (
        <>
          <mesh><sphereGeometry args={[0.55, 10, 10]} />{hull}</mesh>
          <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.02, 0.02, 1, 5]} />{hull}</mesh>
          <mesh position={[0, 1.45, 0]}><sphereGeometry args={[0.1, 6, 6]} />{glow}</mesh>
        </>
      )}
      {type === 'ring' && (
        <>
          <mesh rotation={[0.6, 0, 0.3]}><torusGeometry args={[0.85, 0.16, 6, 20]} />{hull}</mesh>
          <mesh><sphereGeometry args={[0.3, 8, 8]} />{glow}</mesh>
        </>
      )}
      {type === 'reactor' && (
        <>
          <mesh><icosahedronGeometry args={[0.75, 0]} />{hull}</mesh>
          <mesh scale={0.45}><icosahedronGeometry args={[0.75, 0]} />{glow}</mesh>
        </>
      )}
      {type === 'relay' && (
        <>
          <mesh rotation={[-0.7, 0, 0]}><coneGeometry args={[0.75, 0.6, 12, 1, true]} />{hull}</mesh>
          <mesh position={[0, -0.6, 0]}><cylinderGeometry args={[0.1, 0.14, 0.8, 6]} />{hull}</mesh>
          <mesh position={[0, 0.05, 0.22]} rotation={[-0.7, 0, 0]}><sphereGeometry args={[0.08, 6, 6]} />{glow}</mesh>
        </>
      )}
      {type === 'capsule' && (
        <>
          <mesh><capsuleGeometry args={[0.42, 0.8, 4, 10]} />{hull}</mesh>
          <mesh position={[0, 0, 0.42]}><sphereGeometry args={[0.09, 6, 6]} />{glow}</mesh>
        </>
      )}
    </group>
  );
}

/** the last stop: a signal buoy pointing at the rest of the work on GitHub */
function GithubBeacon() {
  const rings = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!rings.current) return;
    const t = state.clock.elapsedTime;
    rings.current.rotation.y = t * 0.5;
    rings.current.rotation.x = Math.sin(t * 0.3) * 0.4;
  });
  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial color="#000" emissive={theme.bright} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <group ref={rings}>
        <mesh>
          <torusGeometry args={[1.05, 0.03, 6, 48]} />
          <meshBasicMaterial color={theme.base} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.35, 0.02, 6, 48]} />
          <meshBasicMaterial color={theme.bright} transparent opacity={0.7} toneMapped={false} />
        </mesh>
      </group>
      <pointLight color={theme.bright} intensity={4} distance={14} decay={1.8} />
    </group>
  );
}

/**
 * PROJECTS — five builds adrift in the belt, one stop each, then a signal buoy
 * for everything else on GitHub.
 */
export default function Projects() {
  const quality = useApp((s) => s.quality);

  // faint micro-debris haze behind the real asteroids (cinematic tier only)
  const debris = useMemo(() => {
    const m = new THREE.Matrix4();
    const list: THREE.Matrix4[] = [];
    for (let i = 0; i < 200; i++) {
      const r = 9 + drng(i) * 28;
      const a = drng(i + 500) * Math.PI * 2;
      const s = 0.03 + drng(i + 1300) * 0.1;
      m.makeScale(s, s, s);
      m.setPosition(Math.cos(a) * r, Math.sin(a) * r * 0.6, -4 + drng(i + 900) * (BELT_Z - 16));
      list.push(m.clone());
    }
    return list;
  }, []);

  return (
    <group>
      <Belt />

      {quality === 'CINEMATIC' && (
        <instancedMesh
          args={[undefined, undefined, debris.length]}
          frustumCulled={false}
          onUpdate={(mesh) => {
            debris.forEach((m, i) => mesh.setMatrixAt(i, m));
            mesh.instanceMatrix.needsUpdate = true;
          }}
        >
          <tetrahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#241A38" roughness={0.9} />
        </instancedMesh>
      )}

      {DRIFT_NODES.map((node, i) => {
        const project = PROJECTS.find((p) => p.id === node.id);
        return (
          <group key={node.id} position={node.pos}>
            {node.id === GITHUB_STOP_ID || !project ? (
              <GithubBeacon />
            ) : (
              <ArtifactMesh type={project.mesh} seed={i + 1} />
            )}
            <StopMarker
              index={i}
              id={node.id}
              label={node.label}
              color={theme.base}
              position={[0, 1.7, 0]}
            />
            {/* key light from the ship's side so the hull facing the camera reads */}
            <pointLight position={[1.5, 1.5, 4]} color={theme.bright} intensity={8} distance={12} decay={1.6} />
          </group>
        );
      })}
    </group>
  );
}
