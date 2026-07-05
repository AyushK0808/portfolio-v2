import { SectorId } from '@/lib/theme';
import { EXPERIENCE } from '@/content/experience';
import { PROJECTS } from '@/content/projects';
import { GALLERY } from '@/content/gallery';
import { MISSION_ORDER } from '@/lib/theme';

/**
 * Central flight plan: where things sit in each sector and where the
 * autopilot parks the ship to look at them. Sectors import object positions
 * from here so the camera and the world can never disagree.
 */

export type V3 = [number, number, number];

export interface Pose {
  pos: V3;
  look: V3;
}

// ── BRIDGE: holographic mission dial, arc above the dashboard ──
export const DIAL_NODES = MISSION_ORDER.map((id, i) => {
  const n = MISSION_ORDER.length;
  const spread = Math.PI * 0.52; // arc width
  const a = -spread / 2 + (spread * i) / (n - 1);
  const r = 3.1;
  return {
    id,
    pos: [Math.sin(a) * r, 1.45 + Math.cos(a * 2.2) * 0.12, -Math.cos(a) * r] as V3,
  };
});

// ── Mission A: home station + two content POIs ──
export const STATION_POS: V3 = [0, -1, -30];
export const DOSSIER_POS: V3 = [-4.6, 1.9, -14];
export const SUBSYS_POS: V3 = [5.4, 1.6, -15];

// ── Mission B: corridor outposts strung down -Z ──
export const CORRIDOR_NODES = EXPERIENCE.map((e, i) => ({
  id: e.id,
  pos: [
    Math.sin(i * 1.15) * 7,
    Math.cos(i * 0.9) * 2.2,
    -12 - i * 15,
  ] as V3,
}));

// ── Mission C: debris field, loose spiral cloud ──
export const ARTIFACT_NODES = PROJECTS.map((p, i) => {
  const a = i * 2.39996; // golden angle
  const r = 5.5 + i * 1.45;
  return {
    id: p.id,
    pos: [
      Math.cos(a) * r,
      Math.sin(i * 2.1) * 3.6,
      -15 - i * 3.4,
    ] as V3,
  };
});

// ── Mission D: observation ring around the viewer ──
export const RING_CENTER: V3 = [0, 1.3, -12];
export const RING_RADIUS = 7;
export const GALLERY_NODES = GALLERY.map((g, i) => {
  const a = (i / GALLERY.length) * Math.PI * 2;
  return {
    id: g.id,
    angle: a,
    pos: [
      RING_CENTER[0] + Math.sin(a) * RING_RADIUS,
      RING_CENTER[1] + Math.sin(a * 2) * 0.5,
      RING_CENTER[2] + Math.cos(a) * RING_RADIUS,
    ] as V3,
  };
});

// ── Contact: comms console dead ahead ──
export const CONSOLE_POS: V3 = [0, 1.35, -3.6];

const lift = (p: V3, dy: number, dz: number): V3 => [p[0], p[1] + dy, p[2] + dz];

function buildFlight(): Record<SectorId, { entry: Pose; pois: Record<string, Pose> }> {
  const pois = <T extends { id: string; pos: V3 }>(
    nodes: T[],
    dy: number,
    dz: number,
  ): Record<string, Pose> =>
    Object.fromEntries(
      nodes.map((n) => [n.id, { pos: lift(n.pos, dy, dz), look: n.pos }]),
    );

  return {
    BRIDGE: {
      entry: { pos: [0, 1.2, 0], look: [0, 1.35, -4] },
      pois: {},
    },
    A: {
      entry: { pos: [0, 1.4, 3], look: STATION_POS },
      pois: {
        dossier: { pos: lift(DOSSIER_POS, 0, 4.4), look: DOSSIER_POS },
        subsystems: { pos: lift(SUBSYS_POS, 0.1, 5.2), look: SUBSYS_POS },
        station: { pos: [0, 2.5, -12], look: STATION_POS },
      },
    },
    B: {
      entry: { pos: [0, 1.2, 2], look: CORRIDOR_NODES[0].pos },
      pois: pois(CORRIDOR_NODES, 0.5, 6.2),
    },
    C: {
      entry: { pos: [0, 1.5, 6], look: [0, 0, -30] },
      pois: pois(ARTIFACT_NODES, 0.4, 5.4),
    },
    D: {
      entry: { pos: RING_CENTER, look: GALLERY_NODES[0].pos },
      pois: Object.fromEntries(
        GALLERY_NODES.map((n) => {
          // park between ring center and the frame, at focus distance
          const dx = n.pos[0] - RING_CENTER[0];
          const dz = n.pos[2] - RING_CENTER[2];
          const len = Math.hypot(dx, dz);
          const d = (RING_RADIUS - 2.1) / len;
          return [
            n.id,
            {
              pos: [
                RING_CENTER[0] + dx * d,
                n.pos[1],
                RING_CENTER[2] + dz * d,
              ] as V3,
              look: n.pos,
            },
          ];
        }),
      ),
    },
    E: {
      entry: { pos: [0, 1.2, 0], look: [0, 1.2, -10] },
      pois: {},
    },
    CONTACT: {
      entry: { pos: [0, 1.3, -0.4], look: CONSOLE_POS },
      pois: {},
    },
  };
}

export const FLIGHT = buildFlight();

/** POI visit order per sector — drives the HUD PREV/NEXT autopilot controls */
export const POI_ORDER: Record<SectorId, string[]> = {
  BRIDGE: [],
  A: ['dossier', 'subsystems', 'station'],
  B: EXPERIENCE.map((e) => e.id),
  C: PROJECTS.map((p) => p.id),
  D: GALLERY.map((g) => g.id),
  E: [],
  CONTACT: [],
};

/** warp intensity envelope: 0→1→0 over the transition (drives FOV + CA + tunnel) */
export function warpEnvelope(startedAt: number, now: number, dur: number): number {
  const p = (now - startedAt) / dur;
  if (p <= 0 || p >= 1) return 0;
  const inRamp = Math.min(p / 0.27, 1);
  const outRamp = Math.min((1 - p) / 0.27, 1);
  const s = (x: number) => x * x * (3 - 2 * x);
  return s(inRamp) * s(outRamp);
}
