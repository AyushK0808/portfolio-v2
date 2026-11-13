import type { Jump } from '@/state/store';

/**
 * The shape of a hyperspace jump, seen from the cockpit, in three beats:
 *
 *   1. stretch — the lever is thrown and the stars pull into lines
 *   2. tunnel  — the blue-white swirl; the old location is swapped for the new
 *                one behind it, and this beat holds for as long as the
 *                destination is still loading
 *   3. exit    — snap out: the streaks collapse and the destination rushes up
 *
 * Beats 1 and 2 run off the jump's start time; beat 3 starts whenever the
 * JumpController decides the destination is ready (`exitStartedAt`).
 */

/** length of the stretch beat (ms) */
export const jumpInMs = (j: Jump) => Math.max(j.duration * 0.22, 380);
/** length of the exit beat (ms) */
export const jumpOutMs = (j: Jump) => (j.instant ? 60 : Math.max(j.duration * 0.22, 600));
/** earliest moment (ms after start) the exit beat may begin */
export const cruiseEndMs = (j: Jump) => j.duration * 0.78;

export interface JumpBeats {
  /** 0..1 — how far the stars are stretched into lines */
  streak: number;
  /** 0..1 — opacity of the tunnel swirl */
  tunnel: number;
  /** 0..1 — overall intensity (FOV punch, chromatic aberration) */
  env: number;
  /** 0..1 — white flash on entering and leaving the tunnel */
  flash: number;
  /** 0..1 — progress of the exit beat (0 until it starts) */
  exit: number;
  /** whether the location around the ship should be drawn */
  worldVisible: boolean;
}

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smooth = (x: number) => x * x * (3 - 2 * x);

export function jumpBeats(j: Jump, now: number, out: JumpBeats): JumpBeats {
  // reduced motion: no tunnel at all — the HUD dissolves to black instead
  if (j.instant) {
    out.streak = out.tunnel = out.env = out.flash = out.exit = 0;
    out.worldVisible = true;
    return out;
  }
  // deep-link entry: sit in the tunnel until the destination has loaded
  if (j.hold) {
    out.streak = 0.55;
    out.tunnel = 1;
    out.env = 1;
    out.flash = 0;
    out.exit = 0;
    out.worldVisible = false;
    return out;
  }

  if (j.exitStartedAt === null) {
    const inMs = jumpInMs(j);
    const t = now - j.startedAt;
    const a = clamp01(t / inMs);
    out.streak = smooth(a);
    out.tunnel = smooth(clamp01((a - 0.7) / 0.3));
    out.env = smooth(a);
    out.flash =
      t < inMs ? smooth(clamp01((a - 0.8) / 0.2)) * 0.7 : 0.7 * Math.exp(-(t - inMs) / 220);
    out.exit = 0;
    out.worldVisible = a < 1;
    // through the cruise a few streaks keep racing past the swirl
    if (a >= 1) out.streak = 0.55;
    return out;
  }

  const since = now - j.exitStartedAt;
  const b = clamp01(since / jumpOutMs(j));
  out.exit = b;
  out.tunnel = 1 - smooth(clamp01(b / 0.3));
  out.streak = 0.55 * (1 - smooth(clamp01(b / 0.6)));
  out.env = 1 - smooth(b);
  out.flash = 0.75 * Math.exp(-since / 240);
  out.worldVisible = true;
  return out;
}
