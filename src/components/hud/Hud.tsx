'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '@/state/store';
import { audio } from '@/systems/audio';
import { COLORS, MISSION_ORDER, SECTORS, MissionId } from '@/lib/theme';
import { POI_ORDER } from '@/systems/flightplan';
import { PROJECTS } from '@/content/projects';
import { camTelemetry } from '../three/CameraDirector';
import { InstrumentCluster } from './instruments';
import { useDecode } from './useDecode';

/* ────────────────────────── BOOT ────────────────────────── */

function BootOverlay() {
  const boot = useApp((s) => s.boot);
  const title = useDecode('AYUSH KUMAR', 55);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* title rides the top of the frame; the cruising hero ship owns the middle */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[9vh] w-full px-4 text-center">
        <div
          className="font-hero animate-hud-in"
          style={{
            fontSize: 'clamp(2.75rem, 7vw, 5.5rem)',
            lineHeight: 0.95,
            color: COLORS.textPrimary,
            textShadow: `0 0 24px ${COLORS.hudCyan}88, 0 0 80px ${COLORS.hudCyan}44`,
            minHeight: '1em',
          }}
        >
          {title || ' '}
        </div>
        <div
          className="font-hud animate-hud-in mt-4"
          style={{ color: COLORS.textSecondary, fontSize: '0.8125rem', animationDelay: '600ms' }}
        >
          FLIGHT SYSTEMS STANDBY · PORTFOLIO CLASS VESSEL
        </div>
        <div
          className="font-data animate-hud-in mt-2"
          style={{ color: COLORS.textMuted, fontSize: '0.6875rem', animationDelay: '900ms' }}
        >
          VESSEL AYK-08 CRUISING AT SUBLIGHT — AWAITING MISSION ORDERS
        </div>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 bottom-[17vh] pointer-events-auto flex flex-col items-center gap-3">
        <button
          onClick={boot}
          onMouseEnter={() => audio.blip()}
          className="hud-btn animate-breathe"
          style={{ fontSize: '1rem', padding: '14px 42px', borderWidth: 2 }}
        >
          [ SELECT MISSION ]
        </button>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto">
        <Link
          href="/resume"
          className="hud-interactive font-data"
          style={{ color: COLORS.textMuted, fontSize: '0.75rem' }}
        >
          skip the flight → view résumé
        </Link>
      </div>
    </div>
  );
}

/* ──────────────────────── POWER-UP ───────────────────────── */

const BOOT_LINES = [
  'SYS: POWER BUS ............ ONLINE',
  'SYS: NAV COMPUTER ......... ONLINE',
  'SYS: COMMS ARRAY .......... ONLINE',
  'SYS: PROPULSION ........... ONLINE',
  'SYS: HOLOGRAPHIC DIAL ..... ONLINE',
  'PILOT RECOGNIZED — WELCOME ABOARD',
];

function PowerUpOverlay() {
  const bridgeReady = useApp((s) => s.bridgeReady);
  return (
    <div
      className="absolute inset-0 flex items-end justify-start p-10 cursor-pointer"
      onClick={bridgeReady}
      title="click to skip"
    >
      <div className="font-data" style={{ fontSize: '0.8125rem' }}>
        {BOOT_LINES.map((line, i) => (
          <div
            key={line}
            className="animate-flicker-in"
            style={{
              animationDelay: `${200 + i * 320}ms`,
              color: i === BOOT_LINES.length - 1 ? COLORS.hudCyanBright : COLORS.success,
              marginBottom: 4,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────── MAIN HUD BITS ───────────────────── */

function ObjectiveLog() {
  const sector = useApp((s) => s.sector);
  const phase = useApp((s) => s.phase);
  const warpTarget = useApp((s) => s.warpTarget);
  const hovered = useApp((s) => s.hovered);

  // hovering a dial node previews that mission's briefing
  const dialHover =
    hovered?.startsWith('dial-') ? (hovered.slice(5) as MissionId) : null;
  const shown = phase === 'WARP' && warpTarget ? SECTORS[warpTarget] : dialHover ? SECTORS[dialHover] : SECTORS[sector];
  const briefing = phase === 'WARP' ? 'ENGAGING WARP DRIVE…' : shown.briefing;
  const decoded = useDecode(briefing, 12);

  return (
    <div className="hud-corner top-4 left-4 md:top-6 md:left-6 max-w-[70vw]">
      <div className="font-hud" style={{ color: shown.base, fontSize: '0.9rem' }}>
        {shown.name}
      </div>
      <div
        className="font-data mt-1"
        style={{ color: COLORS.textSecondary, fontSize: '0.6875rem', minHeight: '1em' }}
      >
        {decoded}
      </div>
      <MissionExtras />
      <MissionTally />
    </div>
  );
}

function MissionExtras() {
  const sector = useApp((s) => s.sector);
  const phase = useApp((s) => s.phase);
  const scanned = useApp((s) => s.scanned);
  const arenaScore = useApp((s) => s.arenaScore);
  const arenaBest = useApp((s) => s.arenaBest);
  const arenaGlobalBest = useApp((s) => s.arenaGlobalBest);
  const navMode = useApp((s) => s.navMode);
  const focus = useApp((s) => s.focus);

  if (phase !== 'MISSION') return null;
  return (
    <div className="font-data mt-2" style={{ fontSize: '0.6875rem', color: COLORS.textMuted }}>
      {sector === 'C' && (
        <div style={{ color: SECTORS.C.bright }}>
          ARTIFACTS SCANNED: {scanned.length}/{PROJECTS.length}
        </div>
      )}
      {sector === 'E' && (
        <div style={{ color: SECTORS.E.bright }}>
          SCORE {arenaScore} · BEST {arenaBest} · ★ GALAXY {Math.max(arenaGlobalBest, arenaScore)}
          <div style={{ color: COLORS.textMuted }}>DRAG TO AIM · CLICK / SPACE TO FIRE</div>
          <div style={{ color: COLORS.textMuted }}>EXIT GAME TO END MISSION</div>
        </div>
      )}
      {navMode === 'MANUAL' && sector !== 'E' && (
        <div>WASD/ARROWS — THRUST · R/F — LIFT · DRAG — LOOK</div>
      )}
      {focus && <div>ESC — RELEASE DOCK</div>}
    </div>
  );
}

/** missions-cleared pips, always visible under the objective log */
function MissionTally() {
  const completed = useApp((s) => s.completedMissions);
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="font-data" style={{ fontSize: '0.625rem', color: COLORS.textMuted }}>
        CLEARED {completed.length}/{MISSION_ORDER.length}
      </span>
      {MISSION_ORDER.map((m) => {
        const done = completed.includes(m);
        return (
          <span
            key={m}
            title={SECTORS[m].name}
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: done ? SECTORS[m].base : 'transparent',
              border: `1px solid ${done ? SECTORS[m].base : COLORS.textMuted}`,
              boxShadow: done ? `0 0 6px ${SECTORS[m].base}AA` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

function SubsystemStrip() {
  const quality = useApp((s) => s.quality);
  const setQuality = useApp((s) => s.setQuality);
  const muted = useApp((s) => s.muted);
  const toggleMute = useApp((s) => s.toggleMute);
  const navMode = useApp((s) => s.navMode);
  const setNavMode = useApp((s) => s.setNavMode);

  const item = (label: string, value: string, active: boolean, onClick: () => void) => (
    <button
      onClick={() => {
        audio.click();
        onClick();
      }}
      onMouseEnter={() => audio.blip()}
      className="hud-interactive font-data text-left"
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.6875rem',
        color: COLORS.textMuted,
        display: 'block',
      }}
    >
      <span>{label} </span>
      <span style={{ color: active ? COLORS.success : COLORS.warning }}>{value}</span>
    </button>
  );

  return (
    <div className="hud-corner top-4 right-4 md:top-6 md:right-6 text-right hud-panel px-3 py-2">
      {item('SHIELDS', quality, quality === 'CINEMATIC', () =>
        setQuality(quality === 'CINEMATIC' ? 'PERFORMANCE' : 'CINEMATIC'),
      )}
      {item('COMMS', muted ? 'MUTED' : 'LIVE', !muted, toggleMute)}
      {item('NAV', navMode === 'AUTO' ? 'AUTOPILOT' : 'MANUAL', navMode === 'AUTO', () =>
        setNavMode(navMode === 'AUTO' ? 'MANUAL' : 'AUTO'),
      )}
    </div>
  );
}

/* ─────────────── COMMAND CENTER (bottom-center cluster) ──────────── */

/** rotating galaxy news flashes — keeps the sector feeling inhabited */
const NEWS_FLASHES = [
  'HYPERLANE 7 REOPENS AFTER METEOR SWEEP — TRAFFIC NOMINAL',
  'RECRUITERS SPOTTED SCOUTING THE OUTER RIM FOR FULL-STACK PILOTS',
  'MUSTAFAR ARENA CHAMPIONSHIP: ROOKIE CLEARS 15 TARGETS OVER THE LAVA FIELDS',
  'COMMS RELAY UPGRADE COMPLETE — TRANSMISSIONS NOW 12% SHINIER',
  'DEBRIS FIELD C YIELDS RARE ARTIFACTS — SCANNER CREWS OVERJOYED',
  'FUEL PRICES DIP ALONG THE CORUSCANT APPROACH — FREIGHTER GUILD CELEBRATES',
  'OBSERVATION DECK D VOTED BEST VIEW IN THE GALAXY, THIRD YEAR RUNNING',
  'NAV BEACON DRIFT CORRECTED — AUTOPILOT ACCURACY AT ALL-TIME HIGH',
];

function NewsMarquee() {
  // two identical copies scrolling by -50% loop seamlessly
  const feed = NEWS_FLASHES.join('  ···  ');
  return (
    <div
      className="hud-panel flex items-center gap-2 px-3 py-1"
      style={{ maxWidth: 'min(640px, 72vw)' }}
    >
      <span
        className="font-hud animate-breathe shrink-0"
        style={{ color: COLORS.warning, fontSize: '0.5625rem' }}
      >
        ▚ GNN LIVE
      </span>
      <div style={{ overflow: 'hidden' }}>
        <div
          className="marquee-track font-data"
          style={{ color: COLORS.textSecondary, fontSize: '0.625rem' }}
        >
          <span>{feed}&nbsp;&nbsp;···&nbsp;&nbsp;</span>
          <span aria-hidden="true">{feed}&nbsp;&nbsp;···&nbsp;&nbsp;</span>
        </div>
      </div>
    </div>
  );
}

/** bottom-center strip — news marquee, plus the instrument cluster in missions */
function CommandCenter() {
  const phase = useApp((s) => s.phase);
  return (
    <div className="hud-corner bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
      {/* the bridge projects the radar + charts inside the 3D nav dial; once a
          mission swaps that dial out, surface the same cluster here so the
          instruments never disappear (arena/comms just show an empty sweep) */}
      {phase === 'MISSION' && (
        <div className="pointer-events-none">
          <InstrumentCluster />
        </div>
      )}
      <NewsMarquee />
    </div>
  );
}

function ControlCluster() {
  const phase = useApp((s) => s.phase);
  const sector = useApp((s) => s.sector);
  const returnToBridge = useApp((s) => s.returnToBridge);
  const exitArena = useApp((s) => s.exitArena);
  const openShipView = useApp((s) => s.openShipView);

  // mission-selection screen (bridge): offer the walk-around ship inspection
  if (phase === 'BRIDGE') {
    return (
      <div className="hud-corner bottom-4 right-4 md:bottom-6 md:right-6">
        <button className="hud-btn" onClick={openShipView} onMouseEnter={() => audio.blip()}>
          ▸ VIEW SPACESHIP
        </button>
      </div>
    );
  }

  if (phase !== 'MISSION') return null;

  return (
    <div className="hud-corner bottom-4 right-4 md:bottom-6 md:right-6 flex flex-col items-end gap-2">
      {sector === 'E' ? (
        // arena runs until the pilot bails out — exiting raises the
        // MISSION COMPLETE overlay (which owns the return-to-bridge button)
        <button className="hud-btn" onClick={exitArena} onMouseEnter={() => audio.blip()}>
          ⏻ EXIT GAME
        </button>
      ) : (
        <button className="hud-btn" onClick={returnToBridge} onMouseEnter={() => audio.blip()}>
          ↩ RETURN TO BRIDGE
        </button>
      )}
    </div>
  );
}

/* ─────────────────── SCROLL FLIGHT CONTROL ───────────────── */

/**
 * Scroll = fly. Wheel / trackpad / touch swipe advances the autopilot
 * through the sector's waypoints; scrolling past the last one completes
 * the mission. Replaces the old PREV/NEXT buttons.
 */
function ScrollNavigator() {
  useEffect(() => {
    let acc = 0;
    let lockUntil = 0;
    let touchY: number | null = null;

    // one waypoint hop should feel immediate but let the camera settle before
    // the next; completing / backing out get a slightly longer beat.
    const STEP_LOCK = 560;
    const COMPLETE_LOCK = 1600;
    const BACK_LOCK = 640;
    const THRESHOLD = 48;

    const step = (dir: 1 | -1) => {
      const s = useApp.getState();
      if (s.phase !== 'MISSION' || s.navMode !== 'AUTO' || s.missionCompleteShown) return;
      const order = POI_ORDER[s.sector];
      if (order.length === 0) return;
      const now = performance.now();
      if (now < lockUntil) return;

      const idx = s.focus ? order.indexOf(s.focus) : -1;
      if (dir === 1) {
        if (idx === order.length - 1) {
          // scrolled past the final waypoint — mission cleared
          s.completeMission(s.sector as MissionId, true);
          lockUntil = now + COMPLETE_LOCK;
          return;
        }
        s.setFocus(order[idx + 1]);
      } else {
        if (idx <= 0) {
          if (s.focus) s.setFocus(null); // back out to the sector overview
          lockUntil = now + BACK_LOCK;
          return;
        }
        s.setFocus(order[idx - 1]);
      }
      lockUntil = now + STEP_LOCK;
    };

    const onWheel = (e: WheelEvent) => {
      // during a hop's cooldown, swallow the flick instead of banking it —
      // otherwise inertial scroll keeps firing steps the moment the lock lifts
      if (performance.now() < lockUntil) {
        acc = 0;
        return;
      }
      // normalize line/page deltas (Firefox, some mice) to pixels
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      const dy = e.deltaY * unit;
      if (Math.sign(dy) !== Math.sign(acc)) acc = 0; // direction flip resets
      acc += dy;
      if (Math.abs(acc) > THRESHOLD) {
        step(acc > 0 ? 1 : -1);
        acc = 0;
      }
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchY === null) return;
      const dy = touchY - (e.changedTouches[0]?.clientY ?? touchY);
      if (Math.abs(dy) > 44) step(dy > 0 ? 1 : -1);
      touchY = null;
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);
  return null;
}

/** vertical waypoint rail — shows where the scroll-autopilot is parked */
function WaypointRail() {
  const phase = useApp((s) => s.phase);
  const sector = useApp((s) => s.sector);
  const focus = useApp((s) => s.focus);
  const navMode = useApp((s) => s.navMode);
  const setFocus = useApp((s) => s.setFocus);
  const theme = SECTORS[sector];

  const order = POI_ORDER[sector];
  if (phase !== 'MISSION' || order.length === 0 || navMode !== 'AUTO') return null;
  const idx = focus ? order.indexOf(focus) : -1;
  const atEnd = idx === order.length - 1;

  return (
    <div className="hud-corner right-4 md:right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
      <div className="font-data" style={{ fontSize: '0.625rem', color: COLORS.textMuted }}>
        {idx + 1}/{order.length}
      </div>
      <div className="flex flex-col items-center gap-1.5">
        {order.map((id, i) => (
          <button
            key={id}
            onClick={() => setFocus(id)}
            onMouseEnter={() => audio.blip()}
            className="hud-interactive"
            title={id.toUpperCase()}
            style={{
              width: i === idx ? 10 : 7,
              height: i === idx ? 10 : 7,
              borderRadius: 999,
              cursor: 'pointer',
              background: i <= idx ? theme.base : 'transparent',
              border: `1px solid ${i <= idx ? theme.base : COLORS.textMuted}`,
              boxShadow: i === idx ? `0 0 8px ${theme.base}` : 'none',
              transition: 'all 160ms var(--ease-hud-in)',
            }}
          />
        ))}
      </div>
      <div
        className="font-data animate-breathe text-center"
        style={{ fontSize: '0.625rem', color: atEnd ? theme.bright : COLORS.textMuted }}
      >
        {atEnd ? (
          <>
            SCROLL ▾<br />
            COMPLETE
          </>
        ) : (
          'SCROLL ▾'
        )}
      </div>
    </div>
  );
}

/* ─────────────────── MISSION COMPLETE ────────────────────── */

function MissionCompleteOverlay() {
  const shown = useApp((s) => s.missionCompleteShown);
  const sector = useApp((s) => s.sector);
  const completed = useApp((s) => s.completedMissions);
  const dismiss = useApp((s) => s.dismissMissionComplete);
  const returnToBridge = useApp((s) => s.returnToBridge);
  const selectMission = useApp((s) => s.selectMission);
  const title = useDecode(shown ? 'MISSION COMPLETE' : '', 40);

  if (!shown) return null;
  const theme = SECTORS[sector];
  const next = MISSION_ORDER.find((m) => !completed.includes(m));
  const allClear = completed.length === MISSION_ORDER.length;

  return (
    <div
      className="pointer-events-auto absolute inset-0 flex items-center justify-center"
      style={{ background: 'rgba(5,6,10,0.55)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="hud-panel animate-hud-in flex flex-col items-center gap-4 px-8 py-8 md:px-14 text-center"
        style={{ borderColor: theme.base, maxWidth: 560 }}
      >
        <div className="font-hud" style={{ color: theme.bright, fontSize: '0.75rem' }}>
          {theme.name} — CLEARED
        </div>
        <div
          className="font-hero"
          style={{
            fontSize: 'clamp(1.6rem, 4.5vw, 2.6rem)',
            color: COLORS.textPrimary,
            textShadow: `0 0 24px ${theme.base}88`,
            minHeight: '1em',
          }}
        >
          {title || ' '}
        </div>

        <div className="flex items-center gap-2">
          {MISSION_ORDER.map((m) => {
            const done = completed.includes(m);
            return (
              <span
                key={m}
                title={SECTORS[m].name}
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 999,
                  background: done ? SECTORS[m].base : 'transparent',
                  border: `1px solid ${done ? SECTORS[m].base : COLORS.textMuted}`,
                  boxShadow: done ? `0 0 8px ${SECTORS[m].base}AA` : 'none',
                }}
              />
            );
          })}
        </div>
        <div className="font-data" style={{ fontSize: '0.75rem', color: COLORS.textSecondary }}>
          MISSIONS CLEARED — {completed.length}/{MISSION_ORDER.length}
        </div>

        {allClear && (
          <div className="font-data" style={{ fontSize: '0.75rem', color: COLORS.success }}>
            ★ FULL DOSSIER UNLOCKED — YOU FLEW EVERY SECTOR. RANK: ACE PILOT.
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {next && (
            <button
              className="hud-btn"
              style={{ fontSize: '0.8125rem', padding: '8px 18px' }}
              onClick={() => selectMission(next)}
              onMouseEnter={() => audio.blip()}
            >
              NEXT MISSION: {SECTORS[next].callsign} ▸
            </button>
          )}
          <button
            className="hud-btn"
            style={{ fontSize: '0.8125rem', padding: '8px 18px' }}
            onClick={returnToBridge}
            onMouseEnter={() => audio.blip()}
          >
            ↩ HEAD BACK TO BRIDGE
          </button>
          <button
            className="hud-btn"
            style={{ fontSize: '0.8125rem', padding: '8px 18px' }}
            onClick={dismiss}
            onMouseEnter={() => audio.blip()}
          >
            ✕ KEEP EXPLORING
          </button>
        </div>
      </div>
    </div>
  );
}

function Reticle() {
  const hovered = useApp((s) => s.hovered);
  const sector = useApp((s) => s.sector);
  const phase = useApp((s) => s.phase);
  const armed = hovered !== null;
  const combat = sector === 'E' && phase === 'MISSION';
  const color = combat ? SECTORS.E.bright : armed ? COLORS.hudCyanBright : COLORS.hudCyan;

  return (
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      style={{
        width: armed || combat ? 34 : 26,
        height: armed || combat ? 34 : 26,
        transition: 'all 120ms cubic-bezier(0.16,1,0.3,1)',
        opacity: armed || combat ? 1 : 0.55,
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{ border: `1.5px solid ${color}`, boxShadow: `0 0 8px ${color}66` }}
      />
      {(armed || combat) &&
        [0, 90, 180, 270].map((deg) => (
          <div
            key={deg}
            className="absolute left-1/2 top-1/2"
            style={{
              width: 2,
              height: 7,
              background: color,
              transform: `translate(-50%,-50%) rotate(${deg}deg) translateY(-21px)`,
            }}
          />
        ))}
      {combat && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: 3, height: 3, background: color }}
        />
      )}
    </div>
  );
}

function CoordsTicker() {
  const [txt, setTxt] = useState('000.0 · 000.0 · 000.0');
  useEffect(() => {
    const iv = window.setInterval(() => {
      const p = camTelemetry.pos;
      setTxt(
        `X ${p.x.toFixed(1).padStart(6, '0')} · Y ${p.y.toFixed(1).padStart(6, '0')} · Z ${p.z
          .toFixed(1)
          .padStart(6, '0')}`,
      );
    }, 150);
    return () => window.clearInterval(iv);
  }, []);
  return (
    <div
      className="hud-corner top-4 left-1/2 -translate-x-1/2 font-data hidden md:block"
      style={{ color: COLORS.textMuted, fontSize: '0.6875rem' }}
    >
      {txt}
    </div>
  );
}

/* ─────────────────────────── ROOT ────────────────────────── */

export function Hud() {
  const phase = useApp((s) => s.phase);
  const reducedMotion = useApp((s) => s.reducedMotion);
  // during WARP the hyperspace tunnel owns the whole frame — no HUD chrome
  const inFlight = phase === 'BRIDGE' || phase === 'MISSION';

  return (
    // z-40 keeps HUD chrome (and the mission-complete overlay) above the
    // in-world <Html> panels, which are capped at zIndexRange [30, 10]
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      style={{ zIndex: 40 }}
    >
      {/* canopy scanlines over everything */}
      <div className="absolute inset-0 canopy-scanlines" />

      {phase === 'BOOT' && (
        <div className="pointer-events-auto absolute inset-0">
          <BootOverlay />
        </div>
      )}
      {phase === 'POWERUP' && (
        <div className="pointer-events-auto absolute inset-0">
          <PowerUpOverlay />
        </div>
      )}

      {inFlight && (
        <>
          <ObjectiveLog />
          <SubsystemStrip />
          <CommandCenter />
          <ControlCluster />
          <ScrollNavigator />
          <WaypointRail />
          <Reticle />
          <CoordsTicker />
          <MissionCompleteOverlay />
        </>
      )}

      {/* the always-available escape hatch (plan §12) — hidden mid-warp;
          bottom-left, since the command center now owns bottom-center */}
      {phase !== 'BOOT' && phase !== 'WARP' && (
        <div className="absolute bottom-3 left-4 md:left-6">
          <Link
            href="/resume"
            className="hud-interactive font-data"
            style={{ color: COLORS.textMuted, fontSize: '0.6875rem' }}
          >
            [ VIEW RÉSUMÉ — TEXT VERSION ]
          </Link>
        </div>
      )}

      {/* reduced-motion warp: quick dissolve instead of the tunnel */}
      {reducedMotion && (
        <div
          className="absolute inset-0"
          style={{
            background: COLORS.void,
            opacity: phase === 'WARP' ? 1 : 0,
            transition: 'opacity 180ms ease',
          }}
        />
      )}
    </div>
  );
}
