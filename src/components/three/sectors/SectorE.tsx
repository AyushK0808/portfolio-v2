'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Line, Text, useGLTF } from '@react-three/drei';
import { useApp } from '@/state/store';
import { audio } from '@/systems/audio';
import { COLORS, SECTORS } from '@/lib/theme';
import { Model } from '../Model';
import { HoloPanel, HoloText } from '../HoloPanel';
import { FONT_HUD } from '../materials';

const theme = SECTORS.E;

const MUSTAFAR_URL = '/3d/mustafar.glb';
const ASTEROID_URL = '/3d/asteroid.glb';
useGLTF.preload(MUSTAFAR_URL);
useGLTF.preload(ASTEROID_URL);

/** the lava world Mustafar filling the horizon behind the combat range —
 *  dead ahead and below the fight, well past the farthest asteroid spawn */
function Mustafar() {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.012;
  });
  return (
    <group position={[8, -30, -165]}>
      <group ref={group}>
        <Suspense fallback={null}>
          {/* lava fields carry themselves on the authored emissive map */}
          <Model url={MUSTAFAR_URL} fit={150} emissiveBoost={8} noFog />
        </Suspense>
      </group>
      {/* molten glow bleeding up into the arena */}
      <pointLight position={[-6, 60, 70]} color="#FF6A2E" intensity={14} distance={240} decay={1.3} />
    </group>
  );
}

/**
 * Pulls the rock mesh out of the asteroid GLB for instancing: recentered and
 * normalized to a 2-unit longest axis so the arena's hit-test radius
 * (a.scale * 1.5) keeps meaning the same thing it did for the old unit
 * icosahedron.
 */
function useAsteroidRock() {
  const { scene } = useGLTF(ASTEROID_URL);
  return useMemo(() => {
    let src: THREE.Mesh | null = null;
    scene.traverse((o) => {
      if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh;
    });
    if (!src) {
      return {
        geo: new THREE.IcosahedronGeometry(1, 0),
        mat: new THREE.MeshStandardMaterial({ color: '#2A1512', roughness: 0.9, metalness: 0.1 }),
      };
    }
    const mesh = src as THREE.Mesh;
    const geo = mesh.geometry.clone();
    geo.computeBoundingBox();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    geo.boundingBox!.getSize(size);
    geo.boundingBox!.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);
    const k = 2 / (Math.max(size.x, size.y, size.z) || 1);
    geo.scale(k, k, k);
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone();
    // rocks tumble up to ~80 units out, past the floodlights — a touch of
    // self-emission keeps live targets readable against the void
    const std = mat as THREE.MeshStandardMaterial;
    if (std.emissive && std.color) {
      std.emissive = std.color.clone();
      std.emissiveIntensity = 0.35;
    }
    return { geo, mat };
  }, [scene]);
}

const N_AST = 24;
const BOTS = [
  { name: 'VEGA-7', radius: 16, speed: 0.24, y: 3, hue: '#FFA24B' },
  { name: 'NYX_04', radius: 22, speed: -0.18, y: -2, hue: '#FF7FBF' },
  { name: 'ORION.EXE', radius: 27, speed: 0.13, y: 6, hue: '#8FB6FF' },
];
const ARENA_CENTER = new THREE.Vector3(0, 1, -32);

interface Asteroid {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  alive: boolean;
  respawnAt: number;
  spin: number;
}

interface Shot {
  key: number;
  from: [number, number, number];
  to: [number, number, number];
  color: string;
}

interface Boom {
  key: number;
  pos: [number, number, number];
  at: number;
}

function spawnAsteroid(a: Asteroid) {
  const ang = Math.random() * Math.PI * 2;
  const r = 26 + Math.random() * 22;
  a.pos.set(
    ARENA_CENTER.x + Math.cos(ang) * r,
    ARENA_CENTER.y + (Math.random() - 0.5) * 16,
    ARENA_CENTER.z + Math.sin(ang) * r,
  );
  const target = new THREE.Vector3(
    ARENA_CENTER.x + (Math.random() - 0.5) * 12,
    ARENA_CENTER.y + (Math.random() - 0.5) * 6,
    ARENA_CENTER.z + (Math.random() - 0.5) * 12,
  );
  a.vel.copy(target).sub(a.pos).normalize().multiplyScalar(1 + Math.random() * 2.2);
  a.scale = 0.7 + Math.random() * 1.6;
  a.alive = true;
  a.spin = Math.random() * 10;
}

/**
 * MISSION E — Arena. Solo asteroid range with AI wingmates ("bots") and a
 * session leaderboard. Turret aiming: drag to aim, click / Space to fire.
 * (Realtime multiplayer presence is the designed extension — see plan §8.)
 */
export default function SectorE() {
  const { camera, gl } = useThree();
  const rock = useAsteroidRock();
  const addScore = useApp((s) => s.addScore);
  const setPilotsOnline = useApp((s) => s.setPilotsOnline);
  const arenaScore = useApp((s) => s.arenaScore);

  const asteroids = useRef<Asteroid[]>([]);
  if (asteroids.current.length === 0) {
    asteroids.current = new Array(N_AST).fill(0).map(() => {
      const a: Asteroid = {
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        scale: 1,
        alive: true,
        respawnAt: 0,
        spin: 0,
      };
      spawnAsteroid(a);
      return a;
    });
  }

  const instRef = useRef<THREE.InstancedMesh>(null);
  const botRefs = useRef<(THREE.Group | null)[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [booms, setBooms] = useState<Boom[]>([]);
  const [botScores, setBotScores] = useState<number[]>([0, 0, 0]);
  const shotKey = useRef(0);
  const nextBotFire = useRef<number[]>([0, 0, 0]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    setPilotsOnline(1 + BOTS.length);
    return () => setPilotsOnline(1);
  }, [setPilotsOnline]);

  const pushShot = (shot: Shot) => {
    setShots((prev) => [...prev.slice(-6), shot]);
    window.setTimeout(
      () => setShots((prev) => prev.filter((sh) => sh.key !== shot.key)),
      140,
    );
  };
  const pushBoom = (pos: [number, number, number]) => {
    const b: Boom = { key: shotKey.current++, pos, at: performance.now() };
    setBooms((prev) => [...prev.slice(-5), b]);
    window.setTimeout(() => setBooms((prev) => prev.filter((x) => x.key !== b.key)), 420);
  };

  const destroy = (a: Asteroid, by: 'player' | number) => {
    a.alive = false;
    a.respawnAt = performance.now() + 1800 + Math.random() * 1500;
    pushBoom([a.pos.x, a.pos.y, a.pos.z]);
    audio.hit();
    if (by === 'player') addScore(10);
    else setBotScores((prev) => prev.map((sc, i) => (i === by ? sc + 10 : sc)));
  };

  // player fire: click or Space
  useEffect(() => {
    const fire = () => {
      const s = useApp.getState();
      if (s.phase !== 'MISSION' || s.sector !== 'E') return;
      ray.setFromCamera(new THREE.Vector2(0, 0), camera);
      let best: Asteroid | null = null;
      let bestT = Infinity;
      for (const a of asteroids.current) {
        if (!a.alive) continue;
        tmp.copy(a.pos).sub(ray.ray.origin);
        const t = tmp.dot(ray.ray.direction);
        if (t < 0 || t > 200) continue;
        const distSq = tmp.lengthSq() - t * t;
        const r = a.scale * 1.5;
        if (distSq < r * r && t < bestT) {
          bestT = t;
          best = a;
        }
      }
      const from: [number, number, number] = [
        camera.position.x,
        camera.position.y - 0.35,
        camera.position.z,
      ];
      const end = best
        ? ([best.pos.x, best.pos.y, best.pos.z] as [number, number, number])
        : ([
            camera.position.x + ray.ray.direction.x * 120,
            camera.position.y + ray.ray.direction.y * 120,
            camera.position.z + ray.ray.direction.z * 120,
          ] as [number, number, number]);
      pushShot({ key: shotKey.current++, from, to: end, color: COLORS.hudCyanBright });
      if (best) destroy(best, 'player');
      else audio.laser();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') fire();
    };
    const el = gl.domElement;
    el.addEventListener('pointerdown', fire);
    window.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('pointerdown', fire);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const now = performance.now();
    const t = state.clock.elapsedTime;

    // asteroids: integrate, respawn, wrap
    const inst = instRef.current;
    if (inst) {
      asteroids.current.forEach((a, i) => {
        if (!a.alive && now > a.respawnAt) spawnAsteroid(a);
        if (a.alive) {
          a.pos.addScaledVector(a.vel, dt);
          if (a.pos.distanceTo(ARENA_CENTER) > 60 || a.pos.z > 4) spawnAsteroid(a);
          dummy.position.copy(a.pos);
          dummy.rotation.set(t * 0.4 + a.spin, a.spin, t * 0.25);
          dummy.scale.setScalar(a.scale);
        } else {
          dummy.position.set(0, -999, 0);
          dummy.scale.setScalar(0.001);
        }
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
    }

    // bots: circle the arena, occasionally pick off an asteroid
    BOTS.forEach((b, i) => {
      const g = botRefs.current[i];
      const ang = t * b.speed + i * 2.1;
      const px = ARENA_CENTER.x + Math.cos(ang) * b.radius;
      const pz = ARENA_CENTER.z + Math.sin(ang) * b.radius;
      const py = ARENA_CENTER.y + b.y + Math.sin(t * 0.6 + i) * 0.8;
      if (g) {
        g.position.set(px, py, pz);
        g.rotation.y = -ang - Math.PI / 2;
      }
      if (now > nextBotFire.current[i]) {
        nextBotFire.current[i] = now + 2600 + Math.random() * 4200;
        const alive = asteroids.current.filter((a) => a.alive);
        if (alive.length > 0) {
          const target = alive[Math.floor(Math.random() * alive.length)];
          pushShot({
            key: shotKey.current++,
            from: [px, py, pz],
            to: [target.pos.x, target.pos.y, target.pos.z],
            color: b.hue,
          });
          destroy(target, i);
        }
      }
    });
  });

  const board = [
    { name: 'YOU — GUEST PILOT', score: arenaScore, you: true },
    ...BOTS.map((b, i) => ({ name: b.name, score: botScores[i], you: false })),
  ].sort((a, b) => b.score - a.score);

  return (
    <group>
      <Mustafar />

      {/* asteroid swarm — real rock mesh from the shared asteroid asset */}
      <instancedMesh ref={instRef} args={[rock.geo, rock.mat, N_AST]} frustumCulled={false} />

      {/* wingmate bots */}
      {BOTS.map((b, i) => (
        <group key={b.name} ref={(el) => void (botRefs.current[i] = el)}>
          <mesh rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.35, 1.3, 4]} />
            <meshStandardMaterial color="#141C2C" metalness={0.8} roughness={0.4} />
          </mesh>
          <mesh position={[-0.2, 0, 0]}>
            <boxGeometry args={[0.5, 0.06, 1.4]} />
            <meshStandardMaterial
              color="#000"
              emissive={b.hue}
              emissiveIntensity={1.4}
              toneMapped={false}
            />
          </mesh>
          <Billboard position={[0, 0.9, 0]}>
            <Text font={FONT_HUD} fontSize={0.28} color={b.hue} anchorX="center" letterSpacing={0.1}>
              {b.name}
            </Text>
          </Billboard>
        </group>
      ))}

      {/* laser bolts */}
      {shots.map((s) => (
        <Line key={s.key} points={[s.from, s.to]} color={s.color} lineWidth={2} transparent opacity={0.9} />
      ))}

      {/* explosions */}
      {booms.map((b) => (
        <Explosion key={b.key} pos={b.pos} at={b.at} />
      ))}

      {/* session leaderboard */}
      <group position={[8.5, 3.4, -14]} rotation={[0, -0.55, 0]}>
        <HoloPanel width={2.5} height={1.6} color={theme.base} title="SESSION LEADERBOARD">
          {board.map((row, i) => (
            <HoloText
              key={row.name}
              x={-1.12}
              y={0.5 - i * 0.24}
              size={0.085}
              color={row.you ? COLORS.hudCyanBright : COLORS.textSecondary}
            >
              {`${i + 1}. ${row.name.padEnd(20, ' ')} ${String(row.score).padStart(4, ' ')}`}
            </HoloText>
          ))}
          <HoloText x={-1.12} y={-0.55} size={0.055} color={COLORS.textMuted}>
            {`PILOTS ONLINE: ${1 + BOTS.length} (${BOTS.length} AI WINGMATES)`}
          </HoloText>
        </HoloPanel>
      </group>

      {/* red arena floodlights */}
      <pointLight position={[0, 8, -30]} color={theme.base} intensity={3} distance={70} decay={1.8} />
      <pointLight position={[-14, -6, -24]} color={theme.deep} intensity={2} distance={50} decay={1.8} />
    </group>
  );
}

function Explosion({ pos, at }: { pos: [number, number, number]; at: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!mesh.current) return;
    const p = THREE.MathUtils.clamp((performance.now() - at) / 400, 0, 1);
    mesh.current.scale.setScalar(0.3 + p * 2.6);
    (mesh.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.85;
  });
  return (
    <mesh ref={mesh} position={pos}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color={theme.bright} transparent opacity={0.8} toneMapped={false} wireframe />
    </mesh>
  );
}
