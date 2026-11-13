'use client';

import { ReactNode, Suspense, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerspectiveCamera } from '@react-three/drei';
import { ALL_LOCATIONS, LOCATIONS, LocationId } from '@/lib/theme';
import { RELAY_POS } from '@/systems/flightplan';
import { CityPlanet, LavaPlanet } from '../three/Planets';
import { GasGiant, IcePlanet, OceanPlanet } from '../three/Worlds';
import { OrbitalTraffic } from '../three/CityOrbit';
import { getRockGeometries, getRockMaterial } from '../three/kit';
import { Model } from '../three/Model';
import { Relay } from '../three/locations/Comms';

/**
 * Development tool, not part of the site: renders one world (or the ship, an
 * asteroid, the relay) alone on a transparent background so it can be saved as
 * an image for the galaxy chart and the résumé page. Driven by
 * `scripts/capture-worlds.mjs`, which opens /dev/thumbs?id=<LOCATION> for each
 * location and calls `window.__capture()`.
 */

const R = 10;
/** camera distance at which a body of radius `r` fills `fill` of the frame (fov 20°) */
const dist = (r: number, fill = 0.82) => r / (fill * Math.tan((10 * Math.PI) / 180));

interface Subject {
  distance: number;
  node: ReactNode;
}

function Rocks() {
  const geos = getRockGeometries();
  const mat = getRockMaterial();
  return (
    <group>
      <mesh geometry={geos[0]} material={mat} scale={6.2} rotation={[0.4, 0.9, 0.2]} />
      <mesh geometry={geos[1]} material={mat} scale={1.7} position={[8.2, 5.4, -3]} rotation={[1.1, 0.2, 0.7]} />
      <mesh geometry={geos[2]} material={mat} scale={1.1} position={[-8.6, -5.2, 2]} rotation={[0.2, 1.4, 0.3]} />
      <mesh geometry={geos[3]} material={mat} scale={0.6} position={[-6.4, 6.6, 1]} rotation={[2.0, 0.4, 1.3]} />
      <directionalLight position={[-6, 5, 7]} color="#fff1dc" intensity={3.2} />
      <pointLight position={[14, -4, -8]} color="#B266FF" intensity={900} distance={60} decay={2} />
    </group>
  );
}

const SUBJECTS: Record<LocationId, Subject> = {
  HUB: {
    distance: dist(R * 1.15),
    node: (
      <group rotation={[0.42, -0.62, 0.12]}>
        <Model url="/3d/hero_ship.glb" fit={R * 2.2} />
        <directionalLight position={[-6, 8, 6]} color="#fff3df" intensity={3} />
        <pointLight position={[10, -3, -8]} color="#00D9F5" intensity={700} distance={60} decay={2} />
      </group>
    ),
  },
  ABOUT: {
    distance: dist(R * 1.06),
    node: <OceanPlanet radius={R} sunDirection={[-0.55, 0.4, 0.72]} />,
  },
  SKILLS: {
    distance: dist(R * 2.3, 0.94),
    node: (
      <group rotation={[0.1, 0, -0.18]}>
        <GasGiant radius={R} center={[0, 0, 0]} sunDirection={[-0.5, 0.35, 0.78]} ringTilt={[0.3, 0.1]} />
      </group>
    ),
  },
  EXPERIENCE: {
    distance: dist(R * 1.28, 0.9),
    node: (
      <group rotation={[0.2, 0.6, 0]}>
        <CityPlanet radius={R} sunDirection={[-0.9, 0.3, 0.12]} />
        <OrbitalTraffic radius={R} />
      </group>
    ),
  },
  PROJECTS: { distance: dist(R * 1.1), node: <Rocks /> },
  ACHIEVEMENTS: {
    distance: dist(R * 1.06),
    node: (
      <group rotation={[0.62, 0, 0.3]}>
        <IcePlanet radius={R} sunDirection={[-0.5, 0.3, 0.8]} />
      </group>
    ),
  },
  ARENA: {
    distance: dist(R * 1.08),
    node: <LavaPlanet radius={R} sunDirection={[-0.4, 0.5, 0.75]} />,
  },
  COMMS: {
    distance: dist(5.2),
    node: (
      <group rotation={[0.12, -0.55, 0]}>
        <group position={[-RELAY_POS[0], -RELAY_POS[1] + 1.6, -RELAY_POS[2]]}>
          <Relay />
        </group>
        <directionalLight position={[-5, 6, 7]} color="#fff3df" intensity={2.6} />
      </group>
    ),
  },
};

const srgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

type CaptureResult = { lg: string; sm: string; png: string };

/**
 * Renders the scene twice into a float buffer — over black and over white —
 * and recovers a true alpha from the difference, so soft atmosphere halos and
 * ring edges keep their transparency. Supersampled 2x, then scaled down.
 */
function Capture() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const capture = async (size = 768, ss = 2): Promise<CaptureResult> => {
      const S = size * ss;
      const rt = new THREE.WebGLRenderTarget(S, S, { type: THREE.FloatType, depthBuffer: true });
      const cam = camera as THREE.PerspectiveCamera;
      const aspect = cam.aspect;
      cam.aspect = 1;
      cam.updateProjectionMatrix();
      const read = (clear: number) => {
        gl.setRenderTarget(rt);
        gl.setClearColor(clear, 1);
        gl.clear();
        gl.render(scene, cam);
        const buf = new Float32Array(S * S * 4);
        gl.readRenderTargetPixels(rt, 0, 0, S, S, buf);
        return buf;
      };
      const B = read(0x000000);
      const W = read(0xffffff);
      gl.setRenderTarget(null);
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
      rt.dispose();

      const img = new ImageData(S, S);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = ((S - 1 - y) * S + x) * 4; // the buffer is bottom-up
          const o = (y * S + x) * 4;
          const r = B[i];
          const g = B[i + 1];
          const b = B[i + 2];
          // coverage from the black/white difference…
          let a = 1 - (W[i] - r + (W[i + 1] - g) + (W[i + 2] - b)) / 3;
          // …and additive glow (which has colour but no coverage) gets enough
          // alpha to carry its brightness
          a = Math.min(1, Math.max(a, r, g, b, 0));
          if (a < 1 / 512) continue;
          img.data[o] = Math.round(srgb(Math.min(1, Math.max(0, r / a))) * 255);
          img.data[o + 1] = Math.round(srgb(Math.min(1, Math.max(0, g / a))) * 255);
          img.data[o + 2] = Math.round(srgb(Math.min(1, Math.max(0, b / a))) * 255);
          img.data[o + 3] = Math.round(a * 255);
        }
      }
      let cur = document.createElement('canvas');
      cur.width = cur.height = S;
      cur.getContext('2d')!.putImageData(img, 0, 0);
      // halve repeatedly: one big downscale step aliases
      const shrink = (src: HTMLCanvasElement, to: number) => {
        let c = src;
        while (c.width > to) {
          const next = document.createElement('canvas');
          next.width = next.height = Math.max(to, Math.round(c.width / 2));
          const ctx = next.getContext('2d')!;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(c, 0, 0, next.width, next.height);
          c = next;
        }
        return c;
      };
      cur = shrink(cur, size);
      const small = shrink(cur, 192);
      return {
        lg: cur.toDataURL('image/webp', 0.9),
        sm: small.toDataURL('image/webp', 0.9),
        png: cur.toDataURL('image/png'),
      };
    };
    (window as unknown as { __capture?: typeof capture }).__capture = capture;
  }, [gl, scene, camera]);
  return null;
}

/** mounts only once the subject's assets are in */
function Ready() {
  useEffect(() => {
    const t = window.setTimeout(() => {
      (window as unknown as { __ready?: boolean }).__ready = true;
    }, 1200);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

export default function ThumbStudio() {
  const [id, setId] = useState<LocationId | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('id')?.toUpperCase() as LocationId | undefined;
    setId(q && ALL_LOCATIONS.includes(q) ? q : 'ABOUT');
  }, []);
  if (!id) return null;
  const subject = SUBJECTS[id];
  const theme = LOCATIONS[id];

  return (
    <div style={{ width: 768, height: 768, background: '#000' }}>
      <Canvas dpr={1} gl={{ antialias: true }}>
        <PerspectiveCamera makeDefault fov={20} near={1} far={2000} position={[0, 0, subject.distance]} />
        <Environment resolution={256} frames={1} environmentIntensity={0.85}>
          <color attach="background" args={['#05070c']} />
          <Lightformer form="circle" intensity={14} color="#fff3df" position={[-7, 6, 3]} scale={3.2} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={1.1} color="#9fb6ff" position={[0, 3, 9]} scale={[22, 9, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={2.4} color={theme.base} position={[8, -1, -6]} scale={[9, 5, 1]} target={[0, 0, 0]} />
        </Environment>
        <Suspense fallback={null}>
          {subject.node}
          <Ready />
        </Suspense>
        <Capture />
      </Canvas>
    </div>
  );
}
