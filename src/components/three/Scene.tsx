'use client';

import { Suspense, lazy, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor, PerspectiveCamera } from '@react-three/drei';
import { useApp, useLocationTheme } from '@/state/store';
import { COLORS } from '@/lib/theme';
import { cruiseEndMs, jumpOutMs } from '@/systems/jump';
import { loaderAssetsIn, loaderRemainingMs } from '@/systems/loader';
// bare import so the extend() call always executes — the named imports in
// other files are type-only and get elided by the compiler
import './materials';
import { Starfield } from './Starfield';
import { Cockpit } from './Cockpit';
import { HeroShip } from './HeroShip';
import { WarpTunnel } from './WarpTunnel';
import { StarStreaks } from './StarStreaks';
import { CameraDirector, camTelemetry } from './CameraDirector';
import { PostFX } from './PostFX';
import { LocationPlaceholder, LocationReadyBeacon } from './LocationPlaceholder';

const Hub = lazy(() => import('./locations/Hub'));
const About = lazy(() => import('./locations/About'));
const Skills = lazy(() => import('./locations/Skills'));
const Experience = lazy(() => import('./locations/Experience'));
const Projects = lazy(() => import('./locations/Projects'));
const Achievements = lazy(() => import('./locations/Achievements'));
const Arena = lazy(() => import('./locations/Arena'));
const Comms = lazy(() => import('./locations/Comms'));

/** exp2 fog + the 3-light global rig, crossfaded to the location palette */
function Atmosphere() {
  const theme = useLocationTheme();
  const scene = useThree((s) => s.scene);
  const fogRef = useRef<THREE.FogExp2 | null>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const targets = useRef({
    fog: new THREE.Color(),
    key: new THREE.Color(),
    rim: new THREE.Color(),
  });

  useEffect(() => {
    const fog = new THREE.FogExp2(COLORS.spaceDeep, 0.02);
    scene.fog = fog;
    fogRef.current = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  // fog = location deep tinted toward space, never pure black
  targets.current.fog.set(theme.deep).lerp(new THREE.Color(COLORS.spaceDeep), 0.82);
  targets.current.key.set(theme.base);
  targets.current.rim.set(theme.bright);

  useFrame((_, dt) => {
    const k = Math.min(dt * 1.8, 1);
    const fog = fogRef.current;
    if (fog) {
      fog.color.lerp(targets.current.fog, k);
      fog.density += (theme.fogDensity - fog.density) * k;
    }
    key.current?.color.lerp(targets.current.key, k);
    rim.current?.color.lerp(targets.current.rim, k);
  });

  return (
    <>
      <ambientLight intensity={0.18} color={COLORS.spaceDeep} />
      <directionalLight ref={key} position={[-5, 8, 4]} intensity={0.9} />
      <directionalLight ref={rim} position={[6, 3, 8]} intensity={0.5} />
    </>
  );
}

/**
 * Image-based lighting, generated in code (no downloaded HDRIs): a dark sky
 * with a warm key panel, a cool fill and a strip in the location's colour.
 * This is what metal hulls and the cockpit reflect — without it every
 * metallic surface renders near-black. Rebuilt once per location.
 */
function SpaceEnvironment() {
  const theme = useLocationTheme();
  return (
    <Environment key={theme.id} resolution={256} frames={1} environmentIntensity={0.85}>
      <color attach="background" args={['#05070c']} />
      {/* the local sun: small, hot, high off the port side */}
      <Lightformer form="circle" intensity={14} color="#fff3df" position={[-7, 6, 3]} scale={3.2} target={[0, 0, 0]} />
      {/* broad cool sky fill from behind */}
      <Lightformer form="rect" intensity={1.1} color="#9fb6ff" position={[0, 3, 9]} scale={[22, 9, 1]} target={[0, 0, 0]} />
      {/* the location's own glow, low off the starboard bow */}
      <Lightformer form="rect" intensity={2.4} color={theme.base} position={[8, -1, -6]} scale={[9, 5, 1]} target={[0, 0, 0]} />
      <Lightformer form="ring" intensity={1.6} color={theme.bright} position={[0, -7, 0]} scale={9} target={[0, 0, 0]} />
    </Environment>
  );
}

/**
 * Runs a jump to its end. The tunnel doubles as the loading screen for every
 * jump: the cruise beat holds until <LocationReadyBeacon> reports the incoming
 * location's component + assets are in, with a hard safety cap so a stalled or
 * failed asset can never trap the pilot in hyperspace (we drop out and the
 * LocationPlaceholder covers the remainder).
 */
const JUMP_MAX_HOLD = 6000;
const DEEP_LINK_MAX_HOLD = 15000;

function JumpController() {
  useFrame(() => {
    const s = useApp.getState();
    const j = s.jump;
    if (s.phase !== 'JUMP' || !j) return;
    const now = performance.now();
    const elapsed = now - j.startedAt;

    // deep-link entry: wait in the tunnel until the destination has loaded
    if (j.hold) {
      // the same minimum as the normal loader, so the tunnel is always seen
      const ready = s.locationReady && loaderRemainingMs(s.reducedMotion) === 0;
      if (ready || elapsed >= DEEP_LINK_MAX_HOLD) {
        loaderAssetsIn();
        s.releaseHold();
      } else if (s.locationReady) {
        loaderAssetsIn();
      }
      return;
    }
    // belt and braces for the store's swap timer (background tabs throttle timers)
    if (elapsed >= j.duration * 0.5 && s.location !== j.to) s.swapLocation();

    if (j.exitStartedAt === null) {
      const ready = s.locationReady && s.location === j.to;
      const due = elapsed >= (j.instant ? j.duration : cruiseEndMs(j));
      if ((due && ready) || elapsed >= j.duration + JUMP_MAX_HOLD) s.beginExit();
    } else if (now - j.exitStartedAt >= jumpOutMs(j)) {
      s.arrive();
    }
  });
  return null;
}

export function Scene() {
  const location = useApp((s) => s.location);
  const phase = useApp((s) => s.phase);
  // title + boarding show the ship from outside
  const exterior = phase === 'INTRO' || phase === 'BOARDING';

  const world = useRef<THREE.Group>(null);
  const cockpit = useRef<THREE.Group>(null);
  const hero = useRef<THREE.Group>(null);

  // console handle for debugging / e2e inspection (pairs with window.__app)
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    (window as unknown as { __scene?: THREE.Scene }).__scene = scene;
  }, [scene]);

  // what is drawn changes mid-shot (inside the tunnel, at the canopy pass), so
  // it is driven per frame from the camera's telemetry rather than React state
  useFrame(() => {
    if (world.current) world.current.visible = camTelemetry.worldVisible;
    if (cockpit.current) cockpit.current.visible = camTelemetry.inCockpit;
    if (hero.current) hero.current.visible = !camTelemetry.inCockpit;
  });

  return (
    <>
      <PerspectiveCamera makeDefault fov={56} near={0.05} far={2000} position={[0, 1.2, 0]}>
        {/* the cockpit and the hyperspace layers ride with the camera */}
        <group ref={cockpit} visible={false}>
          <Suspense fallback={null}>
            <Cockpit />
          </Suspense>
        </group>
        <StarStreaks />
        <WarpTunnel />
      </PerspectiveCamera>
      <CameraDirector />
      <Atmosphere />
      <SpaceEnvironment />
      <group ref={world}>
        <Starfield />
        {exterior && (
          <group ref={hero}>
            <Suspense fallback={null}>
              <HeroShip />
            </Suspense>
          </group>
        )}
        {/* The incoming location streams in behind a holographic placeholder;
            keyed by location so switching fully remounts and the readiness
            beacon re-arms. The beacon only commits once this boundary resolves —
            JumpController waits on it so lightspeed holds until it has loaded. */}
        <Suspense fallback={<LocationPlaceholder />}>
          <group key={location}>
            {location === 'HUB' && <Hub />}
            {location === 'ABOUT' && <About />}
            {location === 'SKILLS' && <Skills />}
            {location === 'EXPERIENCE' && <Experience />}
            {location === 'PROJECTS' && <Projects />}
            {location === 'ACHIEVEMENTS' && <Achievements />}
            {location === 'ARENA' && <Arena />}
            {location === 'COMMS' && <Comms />}
            <LocationReadyBeacon />
          </group>
        </Suspense>
      </group>
      <JumpController />
      {/* watches the frame rate; a sustained dip in steady flight drops one graphics tier */}
      <PerformanceMonitor
        ms={300}
        iterations={10}
        threshold={0.8}
        bounds={() => [36, 400]}
        flipflops={Infinity}
        onDecline={() => useApp.getState().stepQualityDown()}
      />
      <PostFX />
    </>
  );
}
