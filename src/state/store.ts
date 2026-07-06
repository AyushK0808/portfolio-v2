import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DUR, MissionId, SECTORS, SectorId } from '@/lib/theme';
import { audio } from '@/systems/audio';

/**
 * Explicit finite state machine for the whole experience (plan §2):
 * BOOT → POWERUP → BRIDGE ⇄ (WARP → MISSION)
 */
export type Phase = 'BOOT' | 'POWERUP' | 'BRIDGE' | 'WARP' | 'MISSION';

export type NavMode = 'AUTO' | 'MANUAL';
export type Quality = 'CINEMATIC' | 'PERFORMANCE';

interface AppState {
  phase: Phase;
  /** sector currently mounted in the 3D world */
  sector: SectorId;
  /** sector we are warping toward (valid during WARP) */
  warpTarget: SectorId | null;
  /** wall-clock ms when the current warp started (for shader ramps) */
  warpStartedAt: number;
  /** length (ms) of the in-progress warp — matches the lightspeed clip */
  warpDuration: number;
  /** wall-clock ms when POWERUP began (drives the boarding camera flight) */
  powerupStartedAt: number;
  /** id of the POI/object currently docked/inspected, null = free roam */
  focus: string | null;
  /** id of the object currently under the reticle */
  hovered: string | null;

  navMode: NavMode;
  quality: Quality;
  muted: boolean;
  reducedMotion: boolean;

  scanned: string[]; // scanned project ids (Mission C)
  arenaScore: number;
  arenaBest: number;
  pilotsOnline: number; // 1 (you) + bots

  /** missions the pilot has cleared this session (gamification) */
  completedMissions: MissionId[];
  /** true while the MISSION COMPLETE overlay is up */
  missionCompleteShown: boolean;
  /** true while the standalone 3D ship inspection view is open */
  shipView: boolean;

  // ── actions ──
  boot: () => void; // BOOT → POWERUP
  skipBoot: () => void; // straight to BRIDGE
  bridgeReady: () => void; // POWERUP → BRIDGE
  selectMission: (m: MissionId) => void; // BRIDGE/MISSION → WARP → MISSION
  returnToBridge: () => void; // MISSION → WARP → BRIDGE
  arriveSector: () => void; // WARP → MISSION | BRIDGE
  setFocus: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  setNavMode: (m: NavMode) => void;
  toggleMute: () => void;
  setQuality: (q: Quality) => void;
  setReducedMotion: (v: boolean) => void;
  markScanned: (id: string) => void;
  addScore: (n: number) => void;
  resetScore: () => void;
  setPilotsOnline: (n: number) => void;
  /** leave the arena — marks E cleared and raises the completion overlay */
  exitArena: () => void;
  /** mark a mission cleared and (optionally) raise the completion overlay */
  completeMission: (m: MissionId, celebrate?: boolean) => void;
  dismissMissionComplete: () => void;
  openShipView: () => void;
  closeShipView: () => void;
}

export const useApp = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    phase: 'BOOT',
    sector: 'BRIDGE',
    warpTarget: null,
    warpStartedAt: 0,
    warpDuration: DUR.warp,
    powerupStartedAt: 0,
    focus: null,
    hovered: null,

    navMode: 'AUTO',
    quality: 'CINEMATIC',
    muted: true,
    reducedMotion: false,

    scanned: [],
    arenaScore: 0,
    arenaBest: 0,
    pilotsOnline: 1,

    completedMissions: [],
    missionCompleteShown: false,
    shipView: false,

    boot: () => {
      if (get().phase !== 'BOOT') return;
      audio.unlock();
      audio.powerUp();
      set({ phase: 'POWERUP', powerupStartedAt: performance.now() });
      const dur = get().reducedMotion ? 400 : DUR.boot;
      window.setTimeout(() => get().bridgeReady(), dur);
    },

    skipBoot: () => {
      audio.unlock();
      set({ phase: 'BRIDGE', sector: 'BRIDGE' });
    },

    bridgeReady: () => {
      if (get().phase !== 'POWERUP') return;
      set({ phase: 'BRIDGE', sector: 'BRIDGE' });
      audio.engineIdle(true);
    },

    selectMission: (m) => {
      const { phase, sector, reducedMotion } = get();
      if (phase === 'WARP' || sector === m) return;
      // reduced motion: quick synth whoosh; otherwise the full lightspeed clip
      // and a warp visual stretched to match the recording's length
      const dur = reducedMotion ? 350 : Math.round(audio.warpDuration * 1000) || DUR.warp;
      audio.warp(reducedMotion);
      set({
        phase: 'WARP',
        warpTarget: m,
        warpStartedAt: performance.now(),
        warpDuration: dur,
        focus: null,
        hovered: null,
        missionCompleteShown: false,
      });
      // swap the mounted sector mid-warp, under cover of the tunnel
      window.setTimeout(() => set({ sector: m }), dur * 0.5);
      window.setTimeout(() => get().arriveSector(), dur);
    },

    returnToBridge: () => {
      const { phase } = get();
      if (phase !== 'MISSION') return;
      audio.warp(true);
      const dur = get().reducedMotion ? 300 : DUR.dock; // mini-warp, 900ms
      set({
        phase: 'WARP',
        warpTarget: 'BRIDGE',
        warpStartedAt: performance.now(),
        warpDuration: dur,
        focus: null,
        hovered: null,
        missionCompleteShown: false,
      });
      window.setTimeout(() => set({ sector: 'BRIDGE' }), dur * 0.5);
      window.setTimeout(() => get().arriveSector(), dur);
    },

    arriveSector: () => {
      const { warpTarget } = get();
      if (!warpTarget) return;
      set({
        phase: warpTarget === 'BRIDGE' ? 'BRIDGE' : 'MISSION',
        warpTarget: null,
      });
    },

    setFocus: (id) => {
      if (id) audio.confirm();
      set({ focus: id });
    },
    setHovered: (id) => {
      if (id && id !== get().hovered) audio.blip();
      set({ hovered: id });
    },
    setNavMode: (m) => set({ navMode: m }),
    toggleMute: () => {
      const muted = !get().muted;
      audio.setMuted(muted);
      set({ muted });
    },
    setQuality: (q) => set({ quality: q }),
    setReducedMotion: (v) => set({ reducedMotion: v }),
    markScanned: (id) =>
      set((s) => (s.scanned.includes(id) ? s : { scanned: [...s.scanned, id] })),
    addScore: (n) => {
      // arena stays open until the pilot hits EXIT GAME — no score-based
      // auto-complete, so a single hit can't pop the completion overlay
      set((s) => ({
        arenaScore: s.arenaScore + n,
        arenaBest: Math.max(s.arenaBest, s.arenaScore + n),
      }));
    },
    resetScore: () => set({ arenaScore: 0 }),
    setPilotsOnline: (n) => set({ pilotsOnline: n }),

    exitArena: () => {
      const { phase, sector } = get();
      if (phase !== 'MISSION' || sector !== 'E') return;
      audio.transmit();
      // always raise the overlay (even on a repeat exit) and mark E cleared
      set((s) => ({
        completedMissions: s.completedMissions.includes('E')
          ? s.completedMissions
          : [...s.completedMissions, 'E'],
        missionCompleteShown: true,
      }));
    },

    completeMission: (m, celebrate = false) => {
      const { completedMissions } = get();
      if (completedMissions.includes(m)) return;
      if (celebrate) audio.transmit();
      set({
        completedMissions: [...completedMissions, m],
        missionCompleteShown: celebrate,
      });
    },
    dismissMissionComplete: () => set({ missionCompleteShown: false }),

    openShipView: () => {
      audio.unlock(); // opened via a click — safe to arm the audio context
      set({ shipView: true });
    },
    closeShipView: () => set({ shipView: false }),
  })),
);

/** theme of whatever sector is mounted (during warp: the destination once swapped) */
export function useSectorTheme() {
  return useApp((s) => SECTORS[s.sector]);
}
