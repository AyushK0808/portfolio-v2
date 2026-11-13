'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import { useApp } from '@/state/store';
import { audio } from '@/systems/audio';
import { FLIGHT, SHIP_POS, railPose } from '@/systems/flightplan';
import { scroll, tick as scrollTick } from '@/systems/scroll';
import { JumpBeats, jumpBeats } from '@/systems/jump';
import { BOARDING_MS, CANOPY_AT, ORBIT_AT, TITLE_AT, arrival } from '@/systems/intro';
import { loaderProgress } from '@/systems/loader';

/**
 * Per-frame values shared with everything that is not the camera: the HUD
 * (read on animation frames), post-processing, the hyperspace layers and the
 * cockpit. Written once per frame at the top of the camera's update, which
 * runs before every other component's.
 */
export const camTelemetry = {
  pos: new THREE.Vector3(),
  /** 0..1 overall hyperspace intensity (FOV punch, chromatic aberration) */
  warpEnv: 0,
  /** 0..1 how far the stars are stretched into lines */
  streak: 0,
  /** 0..1 opacity of the tunnel swirl */
  tunnel: 0,
  /** 0..1 white flash (entering/leaving the tunnel, passing through the canopy) */
  flash: 0,
  /** whether the location around the ship should be drawn */
  worldVisible: true,
  /** true once the camera is inside the cockpit (from the canopy pass onward) */
  inCockpit: false,
  /** 0..1 dropping into the seat after the canopy pass (1 = seated) */
  settle: 1,
  /** 1 the instant a rock hits the hull in the game, decaying to 0 (red flash + shake) */
  hit: 0,
  /** screen position (CSS px) of the active stop's anchor — the card's leader line ends here */
  anchorX: 0,
  anchorY: 0,
  anchorVisible: false,
};

const PITCH_LIMIT = 1.22; // ±70°
const FLY_SPEED = 9;
const LANDSCAPE_FOV = 56;
/** how far out the ship is when it drops out of the tunnel (world units) */
const RUSH_DISTANCE = 150;

/**
 * Vertical FOV for the current viewport. Landscape keeps the designed 56°.
 * Upright screens widen it so the horizontal view never drops below ~50° —
 * otherwise the cockpit frame is cropped away and everything looms.
 */
export function baseFov(aspect: number): number {
  if (aspect >= 1) return LANDSCAPE_FOV;
  const h = THREE.MathUtils.degToRad(50);
  const v = 2 * Math.atan(Math.tan(h / 2) / aspect);
  return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(v), LANDSCAPE_FOV, 84);
}

const SHIP = new THREE.Vector3(...SHIP_POS);
/** the fixed vantage point for the cold open: off the ship's stern quarter */
const VANTAGE = new THREE.Vector3(7, 1.6, 13).add(SHIP);
const ORBIT_R = Math.hypot(7, 13);
const ORBIT_START = Math.atan2(7, 13);
/** slow beauty orbit, starting exactly at the vantage point */
const orbitPos = (t: number, out: THREE.Vector3) => {
  const a = ORBIT_START + t * 0.11;
  return out.set(
    SHIP.x + Math.sin(a) * ORBIT_R,
    SHIP.y + 1.6 + Math.sin(t * 0.21) * 0.55,
    SHIP.z + Math.cos(a) * ORBIT_R,
  );
};

const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

/**
 * One camera brain for the whole experience:
 *  - loading: parked at the vantage point inside the loader's tunnel
 *  - INTRO: watches the ship drop out of hyperspace and pass, then orbits it
 *  - BOARDING: chase — drop astern, close over the spine, push through the
 *    canopy glass and settle into the seat
 *  - FLIGHT: ride the location's rail at the scroll engine's position, framing
 *    the active stop off-centre so its card never covers it
 *  - FLIGHT + free flight: WASD/arrow thrust + drag-look (desktop extra)
 *  - FLIGHT in the arena: turret mode — fixed seat, free aim
 *  - JUMP: stretch → tunnel (hard cut to the destination) → rush in and arrive
 */
export function CameraDirector() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);

  const keys = useRef(new Set<string>());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const vel = useRef(new THREE.Vector3());
  const dragging = useRef(false);
  const prevLocation = useRef<string | null>(null);
  const prevPhase = useRef<string | null>(null);
  const arrivedAt = useRef(0);
  const prevPos = useRef(new THREE.Vector3());
  const roll = useRef(0);
  const canopyPassed = useRef(false);
  /** boarding spline, built once per BOARDING from wherever the orbit was */
  const boarding = useRef<THREE.CatmullRomCurve3 | null>(null);

  const tmp = useMemo(
    () => ({
      // must be camera-like: Object3D.lookAt points +z at the target, while
      // cameras look down -z — a plain Object3D would face away
      obj: new THREE.PerspectiveCamera(),
      v1: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      v3: new THREE.Vector3(),
      v4: new THREE.Vector3(),
      e: new THREE.Euler(),
      beats: { streak: 0, tunnel: 0, env: 0, flash: 0, exit: 0, worldVisible: true } as JumpBeats,
    }),
    [],
  );

  // ── input listeners (free flight + turret aim) ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.code);
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
      const lookActive = s.phase === 'FLIGHT' && s.navMode === 'MANUAL' && s.location !== 'ARENA';
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
    window.addEventListener('pointercancel', pu);
    return () => {
      el.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
      window.removeEventListener('pointercancel', pu);
    };
  }, [gl]);

  const syncAngles = () => {
    tmp.e.setFromQuaternion(camera.quaternion, 'YXZ');
    yaw.current = tmp.e.y;
    pitch.current = tmp.e.x;
  };

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const now = performance.now();
    const s = useApp.getState();
    const plan = FLIGHT[s.location];
    const aspect = state.size.width / Math.max(state.size.height, 1);
    const T = camTelemetry;

    scrollTick(dt);

    // ── this frame's hyperspace / cinematic values ──
    let streak = 0;
    let tunnel = 0;
    let flash = 0;
    let env = 0;
    let worldVisible = true;
    let inCockpit = s.phase === 'FLIGHT' || s.phase === 'JUMP';
    let settle = 1;
    let exit = 0;
    /** seconds into the cold open (large once it is over or skipped) */
    const introT = s.reducedMotion ? 999 : (now - s.introStartedAt) / 1000;

    if (s.phase === 'JUMP' && s.jump) {
      const b = jumpBeats(s.jump, now, tmp.beats);
      streak = b.streak;
      tunnel = b.tunnel;
      flash = b.flash;
      env = b.env;
      exit = b.exit;
      worldVisible = b.worldVisible;
    } else if (s.phase === 'INTRO' && !s.loaded) {
      // the loader: already in the tunnel, speed building with load progress
      const p = loaderProgress();
      streak = 0.3 + 0.4 * p;
      tunnel = 0.55 + 0.45 * p;
      env = 0.5 + 0.5 * p;
      worldVisible = false;
    } else if (s.phase === 'INTRO' && introT < 0.7) {
      // dropping out of the loader's tunnel into a still starfield
      const b = introT / 0.7;
      tunnel = 1 - smooth(clamp01(b / 0.45));
      streak = 0.7 * (1 - smooth(b));
      env = 1 - smooth(b);
      flash = 0.7 * Math.exp(-introT / 0.22);
    } else if (s.phase === 'BOARDING' && !s.reducedMotion) {
      const raw = clamp01((now - s.boardingStartedAt) / BOARDING_MS);
      // the canopy pass: a flare and a smear of aberration hide the swap from
      // the exterior model to the cockpit
      const d = (raw - CANOPY_AT) / 0.03;
      flash = 0.85 * Math.exp(-d * d);
      env = 0.9 * Math.exp(-d * d * 0.5);
      inCockpit = raw >= CANOPY_AT;
      if (inCockpit && !canopyPassed.current) audio.canopy();
      canopyPassed.current = inCockpit;
      settle = inCockpit ? smooth(clamp01((raw - CANOPY_AT) / (1 - CANOPY_AT))) : 0;
    }
    if (s.phase === 'FLIGHT' && now - arrivedAt.current < 500) {
      // tail of the arrival flash, so it does not cut off when the phase flips
      flash = Math.max(flash, 0.75 * Math.exp(-(now - arrivedAt.current + 600) / 240));
    }
    T.streak = streak;
    T.tunnel = tunnel;
    T.flash = flash;
    T.warpEnv = env;
    T.worldVisible = worldVisible;
    T.inCockpit = inCockpit;
    T.settle = settle;

    if (s.phase === 'INTRO' && s.loaded && !s.titleUp && introT >= TITLE_AT) s.raiseTitle();

    // ── hard cuts ──
    if (prevLocation.current !== s.location) {
      prevLocation.current = s.location;
      if (s.phase === 'INTRO') {
        camera.position.copy(VANTAGE);
        camera.lookAt(SHIP);
        vel.current.set(0, 0, 0);
        syncAngles();
      } else if (s.phase === 'JUMP') {
        // the destination was just mounted behind the tunnel: face its approach
        const pose = s.jump?.arrive === 'end' ? plan.exit : plan.entry;
        camera.position.set(...pose.pos);
        camera.lookAt(...pose.look);
        vel.current.set(0, 0, 0);
        roll.current = 0;
        syncAngles();
      }
      prevPos.current.copy(camera.position);
    }
    if (prevPhase.current !== s.phase) {
      if (s.phase === 'FLIGHT' && prevPhase.current === 'JUMP') arrivedAt.current = now;
      prevPhase.current = s.phase;
    }
    if (s.phase !== 'BOARDING' && boarding.current) boarding.current = null;

    if (s.phase !== 'BOARDING') canopyPassed.current = false;
    // the hyperdrive's spool-up tone follows the charge
    audio.chargeLevel(s.phase === 'FLIGHT' ? scroll.charge : 0);

    // ── FOV: viewport base + hyperspace punch + a touch of charge ──
    let fovTarget = baseFov(aspect) + 18 * env;
    if (s.phase === 'FLIGHT' && !s.reducedMotion) fovTarget += 5 * scroll.charge;
    easing.damp(camera, 'fov', fovTarget, 0.08, dt);
    camera.updateProjectionMatrix();

    const flying = s.phase === 'FLIGHT' || s.phase === 'JUMP';
    const turret = s.location === 'ARENA' && flying;
    const manual = s.navMode === 'MANUAL' && !turret && s.phase === 'FLIGHT';
    let anchorVisible = false;

    if (s.phase === 'INTRO') {
      if (!s.loaded || introT < ORBIT_AT) {
        // fixed vantage: watch the ship come in from astern and slide past
        const a = arrival(s.loaded ? introT : 0);
        tmp.v2.copy(SHIP);
        tmp.v2.z += a.offset;
        // look a little ahead of the hull while it is still far out
        easing.damp3(camera.position, VANTAGE, 0.3, dt);
        tmp.obj.position.copy(camera.position);
        tmp.obj.lookAt(tmp.v2);
        easing.dampQ(camera.quaternion, tmp.obj.quaternion, a.visible ? 0.09 : 0.4, dt);
      } else {
        // slow beauty orbit around the hull while the title holds
        orbitPos(introT - ORBIT_AT, tmp.v1);
        easing.damp3(camera.position, tmp.v1, 1.1, dt);
        tmp.obj.position.copy(camera.position);
        tmp.obj.lookAt(SHIP);
        easing.dampQ(camera.quaternion, tmp.obj.quaternion, 1.1, dt);
      }
    } else if (s.phase === 'BOARDING') {
      const seat = FLIGHT.HUB.entry;
      if (s.reducedMotion) {
        // quick cut down into the seat
        tmp.v1.set(...seat.pos);
        easing.damp3(camera.position, tmp.v1, 0.25, dt);
        tmp.obj.position.copy(camera.position);
        tmp.obj.lookAt(...seat.look);
        easing.dampQ(camera.quaternion, tmp.obj.quaternion, 0.25, dt);
        syncAngles();
      } else {
        // chase and catch: the ship pulls away, the camera drops astern, closes
        // over the engines and the spine, and pushes through the canopy glass
        if (!boarding.current) {
          boarding.current = new THREE.CatmullRomCurve3(
            [
              camera.position.clone(),
              new THREE.Vector3(1.4, 2.6, 21).add(SHIP),
              new THREE.Vector3(0.5, 2.1, 9.5).add(SHIP),
              new THREE.Vector3(0, 1.75, 1.2).add(SHIP),
              new THREE.Vector3(0, 1.2, -3.2).add(SHIP),
              new THREE.Vector3(...seat.pos),
            ],
            false,
            'centripetal',
          );
        }
        const raw = clamp01((now - s.boardingStartedAt) / BOARDING_MS);
        // ease out of the orbit, then accelerate into the dive
        const p = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
        boarding.current.getPointAt(p, camera.position);
        // gaze: the hull → down the nose → the view from the seat
        const ahead = smooth(clamp01((p - 0.3) / 0.5));
        tmp.v2.copy(SHIP).lerp(tmp.v1.set(...seat.look).setZ(-40), ahead);
        tmp.v2.lerp(tmp.v1.set(...seat.look), smooth(clamp01((p - 0.82) / 0.18)));
        tmp.obj.position.copy(camera.position);
        tmp.obj.lookAt(tmp.v2);
        easing.dampQ(camera.quaternion, tmp.obj.quaternion, 0.14, dt);
        syncAngles();
      }
    } else if (s.phase === 'JUMP' && s.jump && !s.jump.instant && !turret) {
      // inside the jump the camera holds its pose; once the exit beat starts
      // the destination rushes up from far out along its approach line
      const pose = s.location === s.jump.to
        ? (s.jump.arrive === 'end' ? plan.exit : plan.entry)
        : null;
      if (pose && (s.jump.exitStartedAt !== null || !worldVisible)) {
        tmp.v1.set(...pose.pos);
        tmp.v2.set(...pose.look);
        tmp.v3.copy(tmp.v1).sub(tmp.v2).normalize(); // straight back from what we face
        const far = RUSH_DISTANCE * Math.pow(1 - exit, 3);
        camera.position.copy(tmp.v1).addScaledVector(tmp.v3, far);
        camera.lookAt(tmp.v2);
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
      // keep pilots inside the location bubble
      const d = camera.position.length();
      if (d > 110) camera.position.multiplyScalar(110 / d);
    } else if (turret) {
      // the range: seat pinned facing the incoming rocks, the view leaning a
      // little toward the pointer, the airframe jolting when the hull is hit
      tmp.v1.set(...plan.entry.pos);
      if (T.hit > 0.01 && !s.reducedMotion) {
        const t = state.clock.elapsedTime;
        tmp.v1.x += Math.sin(t * 83) * 0.09 * T.hit;
        tmp.v1.y += Math.sin(t * 67 + 2) * 0.09 * T.hit;
      }
      easing.damp3(camera.position, tmp.v1, 0.12, dt);
      tmp.obj.position.copy(camera.position);
      tmp.obj.lookAt(...plan.entry.look);
      tmp.obj.rotateY(-state.pointer.x * 0.07);
      tmp.obj.rotateX(state.pointer.y * 0.05);
      easing.dampQ(camera.quaternion, tmp.obj.quaternion, 0.3, dt);
      syncAngles();
    } else if (s.phase === 'FLIGHT') {
      // ── rail flight: the scroll engine decides where along the rail we are ──
      railPose(s.location, scroll.pos, tmp.v1, tmp.v2);

      // lean into a building charge, with a little airframe shake
      if (scroll.charge > 0 && !s.reducedMotion) {
        const c = scroll.charge;
        tmp.v3.copy(tmp.v2).sub(tmp.v1).normalize();
        tmp.v1.addScaledVector(tmp.v3, c * scroll.chargeDir * 0.8);
        const t = state.clock.elapsedTime;
        tmp.v1.x += Math.sin(t * 61) * 0.012 * c;
        tmp.v1.y += Math.sin(t * 47 + 1.3) * 0.012 * c;
      }

      // ease in from the approach pose on arrival, then track the rail tightly
      const settling = now - arrivedAt.current < 1400;
      const follow = s.reducedMotion ? 0.12 : settling ? 0.6 : 0.22;
      easing.damp3(camera.position, tmp.v1, follow, dt);

      tmp.obj.position.copy(camera.position);
      tmp.obj.lookAt(tmp.v2);

      // frame the stop's object off-centre so its card never sits on top of it:
      // to the left on wide screens (card docks right), toward the top on
      // upright ones (card is a bottom sheet)
      const w = plan.hasCards ? scroll.near : 0;
      if (w > 0.001) {
        const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
        if (aspect >= 1) {
          const hHalf = Math.atan(Math.tan(vHalf) * aspect);
          tmp.obj.rotateY(-Math.atan(0.36 * Math.tan(hHalf)) * w);
        } else {
          tmp.obj.rotateX(-Math.atan(0.42 * Math.tan(vHalf)) * w);
        }
      }

      // bank into lateral movement
      tmp.v3.copy(camera.position).sub(prevPos.current).divideScalar(Math.max(dt, 1e-4));
      tmp.v4.set(1, 0, 0).applyQuaternion(camera.quaternion);
      const lateral = tmp.v3.dot(tmp.v4);
      const rollTarget = s.reducedMotion
        ? 0
        : THREE.MathUtils.clamp(-lateral * 0.018, -0.16, 0.16);
      roll.current += (rollTarget - roll.current) * Math.min(dt * 3, 1);
      tmp.obj.rotateZ(roll.current);

      easing.dampQ(camera.quaternion, tmp.obj.quaternion, follow, dt);
      syncAngles();

      // where the active stop's anchor lands on screen (for the leader line)
      const stop = plan.stops[Math.round(scroll.pos)];
      if (stop && plan.hasCards) {
        camera.updateMatrixWorld();
        tmp.v3.set(...stop.anchor).project(camera);
        T.anchorX = (tmp.v3.x * 0.5 + 0.5) * state.size.width;
        T.anchorY = (-tmp.v3.y * 0.5 + 0.5) * state.size.height;
        anchorVisible = tmp.v3.z < 1 && Math.abs(tmp.v3.x) < 1.1 && Math.abs(tmp.v3.y) < 1.1;
      }
    }

    T.hit *= Math.exp(-dt * 3.2);
    T.anchorVisible = anchorVisible;
    prevPos.current.copy(camera.position);
    T.pos.copy(camera.position);
  });

  return null;
}
