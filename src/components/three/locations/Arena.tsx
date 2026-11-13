'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useApp } from '@/state/store';
import { audio } from '@/systems/audio';
import { COLORS, LOCATIONS } from '@/lib/theme';
import { FLIGHT } from '@/systems/flightplan';
import { LavaPlanet } from '../Planets';
import { getRockGeometries, getRockMaterial } from '../kit';
import { camTelemetry } from '../CameraDirector';

const theme = LOCATIONS.ARENA;

/**
 * ARENA — Emberfall Range. Rocks come in waves out of the dark toward the
 * ship; shoot them before they arrive. Each wave is bigger and faster. A rock
 * that reaches the ship costs one point of hull; at zero the run ends and the
 * score goes up against the all-time best.
 *
 * Aim is wherever you point: click or tap a rock to fire at it (Space fires at
 * the pointer). Reached from the map only.
 */

const SHIP = new THREE.Vector3(...FLIGHT.ARENA.entry.pos);
const POOL = 48;
const FIRE_COOLDOWN_MS = 130;
/** how close a rock gets before it counts as a hit on the hull */
const IMPACT_RADIUS = 4.2;

/** the lava world filling the horizon behind the range */
function LavaWorld() {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.012;
  });
  return (
    <group position={[8, -30, -165]}>
      <group ref={group}>
        {/* procedural lava world — the shader's molten fields light themselves */}
        <LavaPlanet radius={75} sunDirection={[0.35, 0.6, 0.55]} />
      </group>
      {/* molten glow bleeding up into the range */}
      <pointLight position={[-6, 60, 70]} color="#FF6A2E" intensity={14} distance={240} decay={1.3} />
    </group>
  );
}

interface Rock {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  spin: number;
  alive: boolean;
  /** aimed at the hull (true) or a near miss that just flies past (false) */
  threat: boolean;
}

interface Shot {
  key: number;
  from: [number, number, number];
  to: [number, number, number];
}

interface Boom {
  key: number;
  pos: [number, number, number];
  at: number;
  size: number;
}

/** what one wave asks of the pilot */
function waveSpec(wave: number) {
  return {
    count: 5 + wave * 3,
    /** seconds between spawns */
    interval: Math.max(0.34, 1.2 - wave * 0.085),
    /** units per second */
    speed: 9 + wave * 1.6,
  };
}

function launch(rock: Rock, speed: number) {
  // out of the dark ahead, spread across the view
  rock.pos.set(
    SHIP.x + (Math.random() * 2 - 1) * 44,
    SHIP.y + (Math.random() * 2 - 1) * 16 + 4,
    SHIP.z - 95 - Math.random() * 20,
  );
  // most are headed straight for the hull; a third are near misses
  rock.threat = Math.random() > 0.33;
  const spread = rock.threat ? 1.4 : 9 + Math.random() * 6;
  const a = Math.random() * Math.PI * 2;
  const target = new THREE.Vector3(
    SHIP.x + Math.cos(a) * spread,
    SHIP.y + Math.sin(a) * spread * 0.6,
    SHIP.z,
  );
  rock.vel.copy(target).sub(rock.pos).normalize().multiplyScalar(speed * (0.85 + Math.random() * 0.4));
  rock.scale = 0.8 + Math.random() * 1.3;
  rock.spin = Math.random() * 10;
  rock.alive = true;
}

/** soft round glow, generated once */
function useGlowTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,220,170,0.6)');
      g.addColorStop(0.7, 'rgba(255,120,40,0.12)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

/** a rock breaking up: a hot flash, an expanding shock ring, and it is gone */
function Explosion({ boom, glow }: { boom: Boom; glow: THREE.Texture }) {
  const flash = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    const p = THREE.MathUtils.clamp((performance.now() - boom.at) / 520, 0, 1);
    if (flash.current) {
      flash.current.scale.setScalar(boom.size * (1.5 + p * 5));
      (flash.current.material as THREE.SpriteMaterial).opacity = Math.pow(1 - p, 1.6);
    }
    if (ring.current) {
      ring.current.quaternion.copy(camera.quaternion);
      ring.current.scale.setScalar(boom.size * (0.6 + p * 4.5));
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.7;
    }
  });
  return (
    <group position={boom.pos}>
      <sprite ref={flash}>
        <spriteMaterial
          map={glow}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </sprite>
      <mesh ref={ring}>
        <ringGeometry args={[0.92, 1, 40]} />
        <meshBasicMaterial
          color={theme.bright}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}

export default function Arena() {
  const { camera, gl } = useThree();
  const glow = useGlowTexture();
  const rock = useMemo(() => {
    const mat = getRockMaterial().clone();
    // a touch of self-emission keeps targets readable far from the lights
    mat.emissive = new THREE.Color('#5a2a1c');
    mat.emissiveIntensity = 0.32;
    return { geo: getRockGeometries()[0], mat };
  }, []);

  const rocks = useRef<Rock[]>([]);
  if (rocks.current.length === 0) {
    rocks.current = Array.from({ length: POOL }, () => ({
      pos: new THREE.Vector3(0, -999, 0),
      vel: new THREE.Vector3(),
      scale: 1,
      spin: 0,
      alive: false,
      threat: true,
    }));
  }

  const inst = useRef<THREE.InstancedMesh>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [booms, setBooms] = useState<Boom[]>([]);
  const key = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const pointer = useRef(new THREE.Vector2(0, 0));
  const lastShot = useRef(0);
  /** this wave's bookkeeping */
  const run = useRef({ wave: 0, spawned: 0, nextSpawnAt: 0, clearedAt: 0 });

  // the all-time best: read on arrival, and reset the range on leaving
  useEffect(() => {
    let cancelled = false;
    fetch('/api/score')
      .then((r) => r.json() as Promise<{ best?: number }>)
      .then((d) => {
        if (!cancelled && typeof d?.best === 'number') useApp.getState().setArenaGlobalBest(d.best);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      useApp.getState().resetArena();
    };
  }, []);

  const pushBoom = (pos: THREE.Vector3, size: number) => {
    const b: Boom = { key: key.current++, pos: [pos.x, pos.y, pos.z], at: performance.now(), size };
    setBooms((prev) => [...prev.slice(-7), b]);
    window.setTimeout(() => setBooms((prev) => prev.filter((x) => x.key !== b.key)), 560);
  };

  // fire: click / tap fires at that point, Space fires at the pointer
  useEffect(() => {
    const fire = (ndcX: number, ndcY: number) => {
      const s = useApp.getState();
      if (s.phase !== 'FLIGHT' || s.location !== 'ARENA' || s.mapOpen || s.arenaState !== 'PLAYING') return;
      const now = performance.now();
      if (now - lastShot.current < FIRE_COOLDOWN_MS) return;
      lastShot.current = now;

      ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      let best: Rock | null = null;
      let bestT = Infinity;
      for (const r of rocks.current) {
        if (!r.alive) continue;
        tmp.copy(r.pos).sub(ray.ray.origin);
        const t = tmp.dot(ray.ray.direction);
        if (t < 0 || t > 220) continue;
        const missSq = tmp.lengthSq() - t * t;
        // a little forgiveness that grows with range, so far rocks (and
        // fingertips) are not pixel-hunting
        const reach = r.scale * 1.5 + t * 0.012;
        if (missSq < reach * reach && t < bestT) {
          bestT = t;
          best = r;
        }
      }
      // bolts leave from the nose, just below the pilot's eye line
      const from: [number, number, number] = [camera.position.x, camera.position.y - 0.45, camera.position.z - 1.2];
      const end = best
        ? best.pos
        : tmp.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 140);
      const shot: Shot = { key: key.current++, from, to: [end.x, end.y, end.z] };
      setShots((prev) => [...prev.slice(-5), shot]);
      window.setTimeout(() => setShots((prev) => prev.filter((x) => x.key !== shot.key)), 110);
      audio.laser();
      if (best) {
        best.alive = false;
        pushBoom(best.pos, best.scale);
        audio.hit();
        s.addScore(10);
      }
    };

    const el = gl.domElement;
    const toNdc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.current.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    };
    const down = (e: PointerEvent) => {
      toNdc(e);
      fire(pointer.current.x, pointer.current.y);
    };
    const move = (e: PointerEvent) => toNdc(e);
    const keyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      fire(pointer.current.x, pointer.current.y);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    window.addEventListener('keydown', keyDown);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      window.removeEventListener('keydown', keyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const now = performance.now();
    const t = state.clock.elapsedTime;
    const s = useApp.getState();
    const playing = s.arenaState === 'PLAYING' && s.phase === 'FLIGHT' && !s.mapOpen;
    const r = run.current;

    if (s.arenaState !== 'PLAYING') {
      // between runs: clear the field and re-arm
      if (r.wave !== 0) {
        r.wave = 0;
        rocks.current.forEach((x) => (x.alive = false));
      }
    } else if (playing) {
      // a new wave (or the first): reset its counters
      if (r.wave !== s.arenaWave) {
        r.wave = s.arenaWave;
        r.spawned = 0;
        r.nextSpawnAt = now + 1500;
        r.clearedAt = 0;
      }
      const spec = waveSpec(r.wave);
      if (r.spawned < spec.count && now >= r.nextSpawnAt) {
        const free = rocks.current.find((x) => !x.alive);
        if (free) {
          launch(free, spec.speed);
          r.spawned++;
          r.nextSpawnAt = now + spec.interval * 1000 * (0.7 + Math.random() * 0.6);
        }
      }

      let live = 0;
      for (const x of rocks.current) {
        if (!x.alive) continue;
        x.pos.addScaledVector(x.vel, dt);
        if (x.pos.distanceTo(SHIP) < IMPACT_RADIUS) {
          // it got through
          x.alive = false;
          pushBoom(x.pos, x.scale * 1.4);
          audio.hit();
          audio.error();
          camTelemetry.hit = 1;
          s.arenaHit();
          continue;
        }
        if (x.pos.z > SHIP.z + 8) {
          x.alive = false; // a near miss, gone past
          continue;
        }
        live++;
      }

      // wave cleared: a breath, a bonus, then the next
      if (r.spawned >= spec.count && live === 0 && useApp.getState().arenaState === 'PLAYING') {
        if (r.clearedAt === 0) {
          r.clearedAt = now;
          s.addScore(25 * r.wave);
          audio.transmit();
        } else if (now - r.clearedAt > 1400) {
          s.arenaNextWave();
        }
      }
    }

    const m = inst.current;
    if (m) {
      rocks.current.forEach((x, i) => {
        if (x.alive) {
          dummy.position.copy(x.pos);
          dummy.rotation.set(t * 0.5 + x.spin, x.spin, t * 0.3);
          dummy.scale.setScalar(x.scale);
        } else {
          dummy.position.set(0, -999, 0);
          dummy.scale.setScalar(0.001);
        }
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <LavaWorld />

      <instancedMesh ref={inst} args={[rock.geo, rock.mat, POOL]} frustumCulled={false} />

      {/* laser bolts: a white-hot core inside a coloured sheath */}
      {shots.map((sh) => (
        <group key={sh.key}>
          <Line points={[sh.from, sh.to]} color={COLORS.hudCyanBright} lineWidth={5} transparent opacity={0.55} />
          <Line points={[sh.from, sh.to]} color="#ffffff" lineWidth={1.6} transparent opacity={0.95} />
        </group>
      ))}

      {booms.map((b) => (
        <Explosion key={b.key} boom={b} glow={glow} />
      ))}

      {/* the range's own light: a warm key from the lava side, a cool fill */}
      <pointLight position={[0, 10, -30]} color={theme.bright} intensity={60} distance={120} decay={1.5} />
      <directionalLight position={[-8, 6, 10]} color="#bcd4ff" intensity={0.7} />
    </group>
  );
}
