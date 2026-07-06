'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import { useApp } from '@/state/store';
import { DUR } from '@/lib/theme';
import { FLIGHT, warpEnvelope } from '@/systems/flightplan';

/** live camera telemetry for the HUD coordinates ticker (non-reactive) */
export const camTelemetry = {
  pos: new THREE.Vector3(),
  warpEnv: 0,
};

const PITCH_LIMIT = 1.22; // ±70°
const FLY_SPEED = 9;

/** visual center of the HeroShip hull — the title-screen orbit target */
const SHIP_FOCUS = new THREE.Vector3(0, 0.75, -1.0);
const ORBIT_R = 15.6;
const orbitPos = (t: number, out: THREE.Vector3) =>
  out.set(
    SHIP_FOCUS.x + Math.sin(t * 0.11) * ORBIT_R,
    3.1 + Math.sin(t * 0.21) * 0.55,
    SHIP_FOCUS.z + Math.cos(t * 0.11) * ORBIT_R,
  );

/**
 * One camera brain for the whole experience (plan §7):
 *  - BOOT: exterior beauty pass — slow orbit around the hero ship
 *  - POWERUP: boarding flight — swing past the bow, dive through the canopy
 *  - AUTO: damped flight to the sector entry pose or the focused POI
 *  - MANUAL: WASD/arrow thrust + drag-look with clamped pitch
 *  - Sector E: turret mode — fixed seat, free aim
 *  - WARP: FOV punch 56 → 74 → 56
 */
export function CameraDirector() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);

  const keys = useRef(new Set<string>());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const vel = useRef(new THREE.Vector3());
  const dragging = useRef(false);
  const prevSector = useRef<string | null>(null);
  /** boarding spline, built once per POWERUP from wherever the orbit was */
  const boarding = useRef<THREE.CatmullRomCurve3 | null>(null);

  const tmp = useMemo(
    () => ({
      // must be camera-like: Object3D.lookAt points +z at the target, while
      // cameras look down -z — a plain Object3D would face away
      obj: new THREE.PerspectiveCamera(),
      v1: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      e: new THREE.Euler(),
      q: new THREE.Quaternion(),
    }),
    [],
  );

  // ── input listeners ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code);
      if (e.code === 'Escape') {
        const s = useApp.getState();
        if (s.focus) s.setFocus(null);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    const el = gl.domElement;
    let lastX = 0;
    let lastY = 0;
    const pd = (e: PointerEvent) => {
      dragging.current = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const pm = (e: PointerEvent) => {
      if (!dragging.current) return;
      const s = useApp.getState();
      const lookActive =
        (s.navMode === 'MANUAL' && !s.focus) ||
        (s.sector === 'E' && s.phase === 'MISSION');
      if (lookActive) {
        yaw.current -= (e.clientX - lastX) * 0.0035;
        pitch.current = THREE.MathUtils.clamp(
          pitch.current - (e.clientY - lastY) * 0.0035,
          -PITCH_LIMIT,
          PITCH_LIMIT,
        );
      }
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const pu = () => (dragging.current = false);
    el.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    return () => {
      el.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
    };
  }, [gl]);

  const syncAngles = () => {
    tmp.e.setFromQuaternion(camera.quaternion, 'YXZ');
    yaw.current = tmp.e.y;
    pitch.current = tmp.e.x;
  };

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = useApp.getState();
    const plan = FLIGHT[s.sector];

    // hard cut to the new sector's entry pose while the warp tunnel covers us
    if (prevSector.current !== s.sector) {
      prevSector.current = s.sector;
      if (s.phase === 'BOOT') {
        // spawn on the orbit ring, stern-on: engine glow owns the first frame
        orbitPos(state.clock.elapsedTime, tmp.v1);
        camera.position.copy(tmp.v1);
        camera.lookAt(SHIP_FOCUS);
        vel.current.set(0, 0, 0);
        syncAngles();
      } else if (s.phase === 'WARP') {
        camera.position.set(...plan.entry.pos);
        camera.lookAt(...plan.entry.look);
        vel.current.set(0, 0, 0);
        syncAngles();
      }
    }
    if (s.phase !== 'POWERUP' && boarding.current) boarding.current = null;

    // ── FOV: warp punch ──
    let fovTarget = 56;
    let env = 0;
    if (s.phase === 'WARP' && !s.reducedMotion) {
      env = warpEnvelope(s.warpStartedAt, performance.now(), s.warpDuration);
      fovTarget = 56 + 18 * env;
    }
    camTelemetry.warpEnv = env;
    easing.damp(camera, 'fov', fovTarget, 0.08, dt);
    camera.updateProjectionMatrix();

    const turret = s.sector === 'E' && (s.phase === 'MISSION' || s.phase === 'WARP');
    const manual =
      s.navMode === 'MANUAL' &&
      !turret &&
      !s.focus &&
      (s.phase === 'MISSION' || s.phase === 'BRIDGE');

    if (s.phase === 'BOOT') {
      // slow beauty orbit around the hull while the title holds
      orbitPos(state.clock.elapsedTime, tmp.v1);
      easing.damp3(camera.position, tmp.v1, 1.1, dt);
      tmp.obj.position.copy(camera.position);
      tmp.obj.lookAt(SHIP_FOCUS);
      easing.dampQ(camera.quaternion, tmp.obj.quaternion, 1.1, dt);
    } else if (s.phase === 'POWERUP') {
      if (s.reducedMotion) {
        // quick cut down into the seat
        tmp.v1.set(...FLIGHT.BRIDGE.entry.pos);
        easing.damp3(camera.position, tmp.v1, 0.25, dt);
        tmp.obj.position.copy(camera.position);
        tmp.obj.lookAt(...FLIGHT.BRIDGE.entry.look);
        easing.dampQ(camera.quaternion, tmp.obj.quaternion, 0.25, dt);
        syncAngles();
      } else {
        // boarding flight: swing past the bow, skim the spine, drop through
        // the canopy glass into the seat pose
        if (!boarding.current) {
          boarding.current = new THREE.CatmullRomCurve3(
            [
              camera.position.clone(),
              new THREE.Vector3(5.6, 3.5, -11.6),
              new THREE.Vector3(1.4, 2.6, -5.6),
              new THREE.Vector3(0, 1.68, -1.95),
              new THREE.Vector3(...FLIGHT.BRIDGE.entry.pos),
            ],
            false,
            'centripetal',
          );
        }
        const raw = THREE.MathUtils.clamp(
          (performance.now() - s.powerupStartedAt) / DUR.boot,
          0,
          1,
        );
        const p = raw * raw * (3 - 2 * raw);
        boarding.current.getPointAt(p, camera.position);
        // gaze hands off from the hull to the flight path as we drop in
        const lookMix = THREE.MathUtils.smoothstep(p, 0.55, 1);
        tmp.v2.copy(SHIP_FOCUS).lerp(tmp.v1.set(...FLIGHT.BRIDGE.entry.look), lookMix);
        tmp.obj.position.copy(camera.position);
        tmp.obj.lookAt(tmp.v2);
        easing.dampQ(camera.quaternion, tmp.obj.quaternion, 0.12, dt);
        syncAngles();
      }
    } else if (manual) {
      // free flight
      camera.quaternion.setFromEuler(tmp.e.set(pitch.current, yaw.current, 0, 'YXZ'));
      tmp.v1.set(0, 0, 0);
      const k = keys.current;
      if (k.has('KeyW') || k.has('ArrowUp')) tmp.v1.z -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) tmp.v1.z += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) tmp.v1.x -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) tmp.v1.x += 1;
      if (k.has('KeyR')) tmp.v1.y += 1;
      if (k.has('KeyF')) tmp.v1.y -= 1;
      if (tmp.v1.lengthSq() > 0) {
        tmp.v1.normalize().applyQuaternion(camera.quaternion).multiplyScalar(FLY_SPEED);
      }
      // gentle inertia
      easing.damp3(vel.current, tmp.v1, 0.35, dt);
      camera.position.addScaledVector(vel.current, dt);
      // keep pilots inside the sector bubble
      const d = camera.position.length();
      if (d > 110) camera.position.multiplyScalar(110 / d);
    } else if (turret) {
      // seated aim: position pinned, orientation free
      tmp.v1.set(...plan.entry.pos);
      easing.damp3(camera.position, tmp.v1, 0.4, dt);
      camera.quaternion.setFromEuler(tmp.e.set(pitch.current, yaw.current, 0, 'YXZ'));
    } else {
      // autopilot: entry pose or focused POI
      const pose = (s.focus && plan.pois[s.focus]) || plan.entry;
      tmp.v1.set(...pose.pos);
      const smooth = s.reducedMotion ? 0.18 : s.focus ? 0.45 : 0.7;
      easing.damp3(camera.position, tmp.v1, smooth, dt);
      tmp.obj.position.copy(camera.position);
      tmp.obj.lookAt(...pose.look);
      easing.dampQ(camera.quaternion, tmp.obj.quaternion, smooth, dt);
      syncAngles();
    }

    camTelemetry.pos.copy(camera.position);
  });

  return null;
}
