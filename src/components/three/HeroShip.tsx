'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useApp } from '@/state/store';
import { COLORS } from '@/lib/theme';
import { SHIP_FIT, SHIP_POS } from '@/systems/flightplan';
import { arrival } from '@/systems/intro';
import { Model } from './Model';

/**
 * AYK-08 — the pilot's ship, seen from outside during the cold open, on the
 * title screen, while boarding, and in the hangar view. The hull is the
 * Northstar model (nose along -Z, canopy over the hub's seat). During the cold
 * open it drops out of hyperspace astern as a streak, sheds its speed and
 * slides past the camera to rest.
 *
 * `display` = the hangar view: just the hull at rest, no arrival, no load signal.
 */

const SHIP_URL = '/3d/hero_ship.glb';
useGLTF.preload(SHIP_URL);

/** the model's nose points along +X; turn it to face -Z */
const SHIP_ROTATION: [number, number, number] = [0, Math.PI / 2, 0];

/* deterministic PRNG so the dust lanes are identical every visit */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ──────────── space dust streaming past (motion cue) ─────────── */

const DUST_COUNT = 150;

function DustStream() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const boost = useRef(1);
  const lanes = useMemo(() => {
    const rng = mulberry32(20817);
    return Array.from({ length: DUST_COUNT }, () => {
      let x = 0;
      let y = 0;
      // keep motes out of the hull volume so streaks never spear the ship
      do {
        x = (rng() * 2 - 1) * 24;
        y = (rng() * 2 - 1) * 8 + 1;
      } while (Math.abs(x) < 3.6 && Math.abs(y - 0.5) < 3);
      return { x, y, z: -40 + rng() * 56, sp: 9 + rng() * 8, len: 0.6 + rng() * 1.3 };
    });
  }, []);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    // while boarding the ship is running hard: the dust tears past
    const target = useApp.getState().phase === 'BOARDING' ? 5 : 1;
    boost.current += (target - boost.current) * Math.min(dt * 1.6, 1);
    const b = boost.current;
    for (let i = 0; i < DUST_COUNT; i++) {
      const l = lanes[i];
      l.z += l.sp * b * dt;
      if (l.z > 16) l.z -= 56;
      dummy.position.set(l.x, l.y, l.z);
      dummy.scale.set(1, 1, l.len * (0.6 + b * 0.4));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, DUST_COUNT]} frustumCulled={false}>
      <boxGeometry args={[0.016, 0.016, 1]} />
      <meshBasicMaterial
        color="#A8E9FF"
        transparent
        opacity={0.38}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/** soft round glow texture, generated once */
function useGlowTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

/* ────────────────────────── root ─────────────────────────── */

export function HeroShip({ display = false }: { display?: boolean }) {
  const move = useRef<THREE.Group>(null);
  const sway = useRef<THREE.Group>(null);
  const burst = useRef<THREE.Sprite>(null);
  const engine = useRef<THREE.Sprite>(null);
  const amp = useRef(display ? 1 : 0);
  const reducedMotion = useApp((s) => s.reducedMotion);
  const setShipLoaded = useApp((s) => s.setShipLoaded);
  const markLoaded = useApp((s) => s.markLoaded);
  const glow = useGlowTexture();

  // HeroShip sits inside a <Suspense>, so this effect only commits once the
  // ship GLB has resolved and the hull can be drawn — that is the signal the
  // loader waits for before its tunnel drops away and the cold open starts.
  useEffect(() => {
    if (display) return;
    setShipLoaded(true);
    markLoaded();
  }, [display, setShipLoaded, markLoaded]);

  useFrame((state, dt) => {
    const s = useApp.getState();
    const t = state.clock.elapsedTime;

    // ── the arrival: astern as a streak → hard deceleration → at rest ──
    let done = true;
    if (!display && s.phase === 'INTRO' && !s.reducedMotion) {
      const introT = (performance.now() - s.introStartedAt) / 1000;
      const a = arrival(introT);
      done = a.done;
      if (move.current) {
        move.current.visible = a.visible;
        move.current.position.z = a.offset;
        move.current.scale.z = a.stretch;
      }
      // the flash where it dropped out of hyperspace
      if (burst.current) {
        const since = introT - 0.35;
        const k = since < 0 ? 0 : Math.exp(-since * 4.5);
        burst.current.visible = k > 0.01;
        burst.current.scale.setScalar(90 * k + 6);
        (burst.current.material as THREE.SpriteMaterial).opacity = k;
        burst.current.position.z = a.offset + 6;
      }
    } else {
      if (move.current) {
        move.current.visible = true;
        move.current.position.z = 0;
        move.current.scale.z = 1;
      }
      if (burst.current) burst.current.visible = false;
    }

    // engines: bright while decelerating and while boarding, a calm idle otherwise
    if (engine.current) {
      const hard = !done || s.phase === 'BOARDING';
      const target = hard ? 3.4 : 1.7;
      const cur = engine.current.scale.x;
      const next = cur + (target - cur) * Math.min(dt * 3, 1);
      engine.current.scale.setScalar(next * (1 + Math.sin(t * 31) * 0.03));
    }

    // cruise sway once at rest on the title screen; eased to zero for BOARDING
    // so the hull holds still while the camera dives toward it
    const swayOn = display || (s.phase === 'INTRO' && done && !s.reducedMotion);
    amp.current += ((swayOn ? 1 : 0) - amp.current) * Math.min(dt * 2.5, 1);
    const g = sway.current;
    if (g) {
      g.rotation.z = Math.sin(t * 0.7) * 0.05 * amp.current;
      g.rotation.x = Math.sin(t * 0.53 + 1) * 0.022 * amp.current;
      g.rotation.y = Math.sin(t * 0.31) * 0.02 * amp.current;
      g.position.y = Math.sin(t * 0.8) * 0.1 * amp.current;
    }
  });

  return (
    <group position={SHIP_POS}>
      <group ref={move}>
        <group ref={sway}>
          <Model url={SHIP_URL} fit={SHIP_FIT} rotation={SHIP_ROTATION} />
          {/* engine glow at the stern */}
          <sprite ref={engine} position={[0, 0.1, SHIP_FIT / 2 + 0.2]} scale={1.7}>
            <spriteMaterial
              map={glow}
              color="#8FE3FF"
              transparent
              opacity={0.7}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </sprite>
          <pointLight position={[0, 0.2, SHIP_FIT / 2 + 1]} color={COLORS.hudCyanBright} intensity={14} distance={18} decay={1.8} />
          {/* ship-local light rig (mounted only while the exterior shows) */}
          <hemisphereLight args={['#35506B', '#0A0E17', 0.6]} />
          <directionalLight position={[6, 8, -9]} color="#FFF1DC" intensity={2.2} />
          <directionalLight position={[-7, 3, 10]} color="#7FB4CC" intensity={0.9} />
          <directionalLight position={[0, -6, -4]} color="#FFC24B" intensity={0.35} />
        </group>
      </group>
      {/* the flash where the ship drops out of hyperspace */}
      <sprite ref={burst} visible={false}>
        <spriteMaterial
          map={glow}
          color="#D8EEFF"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          fog={false}
        />
      </sprite>
      {!reducedMotion && !display && <DustStream />}
    </group>
  );
}
