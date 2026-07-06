'use client';

import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * Procedural planet spheres — Coruscant (ecumenopolis circuit-grid) and
 * Mustafar (lava world). Fully shader-generated: resolution-independent detail
 * with fwidth-based anti-aliasing, a world-space sun for the day/night
 * terminator, and HDR emissive cores tuned to the PostFX bloom threshold
 * (~0.82). No scene lights touch these materials, and no fog code is included,
 * so they behave like the old `noFog` background models.
 */

// ---------------------------------------------------------------------------
// shared GLSL
// ---------------------------------------------------------------------------

const NOISE_GLSL = /* glsl */ `
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

const PLANET_VERT = /* glsl */ `
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
// Coruscant — the ecumenopolis. Night side is a copper circuit-grid of city
// hubs (concentric rings + radial spokes + arterial links); the day crescent
// shows duracrete plates under blue-white cloud bands and atmosphere.
// ---------------------------------------------------------------------------

const CORUSCANT_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform float uTime;
  varying vec3 vObj;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  ${NOISE_GLSL}

  // anti-aliased glowing line: wave is |sin(phase)|-style in [0,1]; fades out
  // (instead of shimmering) once the stripe frequency exceeds pixel density
  float glowLine(float wave, float width, float phaseFw) {
    float line = 1.0 - smoothstep(width, width + max(phaseFw, 0.02) * 1.4, wave);
    return line * smoothstep(1.7, 0.5, phaseFw);
  }

  void main() {
    vec3 n = normalize(vObj);          // pattern space — rotates with the planet
    vec3 wn = normalize(vWorldNormal); // lighting space — sun stays put
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // ---- duracrete crust: continent-scale mega-blocks, plate + micro detail
    float cont = fbm(n * 2.6);
    float plate = fbm(n * 14.0);
    float micro = fbm4(n * 55.0);
    vec3 crust = mix(vec3(0.030, 0.028, 0.034), vec3(0.080, 0.066, 0.056), cont);
    crust *= 0.72 + plate * 0.50;
    crust *= 0.86 + micro * 0.28;

    // ---- city light network ------------------------------------------------
    // regional density: mega-city clusters vs dimmer industrial zones
    float density = smoothstep(0.30, 0.72, fbm(n * 2.1 + 13.7));

    // major hubs
    float f1, f2, id; vec3 fp;
    voronoi(n * 5.5, f1, f2, fp, id);
    float hubR = 0.30 + id * 0.24;
    float inHub = 1.0 - smoothstep(hubR * 0.5, hubR, f1);

    float ringFreq = 15.0 + id * 11.0;
    float rings = glowLine(abs(sin(f1 * ringFreq)), 0.20, fwidth(f1 * ringFreq)) * inHub;
    float core = exp(-f1 * f1 * 240.0) * 2.2;

    // radial spokes out of each hub
    vec3 hn = normalize(fp);
    vec3 t1 = normalize(cross(hn, vec3(0.31, 0.85, 0.42)));
    vec3 t2 = cross(hn, t1);
    vec3 dv = n * 5.5 - fp;
    float ang = atan(dot(dv, t2), dot(dv, t1));
    float spokeN = floor(5.0 + id * 6.0);
    float spokes = glowLine(abs(sin(ang * spokeN * 0.5)), 0.10, fwidth(ang * spokeN * 0.5))
                 * inHub * smoothstep(0.03, 0.09, f1);

    // arterial links along cell boundaries
    float road = 1.0 - smoothstep(0.005, 0.005 + fwidth(f2 - f1) * 1.6 + 0.004, f2 - f1);
    road *= smoothstep(1.7, 0.5, fwidth((f2 - f1) * 60.0));

    // minor districts: a finer second network
    float m1, m2, mid; vec3 mfp;
    voronoi(n * 16.0, m1, m2, mfp, mid);
    float minor = glowLine(abs(sin(m1 * 34.0)), 0.22, fwidth(m1 * 34.0))
                * (1.0 - smoothstep(0.10, 0.24, m1));
    float mcore = exp(-m1 * m1 * 900.0) * 1.5;
    float mroad = 1.0 - smoothstep(0.006, 0.006 + fwidth(m2 - m1) * 1.6 + 0.005, m2 - m1);
    mroad *= smoothstep(1.7, 0.5, fwidth((m2 - m1) * 120.0));

    // grand arcs: sparse planet-spanning ring systems
    float g1, g2, gid; vec3 gfp;
    voronoi(n * 2.2 + 31.0, g1, g2, gfp, gid);
    float grand = glowLine(abs(sin(g1 * 30.0)), 0.10, fwidth(g1 * 30.0))
                * (1.0 - smoothstep(0.25, 0.75, g1)) * 0.35;

    // pinpoint tower lights
    float speckle = smoothstep(0.86, 0.99, gnoise(n * 260.0)) * (0.3 + 0.7 * density);

    float grid = rings * 0.8 + spokes * 0.5 + core * 0.65
               + (minor * 0.5 + mcore * 0.6 + mroad * 0.25) * 0.7
               + road * 0.32 + grand * 0.6;
    grid *= 0.20 + 0.95 * density;
    // unresolvable-detail floor: distant hubs read as soft urban glow
    grid += inHub * density * 0.05 + speckle * 0.5;

    float hueN = fbm4(n * 6.0 + 41.2);
    vec3 lightCol = mix(vec3(1.0, 0.50, 0.15), vec3(1.0, 0.82, 0.40), hueN);

    // ---- day / night -------------------------------------------------------
    float ndl = dot(wn, uSunDir);
    float dayL = clamp(ndl, 0.0, 1.0);
    float day = smoothstep(-0.05, 0.30, ndl);
    float night = 1.0 - smoothstep(-0.18, 0.10, ndl);

    vec3 col = crust * (0.030 + dayL * vec3(1.0, 0.96, 0.90) * 1.0);

    // cloud bands + polar haze, carried by sunlight
    float cl = fbm(n * 4.0 + vec3(0.0, uTime * 0.006, 0.0));
    cl = smoothstep(0.52, 0.85, cl + 0.32 * smoothstep(0.58, 0.94, abs(n.y)));
    vec3 cloudCol = vec3(0.72, 0.83, 1.0) * (0.04 + dayL * 0.95);
    col = mix(col, cloudCol, cl * (0.10 + 0.90 * day));

    // the grid glows hard at night, faintly through the day haze, never through cloud
    float glowVis = mix(0.25, 1.0, night) * (1.0 - cl * 0.85);
    col += lightCol * grid * glowVis * 1.5;

    // atmosphere against the disc: blue where lit, warm city-haze on the dark limb
    float fres = pow(1.0 - clamp(dot(viewDir, wn), 0.0, 1.0), 4.0);
    col += vec3(0.30, 0.52, 1.0) * fres * (0.06 + 0.45 * day);
    col += vec3(1.0, 0.55, 0.22) * fres * night * 0.10;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Mustafar — domain-warped molten marbling: broad lava seas, ridged rivers and
// hairline vein cracks glowing through a near-black basalt crust.
// ---------------------------------------------------------------------------

const MUSTAFAR_FRAG = /* glsl */ `
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

function Atmosphere({
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

interface PlanetProps {
  radius?: number;
  /** world-space direction TOWARD the sun (normalized internally) */
  sunDirection?: [number, number, number];
}

function usePlanetArgs(
  fragmentShader: string,
  sunDirection: [number, number, number],
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
          },
        },
      ] as [THREE.ShaderMaterialParameters],
    [fragmentShader, sun],
  );
  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return [args, sun, matRef];
}

/** city-planet: circuit-grid night side, blue day crescent, blue atmosphere */
export function CoruscantPlanet({ radius = 48, sunDirection = [-0.8, 0.3, 0.25] }: PlanetProps) {
  const [args, sun, matRef] = usePlanetArgs(CORUSCANT_FRAG, sunDirection);
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
export function MustafarPlanet({ radius = 75, sunDirection = [0.35, 0.6, 0.55] }: PlanetProps) {
  const [args, sun, matRef] = usePlanetArgs(MUSTAFAR_FRAG, sunDirection);
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
