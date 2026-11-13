'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Building blocks generated in code, shared by every location:
 *
 *  - hull plating: panel-line colour / bump / roughness maps drawn on a canvas,
 *    so plain boxes and cylinders read as plated, worn metal under the
 *    environment lighting
 *  - rocks: icospheres displaced by noise and pocked with craters, in a few
 *    shapes, for instanced asteroid fields
 */

/* ───────────────────────── deterministic noise ───────────────────────── */

function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

/** value noise, 0..1 */
function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), ux), l(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), ux), uy),
    l(
      l(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), ux),
      l(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), ux),
      uy,
    ),
    uz,
  );
}

function fbm3(x: number, y: number, z: number, octaves: number): number {
  let v = 0;
  let a = 0.5;
  let s = 0;
  for (let i = 0; i < octaves; i++) {
    v += a * noise3(x, y, z);
    s += a;
    x = x * 2.03 + 11.5;
    y = y * 2.03 + 7.3;
    z = z * 2.03 + 5.1;
    a *= 0.5;
  }
  return v / s;
}

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───────────────────────────── hull plating ───────────────────────────── */

interface HullTextures {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

let hullTextures: HullTextures | null = null;

/** panel lines, plate-to-plate tone variation, vents and wear — drawn once */
function getHullTextures(): HullTextures {
  if (hullTextures) return hullTextures;
  const S = 512;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return c;
  };
  const colorC = make();
  const bumpC = make();
  const roughC = make();
  const col = colorC.getContext('2d')!;
  const bump = bumpC.getContext('2d')!;
  const rough = roughC.getContext('2d')!;
  const rng = seeded(90210);

  col.fillStyle = '#9aa0a6';
  col.fillRect(0, 0, S, S);
  bump.fillStyle = '#808080';
  bump.fillRect(0, 0, S, S);
  rough.fillStyle = '#8c8c8c';
  rough.fillRect(0, 0, S, S);

  // plates: recursive split of the square into rectangles
  const plates: [number, number, number, number][] = [];
  const split = (x: number, y: number, w: number, h: number, depth: number) => {
    if (depth === 0 || (w < 70 && h < 70) || rng() < 0.12) {
      plates.push([x, y, w, h]);
      return;
    }
    if (w > h) {
      const k = Math.round(w * (0.35 + rng() * 0.3));
      split(x, y, k, h, depth - 1);
      split(x + k, y, w - k, h, depth - 1);
    } else {
      const k = Math.round(h * (0.35 + rng() * 0.3));
      split(x, y, w, k, depth - 1);
      split(x, y + k, w, h - k, depth - 1);
    }
  };
  split(0, 0, S, S, 5);

  for (const [x, y, w, h] of plates) {
    const tone = 132 + Math.floor(rng() * 54);
    col.fillStyle = `rgb(${tone},${tone + 2},${tone + 5})`;
    col.fillRect(x, y, w, h);
    const lift = 118 + Math.floor(rng() * 26);
    bump.fillStyle = `rgb(${lift},${lift},${lift})`;
    bump.fillRect(x, y, w, h);
    const r = 120 + Math.floor(rng() * 70);
    rough.fillStyle = `rgb(${r},${r},${r})`;
    rough.fillRect(x, y, w, h);

    // some plates carry a vent grille or an access hatch
    const pick = rng();
    if (pick < 0.16 && w > 60 && h > 40) {
      const gx = x + w * 0.2;
      const gy = y + h * 0.25;
      const gw = w * 0.6;
      const gh = h * 0.5;
      for (let i = 0; i < 6; i++) {
        const ly = gy + (i / 6) * gh;
        col.fillStyle = 'rgba(20,24,28,0.8)';
        col.fillRect(gx, ly, gw, gh / 14);
        bump.fillStyle = '#3a3a3a';
        bump.fillRect(gx, ly, gw, gh / 14);
      }
    } else if (pick < 0.3 && w > 50 && h > 50) {
      const hx = x + w * 0.3;
      const hy = y + h * 0.3;
      col.strokeStyle = 'rgba(30,34,40,0.7)';
      col.lineWidth = 2;
      col.strokeRect(hx, hy, w * 0.4, h * 0.4);
      bump.strokeStyle = '#4a4a4a';
      bump.lineWidth = 2;
      bump.strokeRect(hx, hy, w * 0.4, h * 0.4);
    }
  }
  // seams between plates
  for (const [x, y, w, h] of plates) {
    col.strokeStyle = 'rgba(18,22,28,0.85)';
    col.lineWidth = 2;
    col.strokeRect(x + 0.5, y + 0.5, w, h);
    bump.strokeStyle = '#202020';
    bump.lineWidth = 3;
    bump.strokeRect(x + 0.5, y + 0.5, w, h);
    rough.strokeStyle = '#e0e0e0';
    rough.lineWidth = 2;
    rough.strokeRect(x + 0.5, y + 0.5, w, h);
  }
  // wear: fine scratches and a few streaks
  for (let i = 0; i < 900; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const len = 4 + rng() * 26;
    const a = rng() * 0.12;
    col.strokeStyle = rng() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.6})`;
    col.lineWidth = 1;
    col.beginPath();
    col.moveTo(x, y);
    col.lineTo(x + (rng() - 0.5) * 6, y + len);
    col.stroke();
    rough.strokeStyle = `rgba(255,255,255,${a * 1.5})`;
    rough.beginPath();
    rough.moveTo(x, y);
    rough.lineTo(x + (rng() - 0.5) * 6, y + len);
    rough.stroke();
  }

  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  hullTextures = { map: tex(colorC, true), bumpMap: tex(bumpC, false), roughnessMap: tex(roughC, false) };
  return hullTextures;
}

/**
 * Plated metal for stations, docks, outposts and beacons. `tint` is the paint
 * colour; `repeat` tiles the plating (bigger objects want more plates).
 */
export function HullMaterial({ tint = '#8d97a3', repeat = 1 }: { tint?: string; repeat?: number }) {
  const maps = useMemo(() => {
    const base = getHullTextures();
    if (repeat === 1) return base;
    const clone = (t: THREE.CanvasTexture) => {
      const c = t.clone();
      c.repeat.set(repeat, repeat);
      c.needsUpdate = true;
      return c;
    };
    return { map: clone(base.map), bumpMap: clone(base.bumpMap), roughnessMap: clone(base.roughnessMap) };
  }, [repeat]);
  return (
    <meshStandardMaterial
      color={tint}
      map={maps.map}
      bumpMap={maps.bumpMap}
      bumpScale={1.6}
      roughnessMap={maps.roughnessMap}
      roughness={0.85}
      metalness={0.82}
      envMapIntensity={1.15}
    />
  );
}

/** self-lit trim: running lights, bay glow, light strips */
export function GlowMaterial({ color, intensity = 1.6 }: { color: string; intensity?: number }) {
  return (
    <meshStandardMaterial color="#000" emissive={color} emissiveIntensity={intensity} toneMapped={false} />
  );
}

/* ──────────────────────────────── rocks ──────────────────────────────── */

let rockGeometries: THREE.BufferGeometry[] | null = null;

/** a lumpy, cratered rock about 2 units across */
function buildRock(seed: number): THREE.BufferGeometry {
  const rng = seeded(seed);
  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 12);
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo, 1e-4);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  // overall shape: squash and stretch so no two rocks are spheres
  const sx = 0.75 + rng() * 0.5;
  const sy = 0.6 + rng() * 0.45;
  const sz = 0.8 + rng() * 0.5;
  const off = rng() * 100;

  // craters: centre direction, angular radius, depth
  const craters = Array.from({ length: 9 + Math.floor(rng() * 6) }, () => {
    const v = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
    return { v, r: 0.16 + rng() * 0.3, depth: 0.05 + rng() * 0.1 };
  });

  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).normalize();
    // large lumps, then facets, then grit
    let r =
      1 +
      (fbm3(p.x * 1.3 + off, p.y * 1.3, p.z * 1.3, 3) - 0.5) * 0.9 +
      (fbm3(p.x * 4.2 + off, p.y * 4.2, p.z * 4.2, 3) - 0.5) * 0.28 +
      (noise3(p.x * 17 + off, p.y * 17, p.z * 17) - 0.5) * 0.05;
    let shade = 0.78 + fbm3(p.x * 6 + off, p.y * 6, p.z * 6, 2) * 0.4;
    for (const c of craters) {
      const d = Math.acos(THREE.MathUtils.clamp(p.dot(c.v), -1, 1)) / c.r;
      if (d < 1.25) {
        const bowl = d < 1 ? 1 - d * d : 0;
        const rim = Math.exp(-Math.pow((d - 1) / 0.14, 2));
        r += -c.depth * bowl + c.depth * 0.35 * rim;
        shade *= 1 - bowl * 0.3 + rim * 0.12;
      }
    }
    pos.setXYZ(i, p.x * r * sx, p.y * r * sy, p.z * r * sz);
    // warm grey with a little variation; craters darker, rims paler
    colors[i * 3] = 0.44 * shade;
    colors[i * 3 + 1] = 0.40 * shade;
    colors[i * 3 + 2] = 0.37 * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** four rock shapes, built once and shared by every field */
export function getRockGeometries(): THREE.BufferGeometry[] {
  if (!rockGeometries) rockGeometries = [101, 202, 303, 404].map(buildRock);
  return rockGeometries;
}

let rockMaterial: THREE.MeshStandardMaterial | null = null;
export function getRockMaterial(): THREE.MeshStandardMaterial {
  if (!rockMaterial) {
    rockMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.04,
      envMapIntensity: 0.55,
    });
  }
  return rockMaterial;
}

export interface RockSpec {
  pos: [number, number, number];
  scale: number;
  rot: [number, number, number];
}

/**
 * A static field of rocks, drawn as four instanced meshes (one per shape).
 * `rocks` gives each rock's place, size and tumble.
 */
export function RockField({ rocks }: { rocks: RockSpec[] }) {
  const geos = getRockGeometries();
  const mat = getRockMaterial();
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const groups = useMemo(() => {
    const out: RockSpec[][] = geos.map(() => []);
    rocks.forEach((r, i) => out[i % geos.length].push(r));
    return out;
  }, [rocks, geos]);

  return (
    <>
      {groups.map((list, g) => (
        <instancedMesh
          key={g}
          ref={(el) => {
            refs.current[g] = el;
            if (!el) return;
            const dummy = new THREE.Object3D();
            list.forEach((r, i) => {
              dummy.position.set(...r.pos);
              dummy.rotation.set(...r.rot);
              dummy.scale.setScalar(r.scale);
              dummy.updateMatrix();
              el.setMatrixAt(i, dummy.matrix);
            });
            el.instanceMatrix.needsUpdate = true;
            el.computeBoundingSphere();
          }}
          args={[geos[g], mat, list.length]}
        />
      ))}
    </>
  );
}
