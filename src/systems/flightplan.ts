import * as THREE from 'three';
import { LocationId } from '@/lib/theme';
import { WORK } from '@/content/experience';
import { PROJECTS } from '@/content/projects';
import { SKILLS } from '@/content/skills';
import { ACHIEVEMENTS } from '@/content/achievements';

/**
 * Central flight plan: where things sit in each location, where the ship parks
 * to look at them, and the rail the camera glides along between those parks.
 * Locations import object positions from here so the camera and the world can
 * never disagree.
 */

export type V3 = [number, number, number];

export interface Pose {
  pos: V3;
  look: V3;
}

/** one place the ship comes to rest inside a location */
export interface Stop {
  id: string;
  /** short name for the stop rail and in-world marker */
  label: string;
  /** where the ship parks, and what it faces */
  pose: Pose;
  /** the world object the content card points at */
  anchor: V3;
}

export interface LocationPlan {
  /** where the camera is placed when arriving from the previous location */
  entry: Pose;
  /** where the camera is placed when arriving backwards, from the next one */
  exit: Pose;
  /** empty for places that are not scrolled through (game, contact) */
  stops: Stop[];
  /** whether stops show a content card (the hub's single stop does not) */
  hasCards: boolean;
}

const lift = (p: V3, dy: number, dz: number): V3 => [p[0], p[1] + dy, p[2] + dz];

// ── HUB: the cockpit, parked in open space ──
export const HUB_PANEL_POS: V3 = [0, 1.6, -3.2];

// ── the hero ship, seen from outside on the title screen and while boarding ──
/** hull length in world units (the model is scaled to this) */
export const SHIP_FIT = 15;
/**
 * Where the hull's centre rests. Chosen so the exterior model's canopy sits
 * exactly on the hub's seat pose ([0, 1.2, 0], facing -Z): the boarding shot
 * ends inside the real canopy, and the swap to the cockpit happens in place.
 */
export const SHIP_POS: V3 = [0, 0.95, 4.71];

// ── ABOUT: home station + the pilot record floating off its bow ──
export const STATION_POS: V3 = [0, -1, -30];
export const PILOT_ID_POS: V3 = [-4.6, 1.9, -14];
/** "how I work": a gimbal instrument off the station's starboard side */
export const GIMBAL_POS: V3 = [8, 1.5, -17];
/** "interests": a small orrery high off the port side, the home world behind it */
export const ORRERY_POS: V3 = [-9, 5.5, -22];

// ── SKILLS: five docks on an arc around the yard ──
export const YARD_POS: V3 = [0, -2, -36];
const YARD_RADIUS = 13;
export const DOCK_NODES = SKILLS.map((s, i) => {
  const n = SKILLS.length;
  const a = (-0.42 + (0.84 * i) / (n - 1)) * Math.PI; // -76° → +76°
  const dir: V3 = [Math.sin(a), 0, Math.cos(a)];
  const pos: V3 = [
    YARD_POS[0] + dir[0] * YARD_RADIUS,
    1.0 + Math.sin(i * 1.7) * 0.9,
    YARD_POS[2] + dir[2] * YARD_RADIUS,
  ];
  // park radially outward so each dock faces the ship
  const park: V3 = [pos[0] + dir[0] * 6.4, pos[1] + 0.3, pos[2] + dir[2] * 6.4];
  return { id: s.id, label: s.system, pos, park };
});

// ── EXPERIENCE: outposts strung down the approach lane ──
export const LANE_NODES = WORK.map((e, i) => ({
  id: e.id,
  label: e.org,
  pos: [Math.sin(i * 1.15) * 7, Math.cos(i * 0.9) * 2.2, -12 - i * 15] as V3,
}));

// ── PROJECTS: five builds adrift in the belt, then the GitHub beacon ──
export const GITHUB_STOP_ID = 'github';
export const DRIFT_NODES = [
  ...PROJECTS.map((p) => ({ id: p.id, label: p.title })),
  { id: GITHUB_STOP_ID, label: 'MORE ON GITHUB' },
].map((n, i) => ({
  ...n,
  pos: [Math.sin(i * 1.25 + 0.6) * 6.5, Math.cos(i * 1.05) * 2.6, -14 - i * 11] as V3,
}));

// ── ACHIEVEMENTS: beacons climbing away from the ship ──
export const BEACON_NODES = ACHIEVEMENTS.map((a, i) => ({
  id: a.id,
  label: a.beacon,
  pos: [(i % 2 === 0 ? -1 : 1) * (4 + i * 0.6), -1.5 + i * 2.4, -14 - i * 13] as V3,
}));

// ── COMMS: the relay dish, holding station ahead ──
export const RELAY_POS: V3 = [0, 2.4, -15];

function buildPlans(): Record<LocationId, LocationPlan> {
  const parked = (
    nodes: { id: string; label: string; pos: V3 }[],
    dy: number,
    dz: number,
  ): Stop[] =>
    nodes.map((n) => ({
      id: n.id,
      label: n.label,
      pose: { pos: lift(n.pos, dy, dz), look: n.pos },
      anchor: n.pos,
    }));

  const plans: Record<LocationId, Omit<LocationPlan, 'exit'>> = {
    HUB: {
      entry: { pos: [0, 1.2, 0], look: [0, 1.35, -4] },
      stops: [
        {
          id: 'hub',
          label: 'COCKPIT',
          pose: { pos: [0, 1.2, 0], look: [0, 1.35, -4] },
          anchor: HUB_PANEL_POS,
        },
      ],
      hasCards: false,
    },
    ABOUT: {
      entry: { pos: [0, 1.4, 3], look: STATION_POS },
      stops: [
        {
          id: 'pilot-id',
          label: 'PILOT RECORD',
          pose: { pos: [PILOT_ID_POS[0] + 1.2, PILOT_ID_POS[1], PILOT_ID_POS[2] + 4.6], look: PILOT_ID_POS },
          anchor: PILOT_ID_POS,
        },
        {
          id: 'origin',
          label: 'ORIGIN',
          pose: { pos: [4, 3.2, -9], look: STATION_POS },
          anchor: STATION_POS,
        },
        {
          id: 'method',
          label: 'HOW I WORK',
          pose: { pos: [4.4, 2.2, -10.6], look: GIMBAL_POS },
          anchor: GIMBAL_POS,
        },
        {
          id: 'interests',
          label: 'INTERESTS',
          pose: { pos: [-5.5, 5.2, -17.5], look: ORRERY_POS },
          anchor: ORRERY_POS,
        },
      ],
      hasCards: true,
    },
    SKILLS: {
      entry: { pos: [-6, 1.6, 4], look: YARD_POS },
      stops: DOCK_NODES.map((n) => ({
        id: n.id,
        label: n.label,
        pose: { pos: n.park, look: n.pos },
        anchor: n.pos,
      })),
      hasCards: true,
    },
    EXPERIENCE: {
      entry: { pos: [0, 1.2, 2], look: LANE_NODES[0].pos },
      stops: parked(LANE_NODES, 0.6, 7.6),
      hasCards: true,
    },
    PROJECTS: {
      entry: { pos: [0, 1.5, 4], look: DRIFT_NODES[0].pos },
      stops: parked(DRIFT_NODES, 0.5, 6.4),
      hasCards: true,
    },
    ACHIEVEMENTS: {
      entry: { pos: [0, 0.2, 2], look: BEACON_NODES[0].pos },
      stops: parked(BEACON_NODES, 0.9, 6.6),
      hasCards: true,
    },
    ARENA: {
      entry: { pos: [0, 1.2, 0], look: [0, 1.2, -10] },
      stops: [],
      hasCards: false,
    },
    // not scrolled through, but its one stop lets the camera frame the relay
    // beside the contact card exactly as it frames any other stop
    COMMS: {
      entry: { pos: [0, 1.3, 4], look: RELAY_POS },
      stops: [
        {
          id: 'relay',
          label: 'RELAY',
          pose: { pos: [0, 1.3, 0], look: RELAY_POS },
          anchor: RELAY_POS,
        },
      ],
      hasCards: true,
    },
  };

  // arriving backwards: start a little past the last stop and reverse in
  const withExit = (p: Omit<LocationPlan, 'exit'>): LocationPlan => {
    const n = p.stops.length;
    if (n < 2) return { ...p, exit: p.entry };
    const last = new THREE.Vector3(...p.stops[n - 1].pose.pos);
    const prev = new THREE.Vector3(...p.stops[n - 2].pose.pos);
    const beyond = last.clone().add(last.clone().sub(prev).normalize().multiplyScalar(7));
    return {
      ...p,
      exit: { pos: [beyond.x, beyond.y, beyond.z], look: p.stops[n - 1].anchor },
    };
  };

  return Object.fromEntries(
    Object.entries(plans).map(([id, p]) => [id, withExit(p)]),
  ) as Record<LocationId, LocationPlan>;
}

export const FLIGHT = buildPlans();

// ── rails: one spline through the park positions, one through the look-ats ──

interface Rail {
  pos: THREE.CatmullRomCurve3;
  look: THREE.CatmullRomCurve3;
}

const RAILS: Partial<Record<LocationId, Rail>> = {};
for (const [id, plan] of Object.entries(FLIGHT) as [LocationId, LocationPlan][]) {
  if (plan.stops.length < 2) continue;
  RAILS[id] = {
    pos: new THREE.CatmullRomCurve3(plan.stops.map((s) => new THREE.Vector3(...s.pose.pos))),
    look: new THREE.CatmullRomCurve3(plan.stops.map((s) => new THREE.Vector3(...s.pose.look))),
  };
}

/**
 * Camera pose at rail parameter `t`, where every whole number is a stop
 * (0 = first stop, n-1 = last). CatmullRomCurve3.getPoint is parametrised by
 * control point, so t / (n-1) lands exactly on stop poses.
 */
export function railPose(
  location: LocationId,
  t: number,
  outPos: THREE.Vector3,
  outLook: THREE.Vector3,
): void {
  const plan = FLIGHT[location];
  const n = plan.stops.length;
  const rail = RAILS[location];
  if (n === 0) {
    outPos.set(...plan.entry.pos);
    outLook.set(...plan.entry.look);
    return;
  }
  if (!rail) {
    outPos.set(...plan.stops[0].pose.pos);
    outLook.set(...plan.stops[0].pose.look);
    return;
  }
  const u = THREE.MathUtils.clamp(t / (n - 1), 0, 1);
  rail.pos.getPoint(u, outPos);
  rail.look.getPoint(u, outLook);
}

/** warp intensity envelope: 0→1→0 over the transition (drives FOV + CA + tunnel) */
export function warpEnvelope(startedAt: number, now: number, dur: number): number {
  const p = (now - startedAt) / dur;
  if (p <= 0 || p >= 1) return 0;
  const inRamp = Math.min(p / 0.27, 1);
  const outRamp = Math.min((1 - p) / 0.27, 1);
  const s = (x: number) => x * x * (3 - 2 * x);
  return s(inRamp) * s(outRamp);
}
