'use client';

import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * Procedural planet spheres — a city world (an ecumenopolis) and
 * a lava world. Fully shader-generated: resolution-independent detail
 * with fwidth-based anti-aliasing, a world-space sun for the day/night
 * terminator, and HDR emissive cores tuned to the PostFX bloom threshold
 * (~0.82). No scene lights touch these materials, and no fog code is included,
 * so they behave like the old `noFog` background models.
 */

// ---------------------------------------------------------------------------
// shared GLSL
// ---------------------------------------------------------------------------

export const NOISE_GLSL = /* glsl */ `
  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
  }

  // 3D gradient noise, output ~[0, 1]
  float gnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return 0.5 + 1.1 * mix(
      mix(mix(dot(hash3(i) - 0.5, f),
              dot(hash3(i + vec3(1., 0., 0.)) - 0.5, f - vec3(1., 0., 0.)), u.x),
          mix(dot(hash3(i + vec3(0., 1., 0.)) - 0.5, f - vec3(0., 1., 0.)),
              dot(hash3(i + vec3(1., 1., 0.)) - 0.5, f - vec3(1., 1., 0.)), u.x), u.y),
      mix(mix(dot(hash3(i + vec3(0., 0., 1.)) - 0.5, f - vec3(0., 0., 1.)),
              dot(hash3(i + vec3(1., 0., 1.)) - 0.5, f - vec3(1., 0., 1.)), u.x),
          mix(dot(hash3(i + vec3(0., 1., 1.)) - 0.5, f - vec3(0., 1., 1.)),
              dot(hash3(i + vec3(1., 1., 1.)) - 0.5, f - vec3(1., 1., 1.)), u.x), u.y), u.z);
  }

  float fbm(vec3 p) {
    float v = 0.0, a = 0.5, s = 0.0;
    for (int i = 0; i < 5; i++) {
      v += a * gnoise(p);
      s += a;
      p = p * 2.03 + vec3(11.5, 7.3, 5.1);
      a *= 0.55;
    }
    return v / s;
  }

  float fbm4(vec3 p) {
    float v = 0.0, a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) {
      v += a * gnoise(p);
      s += a;
      p = p * 2.03 + vec3(11.5, 7.3, 5.1);
      a *= 0.55;
    }
    return v / s;
  }

  // ridged multifractal, sharp crests near 1 — lava channels / crack networks
  float ridged(vec3 p) {
    float v = 0.0, a = 0.55, s = 0.0;
    for (int i = 0; i < 5; i++) {
      float g = 1.0 - abs(2.0 * gnoise(p) - 1.0);
      v += a * g * g;
      s += a;
      p = p * 2.1 + vec3(3.7, 9.1, 1.3);
      a *= 0.55;
    }
    return v / s;
  }

  // 3D voronoi: distance to nearest / second-nearest feature, feature point, cell id
  void voronoi(vec3 p, out float f1, out float f2, out vec3 fp, out float id) {
    vec3 ip = floor(p);
    vec3 fr = fract(p);
    f1 = 8.0;
    f2 = 8.0;
    fp = vec3(0.0);
    id = 0.0;
    for (int x = -1; x <= 1; x++)
      for (int y = -1; y <= 1; y++)
        for (int z = -1; z <= 1; z++) {
          vec3 g = vec3(float(x), float(y), float(z));
          vec3 o = hash3(ip + g);
          vec3 r = g + o - fr;
          float d = dot(r, r);
          if (d < f1) {
            f2 = f1;
            f1 = d;
            fp = ip + g + o;
            id = o.x;
          } else if (d < f2) {
            f2 = d;
          }
        }
    f1 = sqrt(f1);
    f2 = sqrt(f2);
  }
`;

export const PLANET_VERT = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vObj = position;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// ---------------------------------------------------------------------------
// City world — the ecumenopolis. The whole surface is built over, so the night
// side is a fabric of light rather than a diagram: megacity basins that glow,
// a patchwork of districts each lit differently, streets between them, hot
// downtown cores joined by great avenues, and street-level sparkle on top.
// Over that sit the grand districts: concentric rings of light with spokes,
// joined hub to hub by transit lines.
// The day side is grey-and-tan metal with relief (towers catch the sun,
// canyons fall dark), thin cirrus, and a deep hazy atmosphere. Clouds over the
// night side are lit from beneath by the city.
// ---------------------------------------------------------------------------

/**
 * The great hubs of Meridian's grand districts: scattered over the whole
 * globe, each drawn by the shader as concentric rings of light with spokes,
 * and joined to its neighbours by straight transit lines. Their layout is
 * fixed (seeded), worked out once here and handed to the shader as uniforms.
 * (The many small hubs between them are placed by the shader itself.)
 */
const CITY_HUBS = 26;
const CITY_LINKS = 40;

function buildCityGrid(): Record<string, THREE.IUniform> {
  let seed = 20261113;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // [how many, smallest radius, largest radius] — radii are angles in radians
  const tiers: [number, number, number][] = [
    [8, 0.24, 0.33],
    [18, 0.12, 0.19],
  ];
  const centres: THREE.Vector3[] = [];
  const radii: number[] = [];
  for (const [count, rMin, rMax] of tiers) {
    for (let k = 0; k < count; k++) {
      const r = rMin + rnd() * (rMax - rMin);
      const c = new THREE.Vector3();
      // neighbours may interlock a little, never stack
      for (let attempt = 0; attempt < 400; attempt++) {
        const y = rnd() * 2 - 1;
        const a = rnd() * Math.PI * 2;
        const s = Math.sqrt(1 - y * y);
        c.set(Math.cos(a) * s, y, Math.sin(a) * s);
        if (centres.every((o, j) => o.angleTo(c) > 0.82 * (r + radii[j]) + 0.015)) break;
      }
      centres.push(c);
      radii.push(r);
    }
  }

  // each hub is joined to its two nearest neighbours
  const pairs = new Set<string>();
  centres.forEach((c, i) => {
    centres
      .map((o, j) => ({ j, d: o.angleTo(c) }))
      .filter((o) => o.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2)
      .forEach((o) => pairs.add(i < o.j ? `${i}:${o.j}` : `${o.j}:${i}`));
  });
  // a line is the great circle through both hubs, kept to the stretch between
  // them: xyz = that circle's pole, w = cosine of half the stretch
  const linkN: THREE.Vector4[] = [];
  const linkM: THREE.Vector3[] = [];
  for (const key of [...pairs].slice(0, CITY_LINKS)) {
    const [i, j] = key.split(':').map(Number);
    const pole = new THREE.Vector3().crossVectors(centres[i], centres[j]).normalize();
    linkN.push(new THREE.Vector4(pole.x, pole.y, pole.z, Math.cos(centres[i].angleTo(centres[j]) / 2)));
    linkM.push(new THREE.Vector3().addVectors(centres[i], centres[j]).normalize());
  }
  while (linkN.length < CITY_LINKS) {
    linkN.push(new THREE.Vector4(0, 1, 0, 2)); // w = 2: never drawn
    linkM.push(new THREE.Vector3(0, 1, 0));
  }

  return {
    uHubs: { value: centres.map((c, i) => new THREE.Vector4(c.x, c.y, c.z, radii[i])) },
    uLinkN: { value: linkN },
    uLinkM: { value: linkM },
  };
}

const CITY_UNIFORMS = buildCityGrid();

const CITY_FRAG = /* glsl */ `
  #define HUBS ${CITY_HUBS}
  #define LINKS ${CITY_LINKS}
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform vec4 uHubs[HUBS];   // xyz = hub direction, w = outer ring radius
  uniform vec4 uLinkN[LINKS]; // xyz = pole of the line's great circle, w = cos(half its length)
  uniform vec3 uLinkM[LINKS]; // the line's midpoint
  varying vec3 vObj;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  ${NOISE_GLSL}

  // a glowing line of half-width w around d = 0 that never gets thinner than a
  // pixel: it widens and dims instead, so distant networks melt into a soft
  // glow rather than shimmering
  float softLine(float d, float w, float px) {
    float ww = max(w, px * 1.25);
    return exp(-(d * d) / (ww * ww)) * (w / ww);
  }

  // the same, for the grand rings: these also stop growing past a couple of
  // pixels, so they stay fine lines when the ship flies in close
  float ringLine(float d, float w, float px) {
    float ww = max(min(w, px * 2.1), px * 1.25);
    return exp(-(d * d) / (ww * ww)) * min(1.0, w / ww);
  }

  // One district hub, seen from offset e = n - c: an outer ring, a beaded
  // middle ring, an inner ring round a bright core, spokes between inner and
  // outer, and on the big ones a fine ring inside the rim and a broken halo
  // ring outside it. "inside" comes back as how deep in the district we are.
  float hubRings(vec3 e, vec3 c, float r, float px, out float inside) {
    float d2 = dot(e, e);
    float d = sqrt(d2);
    float sd = fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float sd2 = fract(sd * 17.31 + 0.37);
    float big = smoothstep(0.10, 0.22, r);
    // small hubs are drawn with finer lines
    float ws = mix(0.55, 1.0, smoothstep(0.03, 0.12, r));

    // angle round the hub, 0..1
    vec3 t1 = normalize(cross(c, abs(c.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(c, t1);
    float th = atan(dot(e, t2), dot(e, t1)) / 6.2831853 + 0.5;

    float rIn = r * (0.24 + 0.10 * sd);
    float rMid = r * (0.56 + 0.14 * sd2);

    float g = ringLine(d - r, 0.0034 * ws, px);
    g += ringLine(d - rIn, 0.0028 * ws, px) * 0.9;
    // the middle ring is a string of beads, until they are too small to tell apart
    float nb = max(floor(rMid * 260.0), 8.0);
    float beads = smoothstep(0.16, 0.26, abs(fract(th * nb) - 0.5));
    beads = mix(0.6, 0.25 + 0.75 * beads, smoothstep(2.0, 5.0, 6.2831853 * rMid / (nb * px)));
    g += ringLine(d - rMid, 0.0022 * ws, px) * beads;
    g += ringLine(d - r * 0.82, 0.0016, px) * 0.6 * big;
    // halo ring in three arcs
    float f = fract(th * 3.0 + sd);
    g += ringLine(d - r * 1.12, 0.0020, px) * 0.7 * big
       * smoothstep(0.30, 0.34, f) * (1.0 - smoothstep(0.94, 0.98, f));

    // spokes
    float ns = floor(mix(4.0, 9.0, sd2) + big * 4.0);
    float sa = (fract(th * ns + sd) - 0.5) / ns * 6.2831853;
    g += ringLine(d * sin(sa), 0.0020 * ws, px) * 0.75
       * smoothstep(rIn * 0.96, rIn * 1.04, d) * (1.0 - smoothstep(r * 0.98, r * 1.02, d));

    // the core
    float cw = max(r * 0.075, px * 1.6);
    g += exp(-d2 / (cw * cw)) * (r * 0.075 / cw) * 1.4;

    inside = 1.0 - smoothstep(r * 0.25, r * 1.05, d);
    return g * (0.8 + 0.2 * sd);
  }

  // a transit line: the great circle with pole "pole", kept to the stretch
  // within cos(half-length) = ch of its midpoint "mid"
  float transit(vec3 n, vec3 pole, vec3 mid, float ch, float px) {
    float m = dot(n, mid);
    return ringLine(dot(n, pole), 0.0018, px) * 0.65 * smoothstep(ch, ch + (1.0 - ch) * 0.12, m);
  }

  // The grand districts, in two tiers. The great hubs have fixed places (the
  // uniforms) and are joined by long transit lines. Between them the globe is
  // seeded with small hubs — a jittered grid, so there are always a few in
  // view however close the ship flies — each joined to its nearest neighbour.
  float grandRings(vec3 n, float px, out float plaza) {
    float acc = 0.0;
    float ins;
    plaza = 0.0;
    for (int i = 0; i < HUBS; i++) {
      vec3 c = uHubs[i].xyz;
      float r = uHubs[i].w;
      vec3 e = n - c;
      float d2 = dot(e, e);
      if (d2 > r * r * 1.44 || d2 < 1e-10) continue;
      acc += hubRings(e, c, r, px, ins);
      plaza = max(plaza, ins);
    }
    for (int i = 0; i < LINKS; i++) {
      if (dot(n, uLinkM[i]) < uLinkN[i].w) continue;
      acc += transit(n, uLinkN[i].xyz, uLinkM[i], uLinkN[i].w, px);
    }

    // small hubs: one candidate per grid cell, kept if it sits in the thin
    // shell at the surface (so the scatter is even over the whole globe)
    const float F = 5.0;
    vec3 p = n * F;
    vec3 ip = floor(p);
    float n1 = 9.0, n2 = 9.0;
    vec3 c1 = vec3(0.0), c2 = vec3(0.0);
    for (int x = -1; x <= 1; x++)
      for (int y = -1; y <= 1; y++)
        for (int z = -1; z <= 1; z++) {
          vec3 cell = ip + vec3(float(x), float(y), float(z));
          vec3 o = hash3(cell + 91.7);
          vec3 fp = cell + 0.15 + 0.7 * o;
          float len = length(fp);
          if (abs(len - F) > 0.5 || o.x + o.z > 1.25) continue;
          vec3 c = fp / len;
          vec3 e = n - c;
          float d2 = dot(e, e);
          if (d2 < n1) { n2 = n1; c2 = c1; n1 = d2; c1 = c; }
          else if (d2 < n2) { n2 = d2; c2 = c; }
          float r = 0.034 + 0.044 * o.y;
          if (d2 > r * r * 1.44 || d2 < 1e-10) continue;
          acc += hubRings(e, c, r, px, ins) * 0.9;
          plaza = max(plaza, ins * 0.7);
        }
    // a line from the nearest small hub to the next nearest
    float cc = dot(c1, c2);
    if (n2 < 8.0 && cc > 0.90 && cc < 0.9995) {
      acc += transit(n, normalize(cross(c1, c2)), normalize(c1 + c2), sqrt(0.5 + 0.5 * cc), px) * 0.8;
    }
    return min(acc, 1.6);
  }

  void main() {
    vec3 n = normalize(vObj);          // pattern space — rotates with the planet
    vec3 wn = normalize(vWorldNormal); // lighting space — sun stays put
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float R = length(vObj);

    // organic warp, so nothing ever runs straight
    vec3 w = n + 0.045 * sin(n.yzx * 7.0 + vec3(1.7, 4.1, 2.9))
               + 0.018 * sin(n.zxy * 19.0 + vec3(5.2, 0.3, 3.8));
    // pattern-space units covered by one pixel
    float px = length(fwidth(w));

    // ---- how built-up: megacity basins with quieter belts between them
    float sprawl = fbm(w * 2.4 + 13.7);
    float urban = smoothstep(0.30, 0.66, sprawl);
    float tone = fbm4(w * 5.0 + 41.2);

    // ---- metro cores: the brightest downtowns (cell centres only — no cell walls)
    float a1, a2, aid; vec3 afp;
    voronoi(w * 5.0, a1, a2, afp, aid);
    float pxA = px * 5.0;
    float downtown = exp(-a1 * a1 * 16.0) * (0.35 + 0.65 * aid);
    float coreHot = exp(-a1 * a1 * 260.0) * (0.4 + 0.6 * aid);
    // a few ring boulevards around each core, in broken arcs
    float ringFreq = 26.0 + aid * 18.0;
    float ring = softLine(fract(a1 * ringFreq) - 0.5, 0.07, pxA * ringFreq)
               * exp(-a1 * 6.0) * smoothstep(0.03, 0.10, a1)
               * smoothstep(0.50, 0.66, gnoise(w * 22.0 + aid * 9.0));

    // ---- the web: arterial routes as ridges of warped noise, so they branch
    // and wander like real roads instead of closing into cells
    vec3 q = w + 0.06 * (vec3(fbm4(w * 6.0 + 1.3), fbm4(w * 6.0 + 7.1), fbm4(w * 6.0 + 3.7)) - 0.5);
    // (a route is a contour of smooth noise: a thin wandering line, broken into
    // stretches by a second field so it never closes into loops)
    // (dividing by the field's own slope turns "how far from the contour" into
    // a true distance, so a route keeps one width instead of pooling into blots)
    float wa = gnoise(q * 9.0);
    float wb = gnoise(q * 24.0 + 5.0);
    float web1 = softLine((wa - 0.5) * px / max(fwidth(wa), 1e-5), 0.0016, px)
               * smoothstep(0.40, 0.56, gnoise(q * 3.1 + 20.0));
    float web2 = softLine((wb - 0.5) * px / max(fwidth(wb), 1e-5), 0.0010, px)
               * smoothstep(0.44, 0.60, gnoise(q * 7.3 + 31.0));

    // ---- neighbourhoods: clumps of light with a long bright tail
    float clump = fbm(w * 26.0 + 3.0);
    float hood = pow(smoothstep(0.36, 0.80, clump), 2.8);

    // ---- city blocks: a fine mosaic, every block lit and painted differently
    float b1, b2, bid; vec3 bfp;
    voronoi(q * 58.0 + 7.0, b1, b2, bfp, bid);
    float resB = smoothstep(0.55, 0.16, px * 58.0);
    float blockV = mix(0.5, bid, resB);
    float blockLum = mix(0.34, bid * bid, resB);
    // one point of light at the heart of most blocks: the dotted look of a
    // city seen from orbit
    float pt = exp(-b1 * b1 * 38.0) * step(0.35, bid) * resB;

    // ---- street-level sparkle; settles to its average once unresolvable
    float g1 = gnoise(w * 150.0);
    float g2 = gnoise(w * 390.0 + 17.0);
    float res1 = smoothstep(1.2, 0.35, px * 150.0);
    float s1 = mix(0.10, smoothstep(0.60, 0.88, g1), res1);
    float s2 = mix(0.08, smoothstep(0.64, 0.92, g2), smoothstep(1.2, 0.35, px * 390.0));
    float sparkle = s1 * 0.75 + s2 * 0.65;

    // everything is points and threads of light on a dark ground — nothing
    // smooth, so the night side never washes out into a glow
    float fabric = urban * (0.15 + 0.85 * hood)
                 * (pt * (0.3 + 0.7 * bid) * 1.4 + blockLum * sparkle * 1.6);
    // too far to resolve the blocks: the neighbourhoods stand in for them
    fabric += urban * hood * 0.45 * (1.0 - resB);
    float roads = (0.30 + 0.70 * urban) * (web1 * 0.9 + web2 * 0.5) * (0.5 + 0.9 * s1);
    float metro = downtown * (sparkle * 1.3 + pt * 0.9) * (0.3 + 0.7 * urban)
                + coreHot * 1.1 + ring * 0.30 * urban;

    // ---- the grand districts: concentric rings of light, spokes, transit lines.
    // Drawn on the unwarped sphere so the circles stay true.
    float plaza;
    float grand = grandRings(n, px, plaza);
    // the city burns a little brighter inside a district
    fabric *= 1.0 + 0.7 * plaza;
    float lights = fabric + roads + metro + grand * 0.85;

    vec3 lightCol = mix(vec3(1.0, 0.50, 0.16), vec3(1.0, 0.80, 0.46), tone);
    // the odd district burns cool white-blue
    lightCol = mix(lightCol, vec3(0.62, 0.80, 1.0), smoothstep(0.74, 0.82, gnoise(w * 17.0 + 60.0)) * 0.75);
    lightCol = mix(lightCol, vec3(1.0, 0.94, 0.80), clamp(coreHot * 1.2 + downtown * 0.3, 0.0, 1.0));
    // the rings are sodium orange
    lightCol = mix(lightCol, vec3(1.0, 0.40, 0.10), smoothstep(0.0, 0.22, grand) * 0.92);

    // ---- relief: towers rise at the cores, the arterial routes are canyons
    float mottle = fbm(w * 9.0 + 2.0);
    float h = mottle * 0.22 + clump * 0.20 + downtown * 0.30 - web1 * 0.14
            + blockV * 0.05 + g1 * 0.06 * res1 + plaza * 0.06;
    vec3 dpx = dFdx(vWorldPos);
    vec3 dpy = dFdy(vWorldPos);
    vec3 r1 = cross(dpy, wn);
    vec3 r2 = cross(wn, dpx);
    float det = dot(dpx, r1);
    vec3 bn = normalize(abs(det) * wn - sign(det) * (dFdx(h) * r1 + dFdy(h) * r2) * (R * 0.04));

    // ---- the built surface by day: steel and tan, mottled district by district
    vec3 albedo = mix(vec3(0.30, 0.32, 0.36), vec3(0.36, 0.32, 0.28), smoothstep(0.40, 0.72, tone));
    albedo *= 0.74 + 0.36 * mottle;
    albedo *= 0.84 + 0.28 * clump;
    albedo *= 0.66 + 0.68 * blockV;
    albedo *= 0.90 + 0.20 * mix(0.5, g1, res1);
    albedo *= 1.0 - 0.50 * web1 - 0.28 * web2;
    albedo = mix(albedo, albedo * 1.5, ring * 0.8);
    // by day the ring boulevards read as paler metal
    albedo = mix(albedo, albedo * 1.6 + 0.03, clamp(grand, 0.0, 1.0) * 0.7);
    albedo = mix(albedo, vec3(0.56, 0.57, 0.60), downtown * 0.55);
    albedo *= 0.70 + 0.30 * urban;

    // ---- light
    float ndl = dot(wn, uSunDir);
    float dayL = clamp(ndl, 0.0, 1.0);
    float day = smoothstep(-0.05, 0.28, ndl);
    float night = 1.0 - smoothstep(-0.14, 0.20, ndl);
    vec3 sunCol = mix(vec3(1.0, 0.60, 0.36), vec3(1.0, 0.97, 0.92), smoothstep(0.0, 0.22, ndl));
    // relief shading, with nothing leaking past the terminator
    float diff = clamp(dot(bn, uSunDir), 0.0, 1.0) * smoothstep(0.0, 0.16, ndl);
    vec3 col = albedo * (0.010 + diff * sunCol * 1.5);
    // glass and metal catching the sun
    vec3 hv = normalize(uSunDir + viewDir);
    col += sunCol * pow(max(dot(bn, hv), 0.0), 48.0) * (0.25 + 0.75 * s2) * 0.40 * day;
    // a scatter of window glints across the sunlit city
    col += sunCol * smoothstep(0.80, 0.96, bid) * resB * dayL * 0.22 * (0.4 + 0.6 * urban);

    // ---- thin high cirrus, stretched along the latitudes
    vec3 cp = vec3(n.x * 2.6, n.y * 7.5, n.z * 2.6) + vec3(uTime * 0.003, 0.0, uTime * 0.002);
    float cl = smoothstep(0.66, 0.90, fbm(cp + (tone - 0.5) * 0.8)) * 0.7;
    col *= 1.0 - cl * 0.30 * day;
    col = mix(col, vec3(0.86, 0.88, 0.93) * dayL * sunCol * 1.1, cl);

    // ---- night: the lights, a faint floor of scattered glow between them,
    // and cloud lit from beneath where it covers the city
    vec3 emit = lightCol * (lights * 1.8 + urban * 0.006);
    vec3 underlit = lightCol * urban * (0.02 + 0.10 * downtown + 0.04 * hood);
    col += mix(emit, underlit, cl) * night;
    // the grand rings stay lit round the clock, dimmer against the daylight
    col += vec3(1.0, 0.40, 0.10) * grand * 0.80 * (1.0 - night) * (1.0 - cl);

    // ---- atmosphere against the disc
    float fres = pow(1.0 - clamp(dot(viewDir, wn), 0.0, 1.0), 3.4);
    // daylight haze thickening toward the limb
    col = mix(col, vec3(0.46, 0.62, 1.0) * (0.20 + 0.85 * dayL), fres * 0.55 * day);
    // sunset band along the terminator
    col += vec3(1.0, 0.45, 0.20) * smoothstep(0.26, 0.0, abs(ndl)) * (0.03 + 0.30 * fres);
    // city light scattered into the haze on the dark limb
    col += vec3(1.0, 0.60, 0.28) * fres * night * 0.12;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Lava world — domain-warped molten marbling: broad lava seas, ridged rivers and
// hairline vein cracks glowing through a near-black basalt crust.
// ---------------------------------------------------------------------------

const LAVA_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform float uTime;
  varying vec3 vObj;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  ${NOISE_GLSL}

  void main() {
    vec3 n = normalize(vObj);
    vec3 wn = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float t = uTime * 0.03;

    // domain warp — the marbled churn that makes lava read as fluid
    vec3 q = vec3(
      fbm(n * 3.0 + vec3(0.0, 3.1, 1.7) + t * 0.15),
      fbm(n * 3.0 + vec3(4.2, 0.6, 7.9)),
      fbm(n * 3.0 + vec3(8.8, 5.4, 2.3)));
    vec3 wp1 = n * 3.4 + (q - 0.5) * 1.7;

    float field = fbm(wp1);                              // broad molten basins
    float seas = smoothstep(0.58, 0.86, field);
    float rivers = smoothstep(0.76, 0.95, ridged(n * 7.0 + (q - 0.5) * 2.2));
    float veins = smoothstep(0.82, 0.97, ridged(n * 19.0 + (q - 0.5) * 1.2));

    // churn contrast carves cooled black islands into the molten seas
    float churn = smoothstep(0.28, 0.85, fbm4(wp1 * 2.6 + vec3(t * 0.5)));
    float heat = seas * (0.15 + 0.90 * churn);
    heat = max(heat, rivers * (0.45 + 0.50 * churn));
    heat = max(heat, veins * 0.65);
    heat *= 0.90 + 0.10 * sin(uTime * 0.7 + field * 24.0); // slow shimmer

    // basalt crust, lit faintly by its own lava fields
    float rock = fbm(n * 6.0 + 3.3);
    float microR = fbm4(n * 42.0);
    vec3 crust = mix(vec3(0.012, 0.006, 0.005), vec3(0.072, 0.035, 0.022), rock);
    crust *= 0.78 + microR * 0.44;
    crust += vec3(0.30, 0.05, 0.01) * smoothstep(0.2, 0.9, field) * 0.25;

    // heat ramp: deep ember → red-orange → rare white-gold cores (HDR feeds the bloom)
    vec3 lava = mix(vec3(0.22, 0.008, 0.0), vec3(1.2, 0.16, 0.012), smoothstep(0.05, 0.60, heat));
    lava = mix(lava, vec3(3.0, 1.15, 0.20), smoothstep(0.72, 0.98, heat));

    float dayL = clamp(dot(wn, uSunDir), 0.0, 1.0);
    vec3 col = crust * (0.10 + dayL * vec3(1.0, 0.85, 0.70) * 0.9);
    col = mix(col, lava, smoothstep(0.10, 0.55, heat));

    // smouldering limb
    float fres = pow(1.0 - clamp(dot(viewDir, wn), 0.0, 1.0), 2.6);
    col += vec3(1.2, 0.30, 0.06) * fres * (0.28 + 0.20 * dayL);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// atmosphere halo shell — additive rim glow shaped by the ray's impact
// parameter against the planet sphere, brighter on the sun side
// ---------------------------------------------------------------------------

const ATMO_VERT = /* glsl */ `
  varying vec3 vViewPos;
  varying vec3 vCenter;
  varying vec3 vWorldNormal;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    vCenter = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const ATMO_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform float uPlanetR;
  uniform float uShellR;
  uniform float uIntensity;
  varying vec3 vViewPos;
  varying vec3 vCenter;
  varying vec3 vWorldNormal;
  void main() {
    // perpendicular distance from the view ray to the planet centre
    float b = length(cross(normalize(vViewPos), vCenter));
    float x = clamp((b - uPlanetR) / (uShellR - uPlanetR), 0.0, 1.0);
    float outer = exp(-x * 4.5) * (1.0 - x);      // halo past the limb
    float ring = smoothstep(uPlanetR * 0.82, uPlanetR, b); // haze rising to the limb
    float dayFac = 0.45 + 0.55 * clamp(dot(normalize(vWorldNormal), uSunDir) * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(uColor * uIntensity * dayFac, ring * outer);
  }
`;

export function Atmosphere({
  planetRadius,
  shellScale,
  color,
  intensity,
  sunDirection,
}: {
  planetRadius: number;
  shellScale: number;
  color: string;
  intensity: number;
  sunDirection: THREE.Vector3;
}) {
  const args = useMemo(
    () =>
      [
        {
          vertexShader: ATMO_VERT,
          fragmentShader: ATMO_FRAG,
          uniforms: {
            uColor: { value: new THREE.Color(color) },
            uSunDir: { value: sunDirection },
            uPlanetR: { value: planetRadius },
            uShellR: { value: planetRadius * shellScale },
            uIntensity: { value: intensity },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        },
      ] as [THREE.ShaderMaterialParameters],
    [planetRadius, shellScale, color, intensity, sunDirection],
  );

  return (
    <mesh>
      <sphereGeometry args={[planetRadius * shellScale, 96, 64]} />
      <shaderMaterial args={args} />
    </mesh>
  );
}

export interface PlanetProps {
  radius?: number;
  /** world-space direction TOWARD the sun (normalized internally) */
  sunDirection?: [number, number, number];
}

export function usePlanetArgs(
  fragmentShader: string,
  sunDirection: [number, number, number],
  /** further uniforms; pass a module-level constant so the material is not rebuilt */
  extraUniforms?: Record<string, THREE.IUniform>,
): [[THREE.ShaderMaterialParameters], THREE.Vector3, RefObject<THREE.ShaderMaterial | null>] {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const sun = useMemo(
    () => new THREE.Vector3(...sunDirection).normalize(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sunDirection[0], sunDirection[1], sunDirection[2]],
  );
  const args = useMemo(
    () =>
      [
        {
          vertexShader: PLANET_VERT,
          fragmentShader,
          uniforms: {
            uSunDir: { value: sun },
            uTime: { value: 0 },
            ...extraUniforms,
          },
        },
      ] as [THREE.ShaderMaterialParameters],
    [fragmentShader, sun, extraUniforms],
  );
  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return [args, sun, matRef];
}

/** city-planet: a fabric of city light on the night side, relief-lit metal by day, deep haze */
export function CityPlanet({ radius = 48, sunDirection = [-0.8, 0.3, 0.25] }: PlanetProps) {
  const [args, sun, matRef] = usePlanetArgs(CITY_FRAG, sunDirection, CITY_UNIFORMS);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 160, 112]} />
        <shaderMaterial ref={matRef} args={args} />
      </mesh>
      <Atmosphere
        planetRadius={radius}
        shellScale={1.09}
        color="#6FA8FF"
        intensity={0.65}
        sunDirection={sun}
      />
    </group>
  );
}

/** lava world: molten marbling under a black basalt crust, ember halo */
export function LavaPlanet({ radius = 75, sunDirection = [0.35, 0.6, 0.55] }: PlanetProps) {
  const [args, sun, matRef] = usePlanetArgs(LAVA_FRAG, sunDirection);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 160, 112]} />
        <shaderMaterial ref={matRef} args={args} />
      </mesh>
      <Atmosphere
        planetRadius={radius}
        shellScale={1.07}
        color="#FF5A22"
        intensity={0.9}
        sunDirection={sun}
      />
    </group>
  );
}
