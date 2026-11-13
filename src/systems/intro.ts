/**
 * Timing for the cold open and the boarding shot, shared by the camera, the
 * hero ship and the HUD so they can never drift apart.
 *
 * Cold open (after the loader's tunnel drops away):
 *   the ship appears far astern as a streak, decelerates hard, passes the
 *   camera and comes to rest; the title lands as it passes.
 */

/** tunnel → still starfield, before the ship appears (s) */
export const ARRIVAL_DELAY = 0.35;
/** how long the ship takes to come to rest (s) */
export const ARRIVAL_TIME = 2.6;
/** when the title lands, measured from the start of the intro (s) */
export const TITLE_AT = ARRIVAL_DELAY + 1.25;
/** when the camera leaves its fixed vantage point for the slow orbit (s) */
export const ORBIT_AT = ARRIVAL_DELAY + ARRIVAL_TIME + 0.4;
/** how far astern the ship drops out of hyperspace (world units) */
const ARRIVAL_DISTANCE = 420;

/**
 * The ship's state `t` seconds into the intro: how far behind its resting
 * place it still is (it flies toward -Z, so this is a +Z offset), how stretched
 * it is, and whether it has appeared yet.
 */
export function arrival(t: number): { offset: number; stretch: number; visible: boolean; done: boolean } {
  const u = (t - ARRIVAL_DELAY) / ARRIVAL_TIME;
  if (u < 0) return { offset: ARRIVAL_DISTANCE, stretch: 1, visible: false, done: false };
  if (u >= 1) return { offset: 0, stretch: 1, visible: true, done: true };
  // exponential deceleration: most of the distance is shed in the first third
  return {
    offset: ARRIVAL_DISTANCE * Math.pow(2, -10 * u) * (1 - u),
    stretch: 1 + 22 * Math.pow(2, -14 * u),
    visible: true,
    done: false,
  };
}

/** length of the boarding shot (ms) */
export const BOARDING_MS = 6400;
/** fraction of the boarding shot at which the camera passes through the canopy glass */
export const CANOPY_AT = 0.84;
