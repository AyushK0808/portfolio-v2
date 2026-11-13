import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DUR, LOCATIONS, LocationId, ROUTE } from '@/lib/theme';
import { audio } from '@/systems/audio';
import { FLIGHT } from '@/systems/flightplan';
import { pushLocation } from '@/systems/router';
import { goTo, resetTo, scroll, setBounds } from '@/systems/scroll';
import { BOARDING_MS } from '@/systems/intro';
import { loaderAssetsIn, loaderRemainingMs } from '@/systems/loader';

/**
 * Explicit finite state machine for the whole experience:
 *
 *   INTRO → BOARDING → FLIGHT ⇄ JUMP
 *
 * FLIGHT always has a `location`; where the ship is along that location's rail
 * lives in the scroll engine (`scroll.pos`), with the nearest stop mirrored
 * here as `stop` for the UI. A deep link skips straight to JUMP → FLIGHT.
 */
export type Phase = 'INTRO' | 'BOARDING' | 'FLIGHT' | 'JUMP';

export type NavMode = 'AUTO' | 'MANUAL';
/**
 * Graphics tiers. The same scene at every tier; what changes is cost:
 *   CINEMATIC   — full post-processing, full resolution
 *   PERFORMANCE — lighter post-processing, capped resolution
 *   LITE        — no post-processing, 1x resolution
 */
export type Quality = 'CINEMATIC' | 'PERFORMANCE' | 'LITE';
export const QUALITY_ORDER: Quality[] = ['CINEMATIC', 'PERFORMANCE', 'LITE'];

export interface Jump {
  from: LocationId;
  to: LocationId;
  /** wall-clock ms when the jump started (drives the tunnel + FOV ramps) */
  startedAt: number;
  /** minimum length in ms; the jump holds longer if the destination is still loading */
  duration: number;
  /** land on the destination's first stop, or (scrolling backwards) its last */
  arrive: 'start' | 'end';
  /** record the arrival in browser history (false when Back/Forward caused it) */
  pushHistory: boolean;
  /** deep-link entry: the clock does not start until the destination has loaded */
  hold: boolean;
  /** wall-clock ms when the exit beat (snap out of the tunnel) began; null until then */
  exitStartedAt: number | null;
  /** reduced motion: no tunnel, a quick dissolve instead */
  instant: boolean;
}

interface JumpOptions {
  arrive?: 'start' | 'end';
  /** true when scrolling triggered it — only those can be the long first jump */
  fromScroll?: boolean;
  pushHistory?: boolean;
}

interface AppState {
  phase: Phase;
  /** location currently mounted in the 3D world */
  location: LocationId;
  /** the jump in progress (valid during JUMP) */
  jump: Jump | null;
  /** nearest stop on the current rail — the one whose card is showing */
  stop: number;
  /** wall-clock ms when BOARDING began (drives the boarding camera flight) */
  boardingStartedAt: number;
  /** true once the first assets are in and the loader's tunnel may drop away */
  loaded: boolean;
  /** wall-clock ms when the cold open began (the moment `loaded` flipped) */
  introStartedAt: number;
  /** true once the ship has passed the camera and the title may land */
  titleUp: boolean;
  /** id of the object currently under the pointer */
  hovered: string | null;

  /** locations the visitor has arrived at this session (hub excluded) */
  visited: LocationId[];
  /** the long, full-length jump is used once: the first scroll out of the hub */
  firstJumpDone: boolean;
  mapOpen: boolean;
  /** true while the "route complete" beat is on screen */
  finale: boolean;

  navMode: NavMode;
  quality: Quality;
  /** true until the visitor picks a tier by hand; while true the frame-rate
   *  monitor may step the tier down */
  qualityAuto: boolean;
  /** wall-clock ms when the ship last came to rest (arrivals, boarding) */
  settledAt: number;
  muted: boolean;
  reducedMotion: boolean;

  /** the game: waiting to start, a run in progress, or the score screen */
  arenaState: 'READY' | 'PLAYING' | 'OVER';
  arenaWave: number;
  /** hits the hull can still take (a run starts with 3) */
  arenaHull: number;
  arenaScore: number;
  arenaBest: number;
  /** all-time global best pulled from / pushed to the KV-backed leaderboard */
  arenaGlobalBest: number;

  /** true once the hero ship GLB has loaded and is on screen (gates the
   *  initial loading screen on a normal start) */
  shipLoaded: boolean;
  /** true once the mounted location's component + assets have loaded. Reset at
   *  the start of every jump so the tunnel keeps running as a loader. */
  locationReady: boolean;
  /** true while the standalone 3D ship inspection view is open */
  shipView: boolean;

  // ── actions ──
  /** INTRO → BOARDING. `withSound`: started by a click/tap, which is the only
   *  gesture browsers accept for audio — so that is when sound comes on */
  board: (withSound?: boolean) => void;
  skipIntro: () => void; // straight to the hub
  seated: () => void; // BOARDING → FLIGHT (hub)
  /** start already in hyperspace toward a deep-linked location */
  enterAt: (to: LocationId) => void;
  jumpTo: (to: LocationId, opts?: JumpOptions) => void;
  /** mid-jump: swap the mounted location under cover of the tunnel */
  swapLocation: () => void;
  /** the destination is ready: start the snap out of the tunnel */
  beginExit: () => void;
  markLoaded: () => void;
  raiseTitle: () => void;
  /** release a held (deep-link) jump once its destination has loaded */
  releaseHold: () => void;
  arrive: () => void; // JUMP → FLIGHT
  /** the hyperdrive charge filled: +1 next on the route, -1 previous */
  chargeFired: (dir: 1 | -1) => void;
  goToStop: (index: number) => void;
  setStop: (index: number) => void;
  setHovered: (id: string | null) => void;
  openMap: () => void;
  closeMap: () => void;
  setNavMode: (m: NavMode) => void;
  toggleMute: () => void;
  /** `manual`: chosen by the visitor, which switches the automatic stepping off */
  setQuality: (q: Quality, manual?: boolean) => void;
  /** the frame rate is suffering: drop one tier (only while automatic) */
  stepQualityDown: () => void;
  setReducedMotion: (v: boolean) => void;
  startArena: () => void;
  /** a rock reached the ship */
  arenaHit: () => void;
  arenaNextWave: () => void;
  /** back to the start screen (leaving the range) */
  resetArena: () => void;
  addScore: (n: number) => void;
  setArenaGlobalBest: (n: number) => void;
  setShipLoaded: (v: boolean) => void;
  setLocationReady: (v: boolean) => void;
  openShipView: () => void;
  closeShipView: () => void;
}

/** tell the scroll engine about the rail we just landed on */
function armRail(location: LocationId, stop: number) {
  const i = ROUTE.indexOf(location);
  const onRoute = i >= 0;
  // forward always exists on the route (the last stop leads to the finale);
  // backward exists everywhere except the hub
  setBounds(FLIGHT[location].stops.length, onRoute, onRoute && i > 0);
  resetTo(stop);
}

export const useApp = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    phase: 'INTRO',
    location: 'HUB',
    jump: null,
    stop: 0,
    boardingStartedAt: 0,
    loaded: false,
    introStartedAt: 0,
    titleUp: false,
    hovered: null,

    visited: [],
    firstJumpDone: false,
    mapOpen: false,
    finale: false,

    navMode: 'AUTO',
    quality: 'CINEMATIC',
    qualityAuto: true,
    settledAt: 0,
    muted: true,
    reducedMotion: false,

    arenaState: 'READY',
    arenaWave: 1,
    arenaHull: 3,
    arenaScore: 0,
    arenaBest: 0,
    arenaGlobalBest: 0,

    shipLoaded: false,
    locationReady: false,
    shipView: false,

    board: (withSound = false) => {
      if (get().phase !== 'INTRO') return;
      audio.unlock();
      if (withSound && get().muted) {
        audio.setMuted(false);
        set({ muted: false });
      }
      audio.powerUp();
      set({ phase: 'BOARDING', boardingStartedAt: performance.now() });
      const dur = get().reducedMotion ? 400 : BOARDING_MS;
      window.setTimeout(() => get().seated(), dur);
    },

    skipIntro: () => {
      const { phase } = get();
      if (phase !== 'INTRO' && phase !== 'BOARDING') return;
      audio.unlock();
      armRail('HUB', 0);
      set({ phase: 'FLIGHT', location: 'HUB', stop: 0, settledAt: performance.now() });
      audio.engineIdle(true);
    },

    seated: () => {
      if (get().phase !== 'BOARDING') return;
      armRail('HUB', 0);
      set({ phase: 'FLIGHT', location: 'HUB', stop: 0, settledAt: performance.now() });
      audio.engineIdle(true);
    },

    enterAt: (to) => {
      const { phase } = get();
      if (phase !== 'INTRO' && phase !== 'BOARDING') return;
      set({
        phase: 'JUMP',
        location: to,
        locationReady: false,
        jump: {
          from: 'HUB',
          to,
          startedAt: performance.now(),
          duration: get().reducedMotion ? 350 : DUR.jumpShort,
          arrive: 'start',
          pushHistory: false,
          hold: true,
          exitStartedAt: null,
          instant: get().reducedMotion,
        },
      });
    },

    jumpTo: (to, opts = {}) => {
      const { phase, location, reducedMotion, firstJumpDone } = get();
      if (phase !== 'FLIGHT' || to === location) return;
      // the first scroll out of the hub gets the full-length jump (synced to
      // the lightspeed clip); everything after is a quick punch
      const long = !!opts.fromScroll && !firstJumpDone && location === 'HUB' && !reducedMotion;
      const duration = reducedMotion
        ? 350
        : long
          ? Math.round(audio.warpDuration * 1000)
          : DUR.jumpShort;
      audio.warp(!long);
      const startedAt = performance.now();
      set({
        phase: 'JUMP',
        jump: {
          from: location,
          to,
          startedAt,
          duration,
          arrive: opts.arrive ?? 'start',
          pushHistory: opts.pushHistory ?? true,
          hold: false,
          exitStartedAt: null,
          instant: reducedMotion,
        },
        hovered: null,
        mapOpen: false,
        finale: false,
        firstJumpDone: firstJumpDone || !!opts.fromScroll,
        locationReady: false,
      });
      // swap the mounted location mid-jump, under cover of the tunnel. Arrival
      // itself is driven by <JumpController> once (min duration && ready).
      window.setTimeout(() => {
        if (get().jump?.startedAt === startedAt) get().swapLocation();
      }, duration * 0.5);
    },

    swapLocation: () => {
      const { jump, location } = get();
      if (!jump || location === jump.to) return;
      set({ location: jump.to, locationReady: false });
    },

    releaseHold: () => {
      const { jump } = get();
      if (!jump || !jump.hold) return;
      // the destination is in: go straight from the loader's tunnel to the snap-out
      const now = performance.now();
      set({
        loaded: true,
        jump: { ...jump, hold: false, startedAt: now - jump.duration, exitStartedAt: now },
      });
    },

    beginExit: () => {
      const { jump } = get();
      if (!jump || jump.exitStartedAt !== null) return;
      if (!jump.instant) audio.dropOut();
      set({ jump: { ...jump, exitStartedAt: performance.now() } });
    },

    markLoaded: () => {
      if (get().loaded) return;
      // the assets are in, but the opening hyperspace runs for a minimum time
      loaderAssetsIn();
      const wait = loaderRemainingMs(get().reducedMotion);
      if (wait > 0) {
        window.setTimeout(() => get().markLoaded(), wait);
        return;
      }
      set({ loaded: true, introStartedAt: performance.now() });
    },
    raiseTitle: () => {
      if (!get().titleUp) set({ titleUp: true });
    },

    arrive: () => {
      const { jump, visited } = get();
      if (!jump) return;
      const to = jump.to;
      const n = FLIGHT[to].stops.length;
      const stop = jump.arrive === 'end' ? Math.max(n - 1, 0) : 0;
      armRail(to, stop);
      set({
        phase: 'FLIGHT',
        location: to,
        jump: null,
        stop,
        settledAt: performance.now(),
        visited: to === 'HUB' || visited.includes(to) ? visited : [...visited, to],
      });
      if (jump.pushHistory) pushLocation(to);
      audio.engineIdle(true);
    },

    chargeFired: (dir) => {
      const { phase, location, finale } = get();
      if (phase !== 'FLIGHT' || finale) return;
      const i = ROUTE.indexOf(location);
      if (i < 0) return;
      if (dir === 1) {
        if (i < ROUTE.length - 1) {
          get().jumpTo(ROUTE[i + 1], { arrive: 'start', fromScroll: true });
        } else {
          // past the last stop on the route: a short beat, then the map opens
          audio.transmit();
          set({ finale: true });
          window.setTimeout(() => {
            if (!get().finale) return;
            set({ finale: false, mapOpen: true });
          }, get().reducedMotion ? 900 : DUR.finale);
        }
      } else if (i > 0) {
        get().jumpTo(ROUTE[i - 1], { arrive: 'end', fromScroll: true });
      }
    },

    goToStop: (index) => {
      if (get().phase !== 'FLIGHT') return;
      audio.confirm();
      goTo(index);
    },
    setStop: (index) => {
      if (get().stop !== index) set({ stop: index });
    },
    setHovered: (id) => {
      if (id && id !== get().hovered) audio.blip();
      set({ hovered: id });
    },
    openMap: () => {
      if (get().phase !== 'FLIGHT') return;
      audio.mapOpen();
      set({ mapOpen: true, finale: false });
    },
    closeMap: () => set({ mapOpen: false }),
    setNavMode: (m) => set({ navMode: m }),
    toggleMute: () => {
      const muted = !get().muted;
      audio.setMuted(muted);
      set({ muted });
    },
    setQuality: (q, manual = false) =>
      set(manual ? { quality: q, qualityAuto: false } : { quality: q }),
    stepQualityDown: () => {
      const { quality, qualityAuto, phase, mapOpen, settledAt } = get();
      // only trust a slow reading taken in steady flight: loading, jumps and
      // the first seconds after an arrival all stutter for other reasons
      if (!qualityAuto || phase !== 'FLIGHT' || mapOpen) return;
      if (performance.now() - settledAt < 4000) return;
      const i = QUALITY_ORDER.indexOf(quality);
      if (i < QUALITY_ORDER.length - 1) set({ quality: QUALITY_ORDER[i + 1] });
    },
    setReducedMotion: (v) => set({ reducedMotion: v }),
    addScore: (n) => {
      set((s) => ({
        arenaScore: s.arenaScore + n,
        arenaBest: Math.max(s.arenaBest, s.arenaScore + n),
      }));
    },
    setArenaGlobalBest: (n) => set((s) => ({ arenaGlobalBest: Math.max(s.arenaGlobalBest, n) })),

    startArena: () => set({ arenaState: 'PLAYING', arenaWave: 1, arenaHull: 3, arenaScore: 0 }),
    arenaNextWave: () => {
      if (get().arenaState === 'PLAYING') set((s) => ({ arenaWave: s.arenaWave + 1 }));
    },
    arenaHit: () => {
      const { arenaState, arenaHull, arenaScore } = get();
      if (arenaState !== 'PLAYING') return;
      if (arenaHull > 1) {
        set({ arenaHull: arenaHull - 1 });
        return;
      }
      // hull gone: the run is over; put the score up against the all-time best
      set({ arenaHull: 0, arenaState: 'OVER' });
      if (arenaScore > 0) {
        fetch('/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score: arenaScore, name: 'GUEST PILOT' }),
          keepalive: true,
        })
          .then((r) => r.json() as Promise<{ best?: number }>)
          .then((d) => {
            if (typeof d?.best === 'number') get().setArenaGlobalBest(d.best);
          })
          .catch(() => {});
      }
    },
    resetArena: () => set({ arenaState: 'READY', arenaWave: 1, arenaHull: 3, arenaScore: 0 }),
    setShipLoaded: (v) => set({ shipLoaded: v }),
    setLocationReady: (v) => set({ locationReady: v }),

    openShipView: () => {
      audio.unlock(); // opened via a click — safe to arm the audio context
      set({ shipView: true, mapOpen: false });
    },
    closeShipView: () => set({ shipView: false }),
  })),
);

// ── wire the scroll engine to the state machine ──
scroll.onFire = (dir) => useApp.getState().chargeFired(dir);
scroll.onStop = (index) => useApp.getState().setStop(index);
scroll.onLockedForward = () => {
  // scrolling on the title screen boards the ship
  const s = useApp.getState();
  if (s.phase === 'INTRO' && s.shipLoaded) s.board();
};

/** input is live only while flying a rail with nothing on top of it */
function syncScrollLock() {
  const s = useApp.getState();
  scroll.locked =
    s.phase !== 'FLIGHT' || s.mapOpen || s.finale || s.shipView || s.navMode === 'MANUAL';
}
useApp.subscribe(syncScrollLock);
syncScrollLock();

/** theme of whatever location is mounted (during a jump: the destination once swapped) */
export function useLocationTheme() {
  return useApp((s) => LOCATIONS[s.location]);
}
