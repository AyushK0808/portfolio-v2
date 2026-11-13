/**
 * Scroll engine. The page itself never scrolls: wheel, touch drag and keys are
 * normalised into one signed input that moves the ship along the current
 * location's rail.
 *
 *  - glide: `pos` chases `target` with damping, so the ship visibly flies
 *  - snap:  shortly after input stops, `target` eases to the nearest stop
 *           (biased in the direction of travel, so one wheel notch advances)
 *  - charge: input past either end of the rail fills `charge`; when it is full
 *           the hyperdrive fires. The fill is rate-limited and only starts once
 *           the ship has come to rest on the end stop, so the tail of a trackpad
 *           flick cannot trigger a jump by itself.
 *
 * This module holds plain mutable state (read every frame by the camera and the
 * HUD) and knows nothing about the store; the store wires itself in through the
 * `on*` callbacks and `setBounds`.
 */

/** scroll distance (px) that moves the ship one stop */
const PX_PER_STOP = 320;
/** quiet time (ms) after the last input before the ship settles on a stop */
const SNAP_DELAY = 150;
/** how fast `pos` chases `target` (1/s) */
const GLIDE_RATE = 6.5;
/** overscroll (px) needed for a full charge */
const CHARGE_PX = 380;
/** ceiling on how fast overscroll converts to charge (px/s) → ~0.85s minimum */
const CHARGE_RATE = 450;
/** time (ms) the ship must rest on an end stop before charging can start */
const CHARGE_GRACE = 380;
/** quiet time (ms) before an unfinished charge starts draining */
const DRAIN_DELAY = 260;
/** drain speed (charge units per second) */
const DRAIN_RATE = 1.6;
/** how close (in stops) counts as "resting on" a stop */
const AT_STOP = 0.08;
/** input ignored for this long (ms) after an arrival, so the gesture that
 *  triggered the jump cannot also fly the ship onward when it lands */
const ARRIVAL_GRACE = 700;

export const scroll = {
  /** smoothed rail parameter — whole numbers are stops */
  pos: 0,
  /** where input wants the ship to be */
  target: 0,
  /** hyperdrive charge, 0..1 */
  charge: 0,
  /** which way the charge will jump: +1 next location, -1 previous */
  chargeDir: 0 as -1 | 0 | 1,
  /** 1 when resting on a stop, 0 halfway between two (drives card fade) */
  near: 1,
  /** true while input should be ignored (intro, jumps, map open, free flight) */
  locked: true,

  /** fired when the charge fills */
  onFire: null as ((dir: 1 | -1) => void) | null,
  /** fired when the nearest stop changes */
  onStop: null as ((index: number) => void) | null,
  /** fired on forward input while locked — lets the title screen start by scroll */
  onLockedForward: null as (() => void) | null,
};

// private state
let max = 0; // index of the last stop
let canForward = false;
let canBack = false;
let pending = 0; // overscroll px waiting to be converted into charge
let lastInputAt = 0;
let lastDir: 1 | -1 = 1;
let restingSince = 0; // when the ship came to rest on an end stop (0 = it has not)
let lastStop = 0;
let ignoreUntil = 0; // arrival grace

/** describe the current location's rail; called by the store on every arrival */
export function setBounds(stopCount: number, forward: boolean, back: boolean) {
  max = Math.max(stopCount - 1, 0);
  canForward = stopCount > 0 && forward;
  canBack = stopCount > 0 && back;
}

/** put the ship on a stop with no glide (arrivals) */
export function resetTo(index: number) {
  const i = Math.min(Math.max(index, 0), max);
  scroll.pos = i;
  scroll.target = i;
  scroll.charge = 0;
  scroll.chargeDir = 0;
  scroll.near = 1;
  pending = 0;
  restingSince = 0;
  lastStop = i;
  ignoreUntil = performance.now() + ARRIVAL_GRACE;
}

/** glide to a specific stop (stop rail, in-world markers) */
export function goTo(index: number) {
  if (scroll.locked) return;
  scroll.target = Math.min(Math.max(index, 0), max);
  lastInputAt = performance.now();
  lastDir = scroll.target >= scroll.pos ? 1 : -1;
  cancelCharge();
}

function cancelCharge() {
  pending = 0;
  scroll.charge = 0;
  scroll.chargeDir = 0;
}

/** feed overscroll toward a charge, if a jump exists that way and the ship is at rest */
function overscroll(px: number, dir: 1 | -1, now: number) {
  const allowed = dir === 1 ? canForward : canBack;
  if (!allowed) return;
  if (restingSince === 0 || now - restingSince < CHARGE_GRACE) return;
  if (scroll.chargeDir !== dir) {
    scroll.charge = 0;
    pending = 0;
    scroll.chargeDir = dir;
  }
  pending += px;
}

/** one signed scroll input, in pixels (positive = forward along the route) */
export function input(dy: number) {
  if (dy === 0) return;
  if (scroll.locked) {
    if (dy > 0) scroll.onLockedForward?.();
    return;
  }
  const now = performance.now();
  if (now < ignoreUntil) return;
  const dir: 1 | -1 = dy > 0 ? 1 : -1;
  lastInputAt = now;
  lastDir = dir;

  const next = scroll.target + dy / PX_PER_STOP;
  if (next > max) {
    scroll.target = max;
    overscroll((next - max) * PX_PER_STOP, 1, now);
  } else if (next < 0) {
    scroll.target = 0;
    overscroll(-next * PX_PER_STOP, -1, now);
  } else {
    scroll.target = next;
    cancelCharge(); // moving back along the rail abandons a half-built charge
  }
}

/** one keyboard step (arrow keys, Page Up/Down, Space) */
export function step(dir: 1 | -1) {
  if (scroll.locked) {
    if (dir === 1) scroll.onLockedForward?.();
    return;
  }
  const now = performance.now();
  if (now < ignoreUntil) return;
  const base = Math.round(scroll.target);
  const next = base + dir;
  lastInputAt = now;
  lastDir = dir;
  if (next > max || next < 0) {
    // a key press past the end is a firm nudge toward the jump
    overscroll(150, dir, now);
    return;
  }
  scroll.target = next;
  cancelCharge();
}

/** where the ship settles when input stops */
function snapIndex(target: number, dir: 1 | -1): number {
  const base = Math.floor(target);
  const frac = target - base;
  if (frac < 1e-4) return base;
  if (dir === 1) return frac > 0.16 ? base + 1 : base;
  return frac < 0.84 ? base : base + 1;
}

/** advance the engine one frame; called from the render loop */
export function tick(dt: number) {
  if (scroll.locked) return;
  const now = performance.now();
  const quiet = now - lastInputAt;

  // snap
  if (quiet > SNAP_DELAY) {
    scroll.target = Math.min(Math.max(snapIndex(scroll.target, lastDir), 0), max);
  }

  // glide
  scroll.pos += (scroll.target - scroll.pos) * (1 - Math.exp(-GLIDE_RATE * dt));
  if (Math.abs(scroll.target - scroll.pos) < 0.0005) scroll.pos = scroll.target;

  // how close to a stop: 1 within ~0.1 of it, 0 by ~0.45 away
  const nearest = Math.round(scroll.pos);
  const d = Math.abs(scroll.pos - nearest);
  const x = Math.min(Math.max((d - 0.1) / 0.35, 0), 1);
  scroll.near = 1 - x * x * (3 - 2 * x);

  if (nearest !== lastStop) {
    lastStop = nearest;
    scroll.onStop?.(nearest);
  }

  // resting on an end stop is the precondition for charging
  const atEnd =
    (Math.abs(scroll.pos - max) < AT_STOP && scroll.target === max) ||
    (Math.abs(scroll.pos) < AT_STOP && scroll.target === 0);
  if (atEnd) {
    if (restingSince === 0) restingSince = now;
  } else {
    restingSince = 0;
    if (scroll.charge > 0 || pending > 0) cancelCharge();
  }

  // charge: convert banked overscroll at a capped rate, drain when idle
  if (pending > 0 && scroll.chargeDir !== 0) {
    const take = Math.min(pending, CHARGE_RATE * dt);
    pending -= take;
    scroll.charge += take / CHARGE_PX;
    pending *= Math.exp(-dt * 5); // leftover flick inertia fades rather than banks
    if (pending < 0.5) pending = 0;
  }
  if (quiet > DRAIN_DELAY && scroll.charge > 0) {
    scroll.charge = Math.max(0, scroll.charge - DRAIN_RATE * dt);
    if (scroll.charge === 0) scroll.chargeDir = 0;
  }
  if (scroll.charge >= 1 && scroll.chargeDir !== 0) {
    const dir = scroll.chargeDir;
    cancelCharge();
    scroll.onFire?.(dir);
  }
}

/**
 * Attach wheel / touch / key listeners. Returns a cleanup function.
 * Keys typed into form fields are left alone.
 */
export function attachScrollInput(): () => void {
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) return; // pinch-zoom / browser zoom
    // normalise line/page deltas (Firefox, some mice) to pixels
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    input(e.deltaY * unit);
  };

  // touch: finger moving up the screen = forward, like scrolling a page
  let touchId: number | null = null;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0; // px/ms, smoothed
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) {
      touchId = null;
      return;
    }
    const t = e.touches[0];
    touchId = t.identifier;
    lastY = t.clientY;
    lastT = performance.now();
    velocity = 0;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (touchId === null) return;
    const t = Array.from(e.touches).find((x) => x.identifier === touchId);
    if (!t) return;
    const now = performance.now();
    const dy = lastY - t.clientY;
    const dtMs = Math.max(now - lastT, 1);
    velocity = velocity * 0.6 + (dy / dtMs) * 0.4;
    lastY = t.clientY;
    lastT = now;
    input(dy * 1.5);
  };
  const onTouchEnd = () => {
    if (touchId === null) return;
    touchId = null;
    // a short fling carries on in the same direction
    if (Math.abs(velocity) > 0.35) input(velocity * 140);
    velocity = 0;
  };

  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    const tag = el?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    switch (e.code) {
      case 'ArrowDown':
      case 'PageDown':
        step(1);
        break;
      case 'Space':
        // on a focused button, Space is a click — leave it alone
        if (tag === 'BUTTON' || tag === 'A') return;
        step(e.shiftKey ? -1 : 1);
        break;
      case 'ArrowUp':
      case 'PageUp':
        step(-1);
        break;
      case 'Home':
        goTo(0);
        break;
      case 'End':
        goTo(max);
        break;
      default:
        return;
    }
  };

  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    window.removeEventListener('keydown', onKey);
  };
}
