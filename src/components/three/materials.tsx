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
    float scan = 0.05 * sin((vUv.y * 180.0) - uTime * 5.0);
    float blink = 0.96 + 0.04 * sin(uTime * 41.0) * step(0.985, sin(uTime * 0.9) * 0.5 + 0.5);
    float alpha = (uFillAlpha + fresnel * 0.30 + edge * 0.85 + scan) * uOpacity * blink;
    vec3 col = uColor * (0.55 + fresnel * 0.9 + edge * 1.8 + scan * 2.5);
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }`,
);

// ── Nebula dome: 3-octave fBm on an inverted sphere, sector tinted ──
export const NebulaMaterial = shaderMaterial(
  {
    uColorA: new THREE.Color('#00D9F5'),
    uColorB: new THREE.Color('#0E6E7E'),
    uColorC: new THREE.Color('#0A0E17'),
    uTime: 0,
    uIntensity: 1,
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
  uniform float uTime;
  uniform float uIntensity;
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
    col = mix(uColorC, col, neb);

    // bright filament ridges threaded through the densest gas
    float fil = smoothstep(0.62, 0.96, n) * neb;
    col += bright * fil * 0.4;

    // keep it a backdrop — low enough alpha that holograms read in front of it
    float alpha = neb * 0.32 + fil * 0.1;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.72));
  }`,
);

// ── Warp tunnel: per-column streaks racing down a cylinder ──
export const WarpMaterial = shaderMaterial(
  {
    uColorFrom: new THREE.Color('#00D9F5'),
    uColorTo: new THREE.Color('#B266FF'),
    uTime: 0,
    uProgress: 0,
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
  varying vec2 vUv;
  void main() {
    float cols = 150.0;
    float colId = floor(vUv.x * cols);
    float rnd = fract(sin(colId * 91.17) * 43758.55);
    float rnd2 = fract(sin(colId * 12.9898) * 78.233);
    // star-lines accelerate as the jump reaches full lightspeed
    float speed = (2.5 + rnd * 8.0) * (0.5 + uProgress * 1.9);
    float len = 0.06 + rnd2 * 0.22;
    float p = fract(vUv.y * (1.0 + rnd * 2.0) - uTime * speed);
    float streak = smoothstep(0.0, 0.07, p) * smoothstep(0.10 + len, 0.10, p);
    float within = smoothstep(0.42, 0.0, abs(fract(vUv.x * cols) - 0.5));
    // hot white leading edge on each streak
    float head = smoothstep(0.025, 0.0, p) * within;
    vec3 col = mix(uColorFrom, uColorTo, clamp(uProgress * 1.4 - 0.2, 0.0, 1.0));
    col = mix(col, vec3(1.0), head * 0.85);
    float a = (streak * within + head) * uProgress;
    gl_FragColor = vec4(col * (1.4 + rnd) * a, a);
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
