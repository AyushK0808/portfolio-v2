'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { QUALITY_ORDER, Quality, useApp } from '@/state/store';
import { audio } from '@/systems/audio';
import {
  ALL_LOCATIONS,
  COLORS,
  DESTINATIONS,
  LOCATIONS,
  LocationId,
  ROUTE,
} from '@/lib/theme';
import { FREQUENCIES, SITE } from '@/content/site';
import { CREDITS } from '@/content/credits';
import { Pt, meander, pathAt, rand, smoothPath } from '@/lib/curves';

/* ───────────────────────── chart layout ───────────────────────── */

interface ChartLayout {
  w: number;
  h: number;
  nodes: Record<LocationId, Pt>;
  /** which route node each off-route spur branches from */
  spurs: [LocationId, LocationId][];
  /** label sits above or below the node */
  labelSide: Record<LocationId, 'above' | 'below'>;
}

/** wide screens: the route runs left to right */
const WIDE: ChartLayout = {
  w: 1000,
  h: 520,
  nodes: {
    HUB: [90, 270],
    ABOUT: [250, 150],
    SKILLS: [415, 300],
    EXPERIENCE: [580, 150],
    PROJECTS: [745, 300],
    ACHIEVEMENTS: [905, 160],
    ARENA: [330, 440],
    COMMS: [665, 440],
  },
  spurs: [
    ['SKILLS', 'ARENA'],
    ['PROJECTS', 'COMMS'],
  ],
  labelSide: {
    HUB: 'below',
    ABOUT: 'above',
    SKILLS: 'above',
    EXPERIENCE: 'above',
    PROJECTS: 'above',
    ACHIEVEMENTS: 'above',
    ARENA: 'below',
    COMMS: 'below',
  },
};

/** upright screens: the route zig-zags top to bottom */
const TALL: ChartLayout = {
  w: 560,
  h: 800,
  nodes: {
    HUB: [130, 80],
    ABOUT: [410, 175],
    SKILLS: [150, 285],
    EXPERIENCE: [410, 390],
    PROJECTS: [150, 495],
    ACHIEVEMENTS: [410, 595],
    ARENA: [130, 705],
    COMMS: [430, 720],
  },
  spurs: [
    ['PROJECTS', 'ARENA'],
    ['ACHIEVEMENTS', 'COMMS'],
  ],
  labelSide: {
    HUB: 'below',
    ABOUT: 'below',
    SKILLS: 'below',
    EXPERIENCE: 'below',
    PROJECTS: 'below',
    ACHIEVEMENTS: 'below',
    ARENA: 'below',
    COMMS: 'below',
  },
};

/** a spur to a map-only destination: one bowed curve, with the place for its arrowhead */
function spurCurve(a: Pt, b: Pt, bow: number): { d: string; at: Pt; angle: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const c: Pt = [(a[0] + b[0]) / 2 - (dy / len) * bow, (a[1] + b[1]) / 2 + (dx / len) * bow];
  const t = 0.62;
  const u = 1 - t;
  const at: Pt = [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  const tx = 2 * u * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
  const ty = 2 * u * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
  return {
    d: `M ${a[0]} ${a[1]} Q ${c[0].toFixed(1)} ${c[1].toFixed(1)}, ${b[0]} ${b[1]}`,
    at,
    angle: (Math.atan2(ty, tx) * 180) / Math.PI,
  };
}

/**
 * Each node shows a picture of the place itself, rendered from the site's own
 * 3D worlds (scripts/capture-worlds.mjs → public/worlds). `size` is the drawn
 * width in chart units; `body` is roughly the radius of the subject inside it,
 * used to place rings and labels.
 */
const NODE_ART: Record<LocationId, { size: number; body: number }> = {
  HUB: { size: 96, body: 26 },
  ABOUT: { size: 76, body: 29 },
  SKILLS: { size: 148, body: 32 },
  EXPERIENCE: { size: 88, body: 30 },
  PROJECTS: { size: 78, body: 27 },
  ACHIEVEMENTS: { size: 76, body: 29 },
  ARENA: { size: 78, body: 30 },
  COMMS: { size: 84, body: 27 },
};

/** small chevron showing the direction of travel */
function Arrowhead({ at, angle, color, opacity }: { at: Pt; angle: number; color: string; opacity: number }) {
  return (
    <path
      d="M -5 -4.5 L 4 0 L -5 4.5"
      transform={`translate(${at[0].toFixed(1)} ${at[1].toFixed(1)}) rotate(${angle.toFixed(1)})`}
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}

function useUpright() {
  const [upright, setUpright] = useState(false);
  useEffect(() => {
    const update = () =>
      setUpright(window.innerHeight > window.innerWidth || window.innerWidth < 720);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return upright;
}

/* ───────────────────────── the chart ──────────────────────────── */

function Chart({ onHover }: { onHover: (id: LocationId | null) => void }) {
  const location = useApp((s) => s.location);
  const visited = useApp((s) => s.visited);
  const jumpTo = useApp((s) => s.jumpTo);
  const closeMap = useApp((s) => s.closeMap);
  const upright = useUpright();
  const L = upright ? TALL : WIDE;

  const stars = useMemo(
    () =>
      Array.from({ length: 110 }, (_, i) => ({
        x: rand(i) * L.w,
        y: rand(i + 400) * L.h,
        r: 0.5 + rand(i + 900) * 1.1,
        o: 0.15 + rand(i + 1300) * 0.5,
      })),
    [L],
  );
  // the winding route, plus one arrowhead in the middle of every leg
  const route = useMemo(() => {
    const pts = meander(ROUTE.map((id) => L.nodes[id]), upright ? 34 : 28);
    return {
      d: smoothPath(pts),
      arrows: ROUTE.slice(0, -1).map((_, i) => pathAt(pts, 3 * i + 1, 0.5)),
    };
  }, [L, upright]);
  const spurs = useMemo(
    () =>
      L.spurs.map(([from, to], i) => ({
        to,
        ...spurCurve(L.nodes[from], L.nodes[to], i % 2 === 0 ? 30 : -30),
      })),
    [L],
  );

  const go = (id: LocationId) => {
    audio.click();
    if (id === location) closeMap();
    else jumpTo(id);
  };

  return (
    <svg
      viewBox={`0 0 ${L.w} ${L.h}`}
      className="map-chart"
      role="group"
      aria-label="Galaxy chart: pick a destination"
    >
      <defs>
        {ALL_LOCATIONS.map((id) => (
          <radialGradient key={id} id={`glow-${id}`}>
            <stop offset="0%" stopColor={LOCATIONS[id].bright} stopOpacity="0.55" />
            <stop offset="55%" stopColor={LOCATIONS[id].base} stopOpacity="0.14" />
            <stop offset="100%" stopColor={LOCATIONS[id].base} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>

      {/* chart furniture: range rings and backdrop stars */}
      {[0.22, 0.4, 0.6].map((k) => (
        <ellipse
          key={k}
          cx={L.w / 2}
          cy={L.h / 2}
          rx={L.w * k}
          ry={L.h * k}
          fill="none"
          stroke={COLORS.hudCyanDim}
          strokeWidth="0.6"
          opacity="0.28"
        />
      ))}
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={COLORS.textPrimary} opacity={s.o} />
      ))}

      {/* off-route spurs: bowed, dotted, pointing at the map-only places */}
      {spurs.map((s) => (
        <g key={s.to}>
          <path
            d={s.d}
            fill="none"
            stroke={LOCATIONS[s.to].base}
            strokeWidth="1"
            strokeDasharray="2 7"
            strokeLinecap="round"
            opacity="0.5"
          />
          <Arrowhead at={s.at} angle={s.angle} color={LOCATIONS[s.to].base} opacity={0.7} />
        </g>
      ))}

      {/* the hyperlane: a soft glow under a marching dashed line, winding
          from world to world, with an arrowhead on every leg */}
      <path d={route.d} fill="none" stroke={COLORS.hudCyan} strokeWidth="7" opacity="0.07" />
      <path
        d={route.d}
        fill="none"
        stroke={COLORS.hudCyan}
        strokeWidth="1.4"
        strokeDasharray="10 8"
        opacity="0.75"
        className="map-lane"
      />
      {route.arrows.map((a, i) => (
        <Arrowhead key={i} at={a.at} angle={a.angle} color={COLORS.hudCyanBright} opacity={0.95} />
      ))}

      {ALL_LOCATIONS.map((id) => {
        const theme = LOCATIONS[id];
        const [x, y] = L.nodes[id];
        const here = id === location;
        const seen = id === 'HUB' || visited.includes(id);
        const art = NODE_ART[id];
        const r = art.body;
        const below = L.labelSide[id] === 'below';
        const ly = below ? y + r + 28 : y - r - 30;
        return (
          <g
            key={id}
            className="map-chart-node"
            role="button"
            tabIndex={0}
            aria-label={`${theme.label}, ${theme.name}${here ? ', you are here' : seen ? ', visited' : ''}`}
            onClick={() => go(id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                go(id);
              }
            }}
            onMouseEnter={() => {
              audio.blip();
              onHover(id);
            }}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(id)}
            onBlur={() => onHover(null)}
          >
            {/* generous hit area */}
            <circle cx={x} cy={y} r="52" fill="transparent" />
            <circle cx={x} cy={y} r="46" fill={`url(#glow-${id})`} />
            {here && (
              <circle cx={x} cy={y} r={r + 9} fill="none" stroke={theme.bright} strokeWidth="1.5">
                <animate attributeName="r" values={`${r + 6};${r + 16};${r + 6}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0.15;0.9" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            {/* places not yet visited pulse gently: still out there */}
            {!seen && (
              <circle cx={x} cy={y} r={r + 6} fill="none" stroke={theme.base} strokeWidth="1" strokeDasharray="3 5">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`0 ${x} ${y}`}
                  to={`360 ${x} ${y}`}
                  dur="14s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            {/* the place itself; somewhere not yet visited is shown a little dimmed */}
            <image
              className="map-chart-body"
              href={`/worlds/${id.toLowerCase()}-sm.webp`}
              x={x - art.size / 2}
              y={y - art.size / 2}
              width={art.size}
              height={art.size}
              preserveAspectRatio="xMidYMid meet"
              style={seen ? undefined : { filter: 'grayscale(0.45) brightness(0.72)' }}
            />
            <text x={x} y={ly} textAnchor="middle" className="map-chart-label font-hud" fill={COLORS.textPrimary}>
              {theme.label}
            </text>
            <text x={x} y={ly + 16} textAnchor="middle" className="map-chart-name font-data" fill={theme.base}>
              {here ? 'YOU ARE HERE' : theme.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ───────────────────────── side panels ────────────────────────── */

const QUALITY_LABEL: Record<Quality, string> = {
  CINEMATIC: 'HIGH',
  PERFORMANCE: 'MEDIUM',
  LITE: 'LOW',
};

function Setting({
  label,
  value,
  on,
  onClick,
  className = '',
}: {
  label: string;
  value: string;
  on: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={`map-setting font-data ${className}`}
      role="switch"
      aria-checked={on}
      onClick={() => {
        audio.unlock();
        audio.click();
        onClick();
      }}
    >
      <span>{label}</span>
      <span style={{ color: on ? COLORS.success : COLORS.warning }}>{value}</span>
    </button>
  );
}

function Settings() {
  const quality = useApp((s) => s.quality);
  const qualityAuto = useApp((s) => s.qualityAuto);
  const setQuality = useApp((s) => s.setQuality);
  const muted = useApp((s) => s.muted);
  const toggleMute = useApp((s) => s.toggleMute);
  const navMode = useApp((s) => s.navMode);
  const setNavMode = useApp((s) => s.setNavMode);
  const closeMap = useApp((s) => s.closeMap);
  return (
    <div className="map-panel">
      <div className="map-panel-title font-data">SHIP SETTINGS</div>
      <Setting label="SOUND" value={muted ? 'OFF' : 'ON'} on={!muted} onClick={toggleMute} />
      <Setting
        label="GRAPHICS"
        value={`${QUALITY_LABEL[quality]}${qualityAuto ? ' · AUTO' : ''}`}
        on={quality !== 'LITE'}
        onClick={() =>
          setQuality(QUALITY_ORDER[(QUALITY_ORDER.indexOf(quality) + 1) % QUALITY_ORDER.length], true)
        }
      />
      {/* free flight needs a keyboard — hidden on touch devices */}
      <Setting
        className="fine-pointer-only"
        label="FREE FLIGHT"
        value={navMode === 'MANUAL' ? 'ON' : 'OFF'}
        on={navMode === 'MANUAL'}
        onClick={() => {
          const next = navMode === 'MANUAL' ? 'AUTO' : 'MANUAL';
          setNavMode(next);
          if (next === 'MANUAL') closeMap();
        }}
      />
    </div>
  );
}

function Links() {
  const links = [
    ...FREQUENCIES.filter((f) => f.id !== 'site').map((f) => ({ label: f.label, href: f.href })),
    { label: 'RÉSUMÉ PDF', href: SITE.resumePdf },
  ];
  return (
    <div className="map-panel">
      <div className="map-panel-title font-data">OPEN CHANNELS</div>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target={l.href.startsWith('mailto:') ? undefined : '_blank'}
            rel="noopener noreferrer"
            className="hud-btn map-link"
            onMouseEnter={() => audio.blip()}
          >
            {l.label} ↗
          </a>
        ))}
        <Link href="/resume" className="hud-btn map-link" onMouseEnter={() => audio.blip()}>
          VIEW 2D IMAGE →
        </Link>
      </div>
    </div>
  );
}

function CreditsPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="map-credits">
      <div className="flex items-center justify-between gap-4">
        <div className="font-hud" style={{ color: COLORS.textPrimary, fontSize: '0.9rem' }}>
          CREDITS
        </div>
        <button className="hud-btn" style={{ padding: '6px 12px' }} onClick={onBack}>
          ← BACK TO CHART
        </button>
      </div>
      <p className="mt-3" style={{ color: COLORS.textSecondary, fontSize: '0.8125rem', lineHeight: 1.6 }}>
        Designed and built by {SITE.name}. These 3D models are the work of other
        artists, used under their Creative Commons licences:
      </p>
      <ul className="mt-4 space-y-3">
        {CREDITS.map((c) => (
          <li key={c.href} className="map-credit">
            <div className="font-data" style={{ color: COLORS.textMuted, fontSize: '0.625rem', letterSpacing: '0.12em' }}>
              {c.usedAs.toUpperCase()}
            </div>
            <div style={{ color: COLORS.textPrimary, fontSize: '0.875rem' }}>
              <a href={c.href} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.hudCyanBright }}>
                “{c.title}”
              </a>{' '}
              by {c.author}
            </div>
            <div className="font-data" style={{ fontSize: '0.6875rem' }}>
              <a href={c.licenseHref} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.textSecondary }}>
                {c.license}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────────── root ───────────────────────────── */

/**
 * The map: the site's navbar. A star chart with the scroll route drawn through
 * it and the two off-route places (the game, Contact) hanging off it — those
 * are reachable only from here. Also holds links, ship settings, the ship
 * viewer and credits.
 */
export function MapOverlay() {
  const open = useApp((s) => s.mapOpen);
  const closeMap = useApp((s) => s.closeMap);
  const openShipView = useApp((s) => s.openShipView);
  const visited = useApp((s) => s.visited);
  const [hover, setHover] = useState<LocationId | null>(null);
  const [credits, setCredits] = useState(false);

  // always reopen on the chart
  useEffect(() => {
    if (!open) {
      setCredits(false);
      setHover(null);
    }
  }, [open]);

  if (!open) return null;

  const hovered = hover ? LOCATIONS[hover] : null;

  return (
    <div
      className="map-overlay pointer-events-auto absolute inset-0"
      role="dialog"
      aria-modal="true"
      aria-label="Map"
    >
      <div className="map-inner">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              className="font-hero"
              style={{ fontSize: 'clamp(1.05rem, 3vw, 1.6rem)', color: COLORS.textPrimary }}
            >
              GALAXY CHART
            </div>
            <div className="font-data mt-1" style={{ fontSize: '0.6875rem', color: COLORS.textSecondary }}>
              {visited.length} OF {DESTINATIONS.length} VISITED · TAP A DESTINATION TO JUMP
            </div>
          </div>
          <button className="hud-btn shrink-0" style={{ padding: '8px 14px' }} onClick={closeMap}>
            ✕ CLOSE
          </button>
        </div>

        {credits ? (
          <CreditsPanel onBack={() => setCredits(false)} />
        ) : (
          <>
            <Chart onHover={setHover} />
            <div className="map-detail font-data" aria-live="polite">
              {hovered ? (
                <>
                  <span style={{ color: hovered.base }}>
                    {hovered.label} — {hovered.name}
                  </span>
                  <span style={{ color: COLORS.textSecondary }}> · {hovered.briefing}</span>
                </>
              ) : (
                <span style={{ color: COLORS.textMuted }}>
                  DASHED LINE: THE SCROLL ROUTE, IN FLIGHT ORDER · DOTTED SPURS: MAP-ONLY DESTINATIONS
                </span>
              )}
            </div>
          </>
        )}

        <div className="map-panels">
          <Links />
          <Settings />
          <div className="map-panel">
            <div className="map-panel-title font-data">HANGAR</div>
            <div className="flex flex-wrap gap-2">
              <button className="hud-btn map-link" onClick={openShipView} onMouseEnter={() => audio.blip()}>
                ▸ VIEW SPACESHIP
              </button>
              <button
                className="hud-btn map-link"
                onClick={() => setCredits((c) => !c)}
                onMouseEnter={() => audio.blip()}
                aria-pressed={credits}
              >
                CREDITS
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
