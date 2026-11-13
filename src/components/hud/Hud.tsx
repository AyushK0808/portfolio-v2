'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/store';
import { audio } from '@/systems/audio';
import { COLORS, LOCATIONS, ROUTE } from '@/lib/theme';
import { FLIGHT } from '@/systems/flightplan';
import { scroll } from '@/systems/scroll';
import { BOARDING_MS } from '@/systems/intro';
import { camTelemetry } from '../three/CameraDirector';
import { useDecode } from './useDecode';
import { ContentCard } from './ContentCard';
import { MapOverlay } from './MapOverlay';
import { CommsPanel } from './CommsPanel';
import { ArenaHud } from './ArenaHud';

/* ────────────────────────── INTRO ────────────────────────── */

function IntroOverlay() {
  const board = useApp((s) => s.board);
  const skipIntro = useApp((s) => s.skipIntro);
  const title = useDecode('AYUSH KUMAR', 55);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* title rides the top of the frame; the cruising hero ship owns the middle */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[9vh] w-full px-4 text-center">
        <div
          className="font-hero animate-title-land"
          style={{
            fontSize: 'clamp(2rem, 7vw, 5.5rem)',
            lineHeight: 0.95,
            color: COLORS.textPrimary,
            textShadow: `0 0 24px ${COLORS.hudCyan}88, 0 0 80px ${COLORS.hudCyan}44`,
            minHeight: '1em',
          }}
        >
          {title || ' '}
        </div>
        <div
          className="font-hud animate-hud-in mt-4"
          style={{ color: COLORS.textSecondary, fontSize: '0.8125rem', animationDelay: '600ms' }}
        >
          JUNIOR ENGINEER · CORNERSTONE ONDEMAND
        </div>
        <div
          className="font-data animate-hud-in mt-2"
          style={{ color: COLORS.textMuted, fontSize: '0.6875rem', animationDelay: '900ms' }}
        >
          VESSEL AYK-08 HOLDING AT WAYPOINT ZERO — READY FOR BOARDING
        </div>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 bottom-[17vh] pointer-events-auto flex flex-col items-center gap-3">
        <button
          onClick={() => board(true)}
          onMouseEnter={() => audio.blip()}
          className="hud-btn animate-breathe"
          style={{ fontSize: '1rem', padding: '14px clamp(22px, 6vw, 42px)', borderWidth: 2, whiteSpace: 'nowrap' }}
        >
          [ BOARD SHIP ]
        </button>
        <div className="font-data animate-breathe" style={{ color: COLORS.textMuted, fontSize: '0.6875rem' }}>
          OR SCROLL ↓
        </div>
      </div>

      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-5 pointer-events-auto whitespace-nowrap">
        <button
          onClick={skipIntro}
          className="hud-interactive font-data"
          style={{ color: COLORS.textMuted, fontSize: '0.75rem', background: 'none', border: 'none' }}
        >
          skip intro →
        </button>
        <Link
          href="/resume"
          className="hud-interactive font-data"
          style={{ color: COLORS.textMuted, fontSize: '0.75rem' }}
        >
          view 2d image →
        </Link>
      </div>
    </div>
  );
}

/* ──────────────────────── BOARDING ───────────────────────── */

const BOOT_LINES = [
  'SYS: POWER BUS ............ ONLINE',
  'SYS: NAV COMPUTER ......... ONLINE',
  'SYS: COMMS ARRAY .......... ONLINE',
  'SYS: PROPULSION ........... ONLINE',
  'SYS: HYPERDRIVE ........... ONLINE',
  'PILOT RECOGNIZED — WELCOME ABOARD',
];

function BoardingOverlay() {
  const skipIntro = useApp((s) => s.skipIntro);
  return (
    <div
      className="absolute inset-0 flex items-end justify-between p-6 md:p-10 cursor-pointer"
      onClick={skipIntro}
    >
      <div className="font-data" style={{ fontSize: '0.8125rem' }}>
        {BOOT_LINES.map((line, i) => (
          <div
            key={line}
            className="animate-flicker-in"
            style={{
              // systems report in over the back half of the chase, the last
              // line landing as the pilot settles into the seat
              animationDelay: `${BOARDING_MS * 0.5 + i * 480}ms`,
              color: i === BOOT_LINES.length - 1 ? COLORS.hudCyanBright : COLORS.success,
              marginBottom: 4,
            }}
          >
            {line}
          </div>
        ))}
      </div>
      <div className="font-data" style={{ color: COLORS.textMuted, fontSize: '0.6875rem' }}>
        TAP TO SKIP
      </div>
    </div>
  );
}

/* ─────────────────────── FLIGHT HUD BITS ─────────────────── */

/** top-left: where you are, and what to do here */
function LocationReadout() {
  const location = useApp((s) => s.location);
  const navMode = useApp((s) => s.navMode);
  const theme = LOCATIONS[location];
  const decoded = useDecode(theme.briefing, 12);

  return (
    <div className="hud-corner top-4 left-4 md:top-6 md:left-6 max-w-[62vw] md:max-w-[46vw]">
      <div className="font-hud" style={{ color: theme.base, fontSize: '0.9rem' }}>
        {theme.label}
        <span style={{ color: COLORS.textMuted }}> — {theme.name}</span>
      </div>
      <div
        className={`font-data mt-1 ${location === 'HUB' ? 'hidden md:block' : ''}`}
        style={{ color: COLORS.textSecondary, fontSize: '0.6875rem', minHeight: '1em' }}
      >
        {decoded}
      </div>
      {navMode === 'MANUAL' && location !== 'ARENA' && (
        <div className="font-data mt-2" style={{ fontSize: '0.6875rem', color: COLORS.textMuted }}>
          FREE FLIGHT — WASD/ARROWS THRUST · R/F LIFT · DRAG TO LOOK
        </div>
      )}
    </div>
  );
}

/** left edge: one dot per stop on this location's rail; tap to glide there */
function StopRail() {
  const location = useApp((s) => s.location);
  const stop = useApp((s) => s.stop);
  const goToStop = useApp((s) => s.goToStop);
  const theme = LOCATIONS[location];
  const stops = FLIGHT[location].stops;
  if (stops.length < 2) return null;

  return (
    <div className="hud-corner left-1 md:left-4 top-1/2 -translate-y-1/2 flex flex-col items-center">
      <div className="font-data mb-1" style={{ fontSize: '0.625rem', color: COLORS.textMuted }}>
        {stop + 1}/{stops.length}
      </div>
      {stops.map((st, i) => (
        <button
          key={st.id}
          onClick={() => goToStop(i)}
          onMouseEnter={() => audio.blip()}
          className="hud-interactive stop-dot"
          title={st.label}
          aria-label={`Go to ${st.label}`}
          aria-current={i === stop}
        >
          <span
            style={{
              width: i === stop ? 11 : 7,
              height: i === stop ? 11 : 7,
              borderRadius: 999,
              background: i <= stop ? theme.base : 'transparent',
              border: `1px solid ${i <= stop ? theme.base : COLORS.textMuted}`,
              boxShadow: i === stop ? `0 0 8px ${theme.base}` : 'none',
              transition: 'all 160ms var(--ease-hud-in)',
            }}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * Bottom-centre: what scrolling will do next, and the hyperdrive charge bar
 * while the visitor keeps scrolling past either end of the rail.
 */
function FlightPrompt() {
  const location = useApp((s) => s.location);
  const stop = useApp((s) => s.stop);
  const navMode = useApp((s) => s.navMode);
  const [charging, setCharging] = useState<-1 | 0 | 1>(0);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let last: -1 | 0 | 1 = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const dir = scroll.charge > 0.02 ? scroll.chargeDir : 0;
      if (dir !== last) {
        last = dir;
        setCharging(dir);
      }
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(scroll.charge, 1)})`;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const i = ROUTE.indexOf(location);
  const n = FLIGHT[location].stops.length;
  if (i < 0 || n === 0 || navMode === 'MANUAL') return null;

  const theme = LOCATIONS[location];
  const next = i < ROUTE.length - 1 ? LOCATIONS[ROUTE[i + 1]] : null;
  const prev = i > 0 ? LOCATIONS[ROUTE[i - 1]] : null;
  const atEnd = stop === n - 1;

  let idle = 'SCROLL ↓';
  if (location === 'HUB') idle = 'SCROLL ↓ TO ENGAGE HYPERDRIVE';
  else if (atEnd) idle = next ? `KEEP SCROLLING ↓ JUMP TO ${next.label}` : 'KEEP SCROLLING ↓ FINISH THE ROUTE';

  const chargeLabel =
    charging === 1
      ? next
        ? `HYPERDRIVE CHARGING — ${next.label}`
        : 'ROUTE COMPLETE — STAND BY'
      : `REVERSING — BACK TO ${prev?.label ?? ''}`;
  const accent = charging === 1 ? (next ?? theme).base : (prev ?? theme).base;

  return (
    <div
      className="hud-corner bottom-4 left-3 max-w-[calc(100vw-128px)] text-left md:left-1/2 md:max-w-none md:-translate-x-1/2 md:text-center"
      aria-live="polite"
    >
      <div
        className="font-data animate-breathe md:whitespace-nowrap"
        style={{
          fontSize: '0.6875rem',
          color: charging !== 0 ? accent : atEnd ? theme.bright : COLORS.textMuted,
        }}
      >
        {charging !== 0 ? chargeLabel : idle}
      </div>
      <div
        className="mt-1.5 md:mx-auto"
        style={{
          width: 'min(260px, 48vw)',
          height: 3,
          borderRadius: 999,
          background: `${accent}26`,
          overflow: 'hidden',
          opacity: charging !== 0 ? 1 : 0,
          transition: 'opacity 160ms ease',
        }}
      >
        <div
          ref={bar}
          style={{
            width: '100%',
            height: '100%',
            transformOrigin: charging === -1 ? 'right' : 'left',
            transform: 'scaleX(0)',
            background: accent,
            boxShadow: `0 0 10px ${accent}`,
          }}
        />
      </div>
    </div>
  );
}

/** bottom corners: the 2D résumé page on the left, the map on the right */
function BottomBar() {
  const openMap = useApp((s) => s.openMap);
  return (
    <>
      <div className="hud-corner bottom-4 left-6 hidden md:block">
        <Link
          href="/resume"
          className="hud-interactive font-data"
          style={{ color: COLORS.textSecondary, fontSize: '0.6875rem' }}
        >
          [ VIEW 2D IMAGE ]
        </Link>
      </div>
      <div className="hud-corner bottom-3 right-3 md:bottom-5 md:right-6">
        <button
          className="hud-btn"
          style={{ fontSize: '0.8125rem', padding: '9px 18px', borderWidth: 2 }}
          onClick={openMap}
          onMouseEnter={() => audio.blip()}
          aria-keyshortcuts="M"
        >
          ◈ MAP
        </button>
      </div>
    </>
  );
}

/* ─────────────────── ROUTE COMPLETE ──────────────────────── */

function FinaleOverlay() {
  const finale = useApp((s) => s.finale);
  const title = useDecode(finale ? 'ROUTE COMPLETE' : '', 40);
  if (!finale) return null;
  const theme = LOCATIONS.ACHIEVEMENTS;
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'rgba(5,6,10,0.5)', backdropFilter: 'blur(2px)' }}
    >
      <div className="animate-hud-in px-6 text-center">
        <div className="font-hud" style={{ color: theme.bright, fontSize: '0.75rem' }}>
          FIVE LOCATIONS FLOWN
        </div>
        <div
          className="font-hero mt-3"
          style={{
            fontSize: 'clamp(1.5rem, 5vw, 3rem)',
            color: COLORS.textPrimary,
            textShadow: `0 0 24px ${theme.base}88`,
            minHeight: '1em',
          }}
        >
          {title || ' '}
        </div>
        <div className="font-data mt-3" style={{ color: COLORS.textSecondary, fontSize: '0.75rem' }}>
          OPENING THE MAP — THE GAME AND CONTACT ARE STILL OUT THERE
        </div>
      </div>
    </div>
  );
}

/**
 * Full-frame white-blue flash: entering and leaving the tunnel, the ship
 * dropping out of hyperspace, the camera passing through the canopy glass.
 * Driven straight from the camera's telemetry on animation frames.
 */
function Flash() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (ref.current) ref.current.style.opacity = camTelemetry.flash.toFixed(3);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      ref={ref}
      className="absolute inset-0"
      style={{
        opacity: 0,
        background: 'radial-gradient(ellipse at 50% 45%, #ffffff 0%, #cfe6ff 38%, #6fa8ff 100%)',
        mixBlendMode: 'screen',
      }}
    />
  );
}

/* ─────────────────────────── ROOT ────────────────────────── */

export function Hud() {
  const phase = useApp((s) => s.phase);
  const location = useApp((s) => s.location);
  const reducedMotion = useApp((s) => s.reducedMotion);
  const titleUp = useApp((s) => s.titleUp);
  // during a JUMP the hyperspace tunnel owns the whole frame — no HUD chrome
  const inFlight = phase === 'FLIGHT';

  // M opens/closes the map, Escape closes it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const s = useApp.getState();
      if (e.code === 'KeyM') {
        if (s.mapOpen) s.closeMap();
        else s.openMap();
      } else if (e.code === 'Escape' && s.mapOpen) {
        s.closeMap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    // z-40 keeps HUD chrome (and the map) above the in-world <Html> panels,
    // which are capped at zIndexRange [30, 10]
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      style={{ zIndex: 40 }}
    >
      {/* canopy scanlines over everything */}
      <div className="absolute inset-0 canopy-scanlines" />

      <Flash />

      {phase === 'INTRO' && titleUp && (
        <div className="pointer-events-auto absolute inset-0">
          <IntroOverlay />
        </div>
      )}
      {phase === 'BOARDING' && (
        <div className="pointer-events-auto absolute inset-0">
          <BoardingOverlay />
        </div>
      )}

      {inFlight && (
        <>
          <LocationReadout />
          <StopRail />
          <ContentCard />
          {location === 'COMMS' && <CommsPanel />}
          {location === 'ARENA' && <ArenaHud />}
          <FlightPrompt />
          <BottomBar />
          <FinaleOverlay />
          <MapOverlay />
        </>
      )}

      {/* reduced-motion jump: quick dissolve instead of the tunnel */}
      {reducedMotion && (
        <div
          className="absolute inset-0"
          style={{
            background: COLORS.void,
            opacity: phase === 'JUMP' ? 1 : 0,
            transition: 'opacity 180ms ease',
          }}
        />
      )}
    </div>
  );
}
