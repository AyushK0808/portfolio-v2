'use client';

import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend, ThreeElement } from '@react-three/fiber';

/**
 * Custom GLSL materials (design bible §7). All are registered with R3F's
 * `extend` so they can be used as JSX elements, and typed below.
 */

// ── Hologram panel: fresnel edge + scrolling scanlines + flicker ──
export const HoloMaterial = shaderMaterial(
  {
    uColor: new THREE.Color('#00D9F5'),
    uTime: 0,
    uOpacity: 1,
    uFillAlpha: 0.12,
  },
  /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }`,
  /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uFillAlpha;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.0);
    vec2 d = min(vUv, 1.0 - vUv);
    float edge = 1.0 - smoothstep(0.0, 0.035, min(d.x, d.y));
    // kept subtle — heavy scan/flicker distorted the card text (readability)
    float scan = 0.016 * sin((vUv.y * 180.0) - uTime * 5.0);
    float blink = 0.988 + 0.012 * sin(uTime * 41.0) * step(0.985, sin(uTime * 0.9) * 0.5 + 0.5);
    float alpha = (uFillAlpha + fresnel * 0.30 + edge * 0.85 + scan) * uOpacity * blink;
    vec3 col = uColor * (0.55 + fresnel * 0.9 + edge * 1.8 + scan * 1.0);
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }`,
);

// ── Nebula dome: 3-octave fBm on an inverted sphere, sector tinted ──
export const NebulaMaterial = shaderMaterial(
  {
    uColorA: new THREE.Color('#00D9F5'),
    uColorB: new THREE.Color('#0E6E7E'),
    uColorC: new THREE.Color('#0A0E17'),
    // spectral accent hues, blended in by uMulti (title/menu screens crank it)
    uColorM1: new THREE.Color('#B266FF'),
    uColorM2: new THREE.Color('#FF7FBF'),
    uColorM3: new THREE.Color('#FFB347'),
    uTime: 0,
    uIntensity: 1,
    uMulti: 0,
  },
  /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,
  /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform vec3 uColorM1;
  uniform vec3 uColorM2;
  uniform vec3 uColorM3;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uMulti;
  varying vec3 vPos;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }
  void main() {
    vec3 dir = normalize(vPos);
    float t = uTime * 0.006;
    // domain warp — pushes the clouds into wispy filaments instead of blobs
    vec3 q = vec3(
      fbm(dir * 2.0 + vec3(0.0, t, 0.0)),
      fbm(dir * 2.0 + vec3(5.2, 1.3, -t)),
      fbm(dir * 2.0 + vec3(-1.7, t * 0.5, 2.8))
    );
    float n = fbm(dir * 3.1 + q * 1.9 + vec3(t, -t * 0.6, t * 0.3));
    float n2 = fbm(dir * 6.0 - vec3(t * 0.5) + q);
    float neb = smoothstep(0.36, 0.92, n) * uIntensity;

    // ramp: deep dust → sector base → hot highlight core
    vec3 bright = min(uColorA * 1.8 + 0.06, vec3(1.0));
    vec3 col = mix(uColorB, uColorA, clamp(n2 * 1.5, 0.0, 1.0));
    col = mix(col, bright, pow(clamp(n2, 0.0, 1.0), 3.0) * 0.65);

    // spectral accents — the domain-warp channels carve independent hue
    // bands so the gas shifts violet / magenta / amber across the dome
    float h1 = smoothstep(0.38, 0.72, q.x);
    float h2 = smoothstep(0.42, 0.78, q.y);
    float h3 = smoothstep(0.50, 0.85, q.z);
    vec3 spectral = col;
    spectral = mix(spectral, uColorM1 * 1.5, h1 * 0.85);
    spectral = mix(spectral, uColorM2 * 1.35, h2 * 0.7);
    spectral = mix(spectral, uColorM3 * 1.25, h3 * 0.5);
    col = mix(col, spectral, uMulti);
    bright = mix(bright, vec3(1.0), uMulti * 0.45);

    col = mix(uColorC, col, neb);

    // bright filament ridges threaded through the densest gas
    float fil = smoothstep(0.62, 0.96, n) * neb;
    col += bright * fil * (0.4 + uMulti * 0.25);

    // keep it a backdrop — low enough alpha that holograms read in front of it
    float alpha = neb * 0.32 + fil * 0.1;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.72));
  }`,
);

// ── Warp tunnel: star-line streaks at entry/exit, smooth hyperspace
//    swirl through the middle of the jump (Star Wars lightspeed) ──
export const WarpMaterial = shaderMaterial(
  {
    uColorFrom: new THREE.Color('#00D9F5'),
    uColorTo: new THREE.Color('#B266FF'),
    uTime: 0,
    uProgress: 0, // 0→1→0 intensity envelope
    uRaw: 0, // raw 0→1 jump progress (phases the visuals)
  },
  /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,
  /* glsl */ `
  uniform vec3 uColorFrom;
  uniform vec3 uColorTo;
  uniform float uTime;
  uniform float uProgress;
  uniform float uRaw;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm2(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise2(p);
      p = p * 2.03 + vec2(17.3, 9.1);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // phase weights: streaked star-lines while entering/exiting, the smooth
    // swirling tunnel through the cruise portion of the jump. A few streaks
    // persist through the middle so the crossfade never dips to black.
    float mid = smoothstep(0.12, 0.30, uRaw) * (1.0 - smoothstep(0.70, 0.88, uRaw));
    float starsW = 1.0 - mid * 0.8;

    vec3 base = mix(uColorFrom, uColorTo, clamp(uRaw * 1.4 - 0.2, 0.0, 1.0));
    vec3 col = vec3(0.0);
    float a = 0.0;

    // ── star-lines: stars stretched into racing streaks ──
    if (starsW > 0.002) {
      float cols = 150.0;
      float colId = floor(vUv.x * cols);
      float rnd = fract(sin(colId * 91.17) * 43758.55);
      float rnd2 = fract(sin(colId * 12.9898) * 78.233);
      float speed = (2.5 + rnd * 8.0) * (0.5 + uProgress * 1.9);
      float len = 0.06 + rnd2 * 0.22;
      float p = fract(vUv.y * (1.0 + rnd * 2.0) - uTime * speed);
      float streak = smoothstep(0.0, 0.07, p) * smoothstep(0.10 + len, 0.10, p);
      float within = smoothstep(0.42, 0.0, abs(fract(vUv.x * cols) - 0.5));
      float head = smoothstep(0.025, 0.0, p) * within;
      float sa = (streak * within + head) * starsW;
      col += mix(base, vec3(1.0), head * 0.85) * (1.4 + rnd) * sa;
      a += sa;
    }

    // ── hyperspace swirl: soft luminous clouds twisting past the canopy ──
    if (mid > 0.002) {
      // corkscrew the angular coordinate along the tunnel and race it forward
      vec2 p = vec2(vUv.x * 4.0 + vUv.y * 1.6, vUv.y * 3.0 - uTime * 2.4);
      float n = fbm2(p);
      float n2 = fbm2(p * 1.9 + vec2(n * 2.2, -uTime * 1.1));
      float bands = fbm2(vec2(vUv.x * 8.0, vUv.y * 1.1 - uTime * 3.6));

      vec3 tcol = mix(base * 0.4, base, n);
      // mother-of-pearl highlights threaded through the flow
      tcol = mix(tcol, vec3(1.0), pow(clamp(n2, 0.0, 1.0), 3.2) * 0.7);
      tcol += base * pow(clamp(bands, 0.0, 1.0), 2.5) * 0.55;

      // white-hot core at the far end of the tunnel (uv.y→0 is dead ahead)
      float core = pow(1.0 - vUv.y, 4.0);
      tcol += vec3(0.9, 0.96, 1.0) * core * 1.1;

      // dark lanes between the flow streaks keep the swirl readable
      float lane = 0.55 + 0.45 * bands;
      float ta = (0.14 + n * 0.42 + core * 0.9) * lane * mid;
      col += tcol * ta;
      a += ta;
    }

    a *= uProgress;
    col *= uProgress;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }`,
);

// ── CRT phosphor screen (Contact terminal backdrop) ──
export const CrtMaterial = shaderMaterial(
  {
    uColor: new THREE.Color('#4DFF88'),
    uTime: 0,
  },
  /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,
  /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv * 2.0 - 1.0;
    c *= 1.0 + 0.07 * dot(c, c);
    vec2 uv = c * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.005, 0.02, 0.01, 0.95);
      return;
    }
    float scan = 0.5 + 0.5 * sin(uv.y * 320.0 + uTime * 3.0);
    float roll = smoothstep(0.0, 0.15, abs(fract(uv.y - uTime * 0.04) - 0.5));
    float vig = smoothstep(1.35, 0.35, length(c));
    vec3 col = uColor * (0.10 + 0.06 * scan) * vig * (0.8 + 0.2 * roll);
    gl_FragColor = vec4(col, 0.92);
  }`,
);

extend({ HoloMaterial, NebulaMaterial, WarpMaterial, CrtMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    holoMaterial: ThreeElement<typeof HoloMaterial>;
    nebulaMaterial: ThreeElement<typeof NebulaMaterial>;
    warpMaterial: ThreeElement<typeof WarpMaterial>;
    crtMaterial: ThreeElement<typeof CrtMaterial>;
  }
}

// In-world font paths (self-hosted TTFs for troika)
export const FONT_HERO = '/fonts/orbitron-900.ttf';
export const FONT_HUD = '/fonts/chakra-petch-600.ttf';
export const FONT_MONO = '/fonts/jetbrains-mono-400.ttf';
