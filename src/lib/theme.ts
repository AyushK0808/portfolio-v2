// Design tokens — single source of truth for both CSS (globals.css mirrors
// these) and Three.js materials. Values from the design bible §2.

import { EXPERIENCE } from '@/content/experience';
import { PROJECTS } from '@/content/projects';

export const COLORS = {
  void: '#05060A',
  spaceDeep: '#0A0E17',
  panel: '#0E1420',
  panelEdge: '#1E3247',
  hudCyanBright: '#5DF2FF',
  hudCyan: '#00D9F5',
  hudCyanDim: '#0E6E7E',
  textPrimary: '#EAF6FA',
  textSecondary: '#8AA6B4',
  textMuted: '#46586A',
  success: '#35FFB0',
  warning: '#FFC24B',
  danger: '#FF445A',
} as const;

export type MissionId = 'A' | 'B' | 'C' | 'D' | 'E' | 'CONTACT';
export type SectorId = MissionId | 'BRIDGE';

export interface SectorTheme {
  id: SectorId;
  name: string;
  callsign: string;
  briefing: string;
  base: string;
  bright: string;
  deep: string;
  /** FogExp2 density — open sectors low, dense fields higher (bible §4) */
  fogDensity: number;
  /** secondary accent (only Gallery uses one) */
  alt?: string;
}

export const SECTORS: Record<SectorId, SectorTheme> = {
  BRIDGE: {
    id: 'BRIDGE',
    name: 'BRIDGE',
    callsign: 'CONTROL PANEL',
    briefing: 'PLOT A HYPERSPACE VECTOR FROM THE NAV DIAL. AUTOPILOT STANDING BY, PILOT.',
    base: '#00D9F5',
    bright: '#5DF2FF',
    deep: '#0E6E7E',
    fogDensity: 0.02,
  },
  A: {
    id: 'A',
    name: 'MISSION A — PILOT DOSSIER',
    callsign: 'HOME STATION',
    briefing: 'SCROLL TO TOUR HOME STATION — CAPTAIN DOSSIER + SHIP SUBSYSTEMS. THE FORCE IS STRONG WITH THIS ONE.',
    base: '#FFB347',
    bright: '#FFD98A',
    deep: '#C2631E',
    fogDensity: 0.025,
  },
  B: {
    id: 'B',
    name: 'MISSION B — FLIGHT LOG',
    callsign: 'TRAJECTORY CORRIDOR',
    briefing: `${EXPERIENCE.length} OUTPOSTS LOGGED ACROSS THE GALAXY. SCROLL TO FLY THE CORRIDOR — AND STAY ON TARGET.`,
    base: '#4C8DFF',
    bright: '#8FB6FF',
    deep: '#1E3A8A',
    fogDensity: 0.025,
  },
  C: {
    id: 'C',
    name: 'MISSION C — PROJECTS',
    callsign: 'DEBRIS FIELD',
    briefing: `${PROJECTS.length} ARTIFACTS ADRIFT IN THE DEBRIS FIELD. SCROLL TO SCAN EACH SIGNATURE — NEVER TELL ME THE ODDS.`,
    base: '#B266FF',
    bright: '#D7A6FF',
    deep: '#6D28D9',
    fogDensity: 0.045,
  },
  D: {
    id: 'D',
    name: 'MISSION D — GALLERY',
    callsign: 'OBSERVATION DECK',
    briefing: 'VISUAL ARCHIVE RING DEAD AHEAD. SCROLL TO ORBIT — THAT’S NO MOON… IT’S THE OBSERVATION DECK.',
    base: '#2FE0C8',
    bright: '#7BF3E4',
    deep: '#0C3B39',
    fogDensity: 0.03,
    alt: '#FF7FBF',
  },
  E: {
    id: 'E',
    name: 'MISSION E — ARENA',
    callsign: 'COMBAT RANGE',
    briefing: 'ASTEROIDS INBOUND ON THE COMBAT RANGE. LOCK S-FOILS, AIM WITH THE RETICLE — GREAT SHOT, RED FIVE.',
    base: '#FF5A2E',
    bright: '#FFA24B',
    deep: '#B01E1E',
    fogDensity: 0.05,
  },
  CONTACT: {
    id: 'CONTACT',
    name: 'COMMS — OPEN CHANNEL',
    callsign: 'COMMS TERMINAL',
    briefing: 'CHANNEL OPEN. TUNE A FREQUENCY OR TRANSMIT — HELP ME, RECRUITER; YOU’RE MY ONLY HOPE.',
    base: '#4DFF88',
    bright: '#B6FFC9',
    deep: '#0B7A3E',
    fogDensity: 0.03,
  },
};

export const MISSION_ORDER: MissionId[] = ['A', 'B', 'C', 'D', 'E', 'CONTACT'];

// Motion tokens (bible §6), ms
export const DUR = {
  micro: 120,
  ui: 320,
  dock: 900,
  warp: 1500,
  boot: 2600,
  decodePerChar: 35,
} as const;
