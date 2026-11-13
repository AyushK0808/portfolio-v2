// Design tokens — single source of truth for both CSS (globals.css mirrors
// these) and Three.js materials — plus the registry of places the ship can go.

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

export type LocationId =
  | 'HUB'
  | 'ABOUT'
  | 'SKILLS'
  | 'EXPERIENCE'
  | 'PROJECTS'
  | 'ACHIEVEMENTS'
  | 'ARENA'
  | 'COMMS';

export interface LocationTheme {
  id: LocationId;
  /** what the place is for — shown in the HUD and on the map */
  label: string;
  /** the invented world name */
  name: string;
  /** URL hash for deep links; the hub is the bare address */
  hash: string;
  briefing: string;
  base: string;
  bright: string;
  deep: string;
  /** FogExp2 density — open space low, dense fields higher */
  fogDensity: number;
}

export const LOCATIONS: Record<LocationId, LocationTheme> = {
  HUB: {
    id: 'HUB',
    label: 'HUB',
    name: 'WAYPOINT ZERO',
    hash: '',
    briefing: 'SCROLL DOWN TO CHARGE THE HYPERDRIVE AND FLY THE ROUTE. PRESS M FOR THE MAP.',
    base: '#00D9F5',
    bright: '#5DF2FF',
    deep: '#0E6E7E',
    fogDensity: 0.006,
  },
  ABOUT: {
    id: 'ABOUT',
    label: 'ABOUT',
    name: 'FIRSTLIGHT',
    hash: 'about',
    briefing: 'HOME WORLD. PILOT RECORD ON FILE — SCROLL TO FLY ON.',
    base: '#FFB347',
    bright: '#FFD98A',
    deep: '#C2631E',
    fogDensity: 0.007,
  },
  SKILLS: {
    id: 'SKILLS',
    label: 'SKILLS',
    name: 'ANVIL YARDS',
    hash: 'skills',
    briefing: 'FIVE DOCKS, FIVE DISCIPLINES. SCROLL TO TOUR THE YARD.',
    base: '#2FE0C8',
    bright: '#7BF3E4',
    deep: '#0C3B39',
    fogDensity: 0.008,
  },
  EXPERIENCE: {
    id: 'EXPERIENCE',
    label: 'EXPERIENCE',
    name: 'MERIDIAN',
    hash: 'experience',
    briefing: 'FOUR POSTINGS LOGGED ALONG THE APPROACH LANE, OLDEST FIRST.',
    base: '#FFD75E',
    bright: '#FFEDAF',
    deep: '#8A6420',
    fogDensity: 0.007,
  },
  PROJECTS: {
    id: 'PROJECTS',
    label: 'PROJECTS',
    name: 'THE DRIFT',
    hash: 'projects',
    briefing: 'FIVE BUILDS ADRIFT IN THE BELT. THE ODDS OF FINDING MORE ON GITHUB ARE GOOD.',
    base: '#B266FF',
    bright: '#D7A6FF',
    deep: '#6D28D9',
    fogDensity: 0.011,
  },
  ACHIEVEMENTS: {
    id: 'ACHIEVEMENTS',
    label: 'ACHIEVEMENTS',
    name: 'CAIRN',
    hash: 'achievements',
    briefing: 'BEACONS FOR THE WINS WORTH MARKING. LAST STOP ON THE ROUTE.',
    base: '#8FCBFF',
    bright: '#D2ECFF',
    deep: '#28507A',
    fogDensity: 0.007,
  },
  ARENA: {
    id: 'ARENA',
    label: 'GAME',
    name: 'EMBERFALL RANGE',
    hash: 'arena',
    briefing: 'ROCKS INBOUND OVER THE LAVA FIELDS. SHOOT THEM BEFORE THEY REACH THE HULL.',
    base: '#FF5A2E',
    bright: '#FFA24B',
    deep: '#B01E1E',
    fogDensity: 0.009,
  },
  COMMS: {
    id: 'COMMS',
    label: 'CONTACT',
    name: 'ECHO RELAY',
    hash: 'comms',
    briefing: 'CHANNEL OPEN. PICK A FREQUENCY OR SEND A MESSAGE.',
    base: '#4DFF88',
    bright: '#B6FFC9',
    deep: '#0B7A3E',
    fogDensity: 0.008,
  },
};

/** the scroll route, in flight order — scrolling never leaves this list */
export const ROUTE: LocationId[] = [
  'HUB',
  'ABOUT',
  'SKILLS',
  'EXPERIENCE',
  'PROJECTS',
  'ACHIEVEMENTS',
];

/** reachable from the map only */
export const OFF_ROUTE: LocationId[] = ['ARENA', 'COMMS'];

export const ALL_LOCATIONS: LocationId[] = [...ROUTE, ...OFF_ROUTE];

/** everything except the hub counts toward "visited" */
export const DESTINATIONS: LocationId[] = ALL_LOCATIONS.filter((l) => l !== 'HUB');

// Motion tokens, ms
export const DUR = {
  micro: 120,
  ui: 320,
  /** every hyperspace jump after the first */
  jumpShort: 1500,
  /** "route complete" beat before the map opens */
  finale: 2600,
  decodePerChar: 35,
} as const;
