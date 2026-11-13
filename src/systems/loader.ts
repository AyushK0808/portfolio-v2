import { useProgress } from '@react-three/drei';

/**
 * The opening hyperspace doubles as the loading screen. On a fast connection
 * the assets arrive in well under a second, which would cut the tunnel before
 * anyone has seen it — so the loader always runs for at least this long, and
 * its percent readout is paced to fill over the same time.
 */
export const LOADER_MIN_MS = 3000;

let startedAt = 0;
let assetsIn = false;

/** start the loader's clock (idempotent — the first call wins) */
export function startLoaderClock(): void {
  if (!startedAt) startedAt = performance.now();
}

/** the assets the loader waits on have arrived; only the clock is left */
export function loaderAssetsIn(): void {
  assetsIn = true;
}

/** ms the loader still has to run before it may drop out of the tunnel */
export function loaderRemainingMs(reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  startLoaderClock();
  return Math.max(0, LOADER_MIN_MS - (performance.now() - startedAt));
}

/** 0..1 — real load progress, held back so it never outruns the minimum time */
export function loaderProgress(): number {
  startLoaderClock();
  const real = assetsIn ? 1 : Math.min(Math.max(useProgress.getState().progress / 100, 0), 1);
  const clock = Math.min((performance.now() - startedAt) / LOADER_MIN_MS, 1);
  return Math.min(real, clock);
}
