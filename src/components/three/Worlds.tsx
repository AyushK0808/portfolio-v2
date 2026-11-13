'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Atmosphere, NOISE_GLSL, PLANET_VERT, PlanetProps, usePlanetArgs } from './Planets';

/**
 * More procedural worlds, on the same base as the city and lava planets in
 * Planets.tsx: fully shader-generated (no textures to download), lit by a
 * world-space sun so each has a day side, a terminator and a night side.
 *
 *   OceanPlanet — temperate world: seas with sun glint, continents, ice caps,
 *                 drifting cloud decks, town lights on the night side
 *   GasGiant    — banded giant with storms, plus a ring system that carries
 *                 the planet's shadow
 *   IcePlanet   — fractured ice crust with aurora curtains near the poles
 *   Moon        — airless, cratered rock
 */

// ---------------------------------------------------------------------------
// Ocean world
// ---------------------------------------------------------------------------

const OCEAN_FRAG = /* glsl */ `
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

    // ---- terrain: continents, then coastline and relief detail
    float h = fbm(n * 2.1 + 3.1) * 0.66 + fbm(n * 6.5 + 1.7) * 0.24 + fbm4(n * 19.0) * 0.10;
    float sea = 0.515;
    float land = smoothstep(sea, sea + 0.010, h);
    float elev = clamp((h - sea) / (1.0 - sea), 0.0, 1.0);
    float lat = abs(n.y);

    // water: deep basins to pale shelves along the coasts
    vec3 water = mix(vec3(0.004, 0.022, 0.075), vec3(0.012, 0.105, 0.185), smoothstep(sea - 0.16, sea, h));

    // land: forest to steppe by a moisture field, rock with height, snow on peaks
    float moisture = fbm4(n * 7.0 + 9.3);
    vec3 lowland = mix(vec3(0.150, 0.125, 0.070), vec3(0.035, 0.095, 0.035), smoothstep(0.35, 0.65, moisture));
    lowland = mix(lowland, vec3(0.200, 0.155, 0.090), smoothstep(0.30, 0.05, lat) * (1.0 - moisture) * 0.8);
    vec3 ground = mix(lowland, vec3(0.170, 0.150, 0.130), smoothstep(0.22, 0.55, elev));
    ground = mix(ground, vec3(0.80, 0.83, 0.87), smoothstep(0.60, 0.78, elev));
    ground *= 0.82 + fbm4(n * 60.0) * 0.36;

    float cap = smoothstep(0.80, 0.90, lat + (fbm4(n * 9.0) - 0.5) * 0.14);
    vec3 surf = mix(water, ground, land);
    surf = mix(surf, vec3(0.84, 0.89, 0.94), cap);

    // ---- light
    float ndl = dot(wn, uSunDir);
    float dayL = clamp(ndl, 0.0, 1.0);
    float day = smoothstep(-0.08, 0.25, ndl);
    float night = 1.0 - smoothstep(-0.20, 0.05, ndl);
    // warm light raking across the terminator: sunrise
    vec3 sunCol = mix(vec3(1.0, 0.52, 0.26), vec3(1.0, 0.96, 0.90), smoothstep(0.0, 0.35, ndl));
    vec3 col = surf * (0.018 + dayL * sunCol * 1.35);

    // sun glint on open water
    vec3 hv = normalize(uSunDir + viewDir);
    float glint = pow(max(dot(wn, hv), 0.0), 160.0) * (1.0 - land) * (1.0 - cap);
    col += sunCol * glint * 0.55 * day;

    // ---- clouds: two drifting decks, the upper one casting a soft shadow
    vec3 cp = n * 3.0 + vec3(uTime * 0.004, 0.0, uTime * 0.0025);
    float deck = fbm(cp + (fbm4(cp * 2.2) - 0.5) * 0.9);
    float cl = smoothstep(0.57, 0.80, deck);
    float wisps = smoothstep(0.60, 0.88, fbm(n * 9.0 + vec3(0.0, uTime * 0.006, 4.0))) * 0.35;
    cl = clamp(cl + wisps * (1.0 - cl), 0.0, 1.0);
    col *= 1.0 - cl * 0.35 * day;
    vec3 cloudCol = vec3(0.80, 0.83, 0.88) * (0.02 + dayL * sunCol * 0.95);
    col = mix(col, cloudCol, cl * 0.93);

    // ---- night side: scattered town lights on land, hidden under cloud
    float f1, f2, id; vec3 fp;
    voronoi(n * 46.0, f1, f2, fp, id);
    float settled = smoothstep(0.50, 0.85, fbm(n * 5.0 + 21.0)) * land * (1.0 - cap);
    float lights = smoothstep(0.26, 0.0, f1) * step(0.5, id) * settled;
    col += vec3(1.0, 0.70, 0.34) * lights * night * (1.0 - cl) * 1.7;

    // ---- atmosphere against the disc: blue where lit, a warm band at the terminator
    float fres = pow(1.0 - clamp(dot(viewDir, wn), 0.0, 1.0), 5.0);
    col += vec3(0.20, 0.44, 0.95) * fres * (0.03 + 0.40 * day);
    col += vec3(1.0, 0.42, 0.18) * fres * smoothstep(0.32, 0.0, abs(ndl)) * 0.45;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** temperate ocean world with a blue atmosphere */
export function OceanPlanet({ radius = 60, sunDirection = [-0.7, 0.25, 0.5] }: PlanetProps) {
  const [args, sun, matRef] = usePlanetArgs(OCEAN_FRAG, sunDirection);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 160, 112]} />
        <shaderMaterial ref={matRef} args={args} />
      </mesh>
      <Atmosphere planetRadius={radius} shellScale={1.05} color="#6FA8FF" intensity={0.5} sunDirection={sun} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Gas giant + rings
// ---------------------------------------------------------------------------

const GAS_FRAG = /* glsl */ `
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
    float lat = n.y;
    float t = uTime * 0.004;

    // zonal flow: latitude bands sheared by turbulence that drifts with longitude
    vec3 flow = vec3(n.x * 2.2 + t, lat * 5.0, n.z * 2.2 - t);
    float turb = fbm(flow) - 0.5;
    float bandPhase = lat * 13.0 + turb * 2.4;
    float bands = 0.5 + 0.5 * sin(bandPhase);
    float fine = fbm(vec3(n.x * 5.0 - t * 2.0, lat * 46.0 + turb * 3.0, n.z * 5.0));
    float eddies = fbm4(vec3(n.x * 14.0, lat * 22.0, n.z * 14.0) + turb * 2.0);

    // teal-and-cream giant: pale zones, dark belts, a little rust in the belts
    vec3 zone = vec3(0.46, 0.62, 0.56);
    vec3 belt = vec3(0.045, 0.19, 0.24);
    vec3 rust = vec3(0.34, 0.20, 0.11);
    vec3 col = mix(belt, zone, smoothstep(0.25, 0.75, bands));
    col = mix(col, rust, smoothstep(0.55, 0.9, fine) * (1.0 - bands) * 0.55);
    col *= 0.80 + eddies * 0.42;

    // storms: a few bright ovals riding the belts
    float f1, f2, id; vec3 fp;
    voronoi(vec3(n.x * 2.6, lat * 5.5, n.z * 2.6), f1, f2, fp, id);
    float storm = smoothstep(0.24, 0.05, f1) * step(0.78, id);
    col = mix(col, vec3(0.70, 0.72, 0.62), storm * 0.8);

    // polar hoods
    col = mix(col, vec3(0.06, 0.16, 0.22), smoothstep(0.70, 0.95, abs(lat)));

    // light: soft terminator, limb darkening (a deep atmosphere, not a hard surface)
    float ndl = dot(wn, uSunDir);
    float dayL = smoothstep(-0.12, 0.85, ndl);
    float limb = pow(clamp(dot(viewDir, wn), 0.0, 1.0), 0.45);
    col *= (0.012 + dayL * 1.0) * (0.30 + 0.70 * limb);

    float fres = pow(1.0 - clamp(dot(viewDir, wn), 0.0, 1.0), 3.0);
    col += vec3(0.30, 0.85, 0.80) * fres * smoothstep(-0.1, 0.4, ndl) * 0.16;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const RING_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const RING_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uCenter;
  uniform float uPlanetR;
  uniform float uInner;
  uniform float uOuter;
  varying vec3 vWorldPos;
  varying vec3 vLocal;

  float hash1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
  float noise1(float x) {
    float i = floor(x); float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(hash1(i), hash1(i + 1.0), f);
  }

  void main() {
    float r = length(vLocal.xy);
    float u = (r - uInner) / (uOuter - uInner);
    if (u < 0.0 || u > 1.0) discard;

    // ringlets at three scales, plus one wide gap
    float dens = 0.55 * noise1(u * 9.0) + 0.30 * noise1(u * 41.0) + 0.15 * noise1(u * 170.0);
    dens = smoothstep(0.22, 0.80, dens);
    dens *= 1.0 - 0.9 * smoothstep(0.035, 0.0, abs(u - 0.60));
    dens *= smoothstep(0.0, 0.04, u) * smoothstep(1.0, 0.90, u);

    vec3 col = mix(vec3(0.62, 0.74, 0.70), vec3(0.88, 0.84, 0.72), noise1(u * 23.0 + 4.0));

    // the planet's shadow across the rings
    vec3 oc = vWorldPos - uCenter;
    float b = dot(oc, uSunDir);
    float disc = b * b - (dot(oc, oc) - uPlanetR * uPlanetR);
    float shadow = (b < 0.0) ? smoothstep(-uPlanetR * 2.0, uPlanetR * 6.0, disc) : 0.0;
    col *= mix(1.0, 0.04, shadow);

    gl_FragColor = vec4(col * 0.62, dens * 0.82);
  }
`;

interface GasGiantProps extends PlanetProps {
  /** world position of the planet's centre (the ring shadow needs it) */
  center: [number, number, number];
  /** ring plane tilt, radians: [about X, about Z] */
  ringTilt?: [number, number];
}

/** banded teal giant with a tilted ring system */
export function GasGiant({
  radius = 70,
  sunDirection = [-0.6, 0.35, 0.6],
  center,
  ringTilt = [0.42, 0.12],
}: GasGiantProps) {
  const [args, sun, matRef] = usePlanetArgs(GAS_FRAG, sunDirection);
  const inner = radius * 1.32;
  const outer = radius * 2.25;
  const ringArgs = useMemo(
    () =>
      [
        {
          vertexShader: RING_VERT,
          fragmentShader: RING_FRAG,
          uniforms: {
            uSunDir: { value: sun },
            uCenter: { value: new THREE.Vector3(...center) },
            uPlanetR: { value: radius },
            uInner: { value: inner },
            uOuter: { value: outer },
          },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        },
      ] as [THREE.ShaderMaterialParameters],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sun, radius, inner, outer, center[0], center[1], center[2]],
  );

  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 160, 112]} />
        <shaderMaterial ref={matRef} args={args} />
      </mesh>
      <Atmosphere planetRadius={radius} shellScale={1.035} color="#63D8CC" intensity={0.3} sunDirection={sun} />
      {/* rings lie in the planet's equatorial plane, then the whole plane is tilted */}
      <group rotation={[ringTilt[0], 0, ringTilt[1]]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[inner, outer, 192, 1]} />
          <shaderMaterial args={ringArgs} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ice world with aurora
// ---------------------------------------------------------------------------

const ICE_FRAG = /* glsl */ `
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

    // ---- crust: wind-scoured ice plains broken by long blue fractures
    float plains = fbm(n * 3.0 + 5.0);
    float drift = fbm4(n * 26.0);
    vec3 warp = vec3(fbm4(n * 4.0), fbm4(n * 4.0 + 7.7), fbm4(n * 4.0 + 3.3)) - 0.5;
    float cracks = ridged(n * 6.5 + warp * 1.6);
    float hair = ridged(n * 21.0 + warp * 0.9);
    float fracture = max(smoothstep(0.78, 0.96, cracks), smoothstep(0.86, 0.98, hair) * 0.6);

    vec3 ice = mix(vec3(0.26, 0.36, 0.48), vec3(0.62, 0.70, 0.78), plains);
    ice *= 0.86 + drift * 0.28;
    // dark open leads where the crust has parted
    ice = mix(ice, vec3(0.03, 0.10, 0.22), smoothstep(0.30, 0.16, plains) * 0.85);
    ice = mix(ice, vec3(0.06, 0.26, 0.48), fracture * 0.9);

    // ---- light: cold sun, blue glow bleeding through thin ice near the terminator
    float ndl = dot(wn, uSunDir);
    float dayL = clamp(ndl, 0.0, 1.0);
    float day = smoothstep(-0.06, 0.28, ndl);
    float night = 1.0 - smoothstep(-0.22, 0.04, ndl);
    vec3 col = ice * (0.022 + dayL * vec3(0.94, 0.97, 1.0) * 1.0);
    vec3 hv = normalize(uSunDir + viewDir);
    col += vec3(0.9, 0.96, 1.0) * pow(max(dot(wn, hv), 0.0), 40.0) * 0.5 * day * plains;
    col += vec3(0.05, 0.22, 0.42) * smoothstep(0.35, -0.05, ndl) * smoothstep(-0.3, 0.0, ndl) * 0.5;

    // ---- aurora: curtains in an oval around each pole, brightest on the night side
    float lon = atan(n.z, n.x);
    float oval = 0.74 + 0.05 * sin(lon * 2.0 + uTime * 0.05);
    float band = exp(-pow((abs(n.y) - oval) / 0.055, 2.0));
    float curtain = fbm(vec3(lon * 7.0, uTime * 0.12, n.y * 6.0));
    curtain = pow(smoothstep(0.30, 0.85, curtain), 1.5);
    float flicker = 0.75 + 0.25 * sin(uTime * 0.9 + lon * 5.0);
    vec3 aur = mix(vec3(0.10, 1.0, 0.55), vec3(0.55, 0.35, 1.0), smoothstep(0.35, 0.9, curtain));
    col += aur * band * curtain * flicker * (0.25 + 0.75 * night) * 1.9;

    // ---- thin pale atmosphere
    float fres = pow(1.0 - clamp(dot(viewDir, wn), 0.0, 1.0), 3.6);
    col += vec3(0.50, 0.80, 1.0) * fres * (0.04 + 0.28 * day);
    col += aur * fres * band * 0.6;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** fractured ice world, aurora ovals at the poles */
export function IcePlanet({ radius = 60, sunDirection = [0.6, 0.3, 0.5] }: PlanetProps) {
  const [args, sun, matRef] = usePlanetArgs(ICE_FRAG, sunDirection);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 160, 112]} />
        <shaderMaterial ref={matRef} args={args} />
      </mesh>
      <Atmosphere planetRadius={radius} shellScale={1.04} color="#9FE0FF" intensity={0.35} sunDirection={sun} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Barren moon
// ---------------------------------------------------------------------------

const MOON_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform float uTime;
  varying vec3 vObj;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  ${NOISE_GLSL}

  // one layer of craters: returns x = bowl depth (0..1), y = lit-rim highlight
  vec2 craters(vec3 p, float keep) {
    float f1, f2, id; vec3 fp;
    voronoi(p, f1, f2, fp, id);
    float r = 0.16 + id * 0.26;          // crater radius varies per cell
    float d = f1 / r;
    float on = step(keep, fract(id * 7.31));
    float bowl = (1.0 - smoothstep(0.0, 0.85, d)) * on;
    float rim = smoothstep(0.75, 0.95, d) * (1.0 - smoothstep(0.95, 1.20, d)) * on;
    return vec2(bowl, rim);
  }

  void main() {
    vec3 n = normalize(vObj);
    vec3 wn = normalize(vWorldNormal);

    // maria (dark plains) and highlands
    float maria = smoothstep(0.42, 0.62, fbm(n * 1.8 + 2.0));
    vec3 col = mix(vec3(0.050, 0.052, 0.058), vec3(0.200, 0.195, 0.190), maria);
    col *= 0.82 + fbm4(n * 30.0) * 0.36;

    vec2 big = craters(n * 5.0, 0.45);
    vec2 mid = craters(n * 13.0 + 4.0, 0.35);
    vec2 small = craters(n * 34.0 + 9.0, 0.30);
    float bowl = max(big.x, max(mid.x * 0.8, small.x * 0.6));
    float rim = max(big.y, max(mid.y * 0.8, small.y * 0.6));
    col *= 1.0 - bowl * 0.55;
    col += vec3(0.055) * rim;

    // hard light, no atmosphere: a sharp terminator and near-black night
    float ndl = dot(wn, uSunDir);
    float dayL = smoothstep(-0.02, 0.10, ndl) * clamp(ndl * 1.1 + 0.08, 0.0, 1.0);
    col *= 0.006 + dayL * 1.25;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** airless cratered moon */
export function Moon({ radius = 30, sunDirection = [0.7, 0.3, 0.4] }: PlanetProps) {
  const [args, , matRef] = usePlanetArgs(MOON_FRAG, sunDirection);
  return (
    <mesh>
      <sphereGeometry args={[radius, 128, 96]} />
      <shaderMaterial ref={matRef} args={args} />
    </mesh>
  );
}

/** slow axial spin for any world: wrap the planet in this */
export function Spin({ speed = 0.01, children }: { speed?: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * speed;
  });
  return <group ref={ref}>{children}</group>;
}
