'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/store';
import { audio } from '@/systems/audio';
import { COLORS, LOCATIONS } from '@/lib/theme';
import { camTelemetry } from '../three/CameraDirector';

const theme = LOCATIONS.ARENA;
const MAX_HULL = 3;

/** score, wave and hull while a run is on */
function Readout() {
  const score = useApp((s) => s.arenaScore);
  const wave = useApp((s) => s.arenaWave);
  const hull = useApp((s) => s.arenaHull);
  return (
    <div className="hud-corner top-[74px] left-4 md:top-[84px] md:left-6 font-data" style={{ fontSize: '0.75rem' }}>
      <div style={{ color: theme.bright }}>
        WAVE {wave} · SCORE {score}
      </div>
      <div className="mt-1 flex items-center gap-1.5" aria-label={`Hull ${hull} of ${MAX_HULL}`}>
        <span style={{ color: COLORS.textSecondary }}>HULL</span>
        {Array.from({ length: MAX_HULL }, (_, i) => (
          <span
            key={i}
            style={{
              width: 22,
              height: 8,
              background: i < hull ? (hull === 1 ? COLORS.danger : COLORS.success) : 'transparent',
              border: `1px solid ${i < hull ? (hull === 1 ? COLORS.danger : COLORS.success) : COLORS.textMuted}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** "WAVE 3" across the middle for a moment whenever the wave changes */
function WaveBanner() {
  const wave = useApp((s) => s.arenaWave);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    setShown(wave);
    const t = window.setTimeout(() => setShown(null), 1500);
    return () => window.clearTimeout(t);
  }, [wave]);
  if (shown === null) return null;
  return (
    <div className="absolute inset-x-0 top-[30%] text-center pointer-events-none">
      <div
        key={shown}
        className="font-hero animate-title-land"
        style={{
          fontSize: 'clamp(1.6rem, 6vw, 3.4rem)',
          color: COLORS.textPrimary,
          textShadow: `0 0 26px ${theme.base}`,
        }}
      >
        WAVE {shown}
      </div>
    </div>
  );
}

/** red edge flash when a rock gets through, driven straight from telemetry */
function HitFlash() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (ref.current) ref.current.style.opacity = (camTelemetry.hit * 0.85).toFixed(3);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      ref={ref}
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: 0,
        background: 'radial-gradient(ellipse at center, transparent 38%, rgba(255,40,50,0.75) 100%)',
      }}
    />
  );
}

/** crosshair that follows the mouse (touch screens aim by tapping instead) */
function Crosshair() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !ref.current) return;
      ref.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      ref.current.style.opacity = '1';
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);
  const c = theme.bright;
  return (
    <div ref={ref} className="absolute left-0 top-0 pointer-events-none" style={{ opacity: 0 }}>
      <div
        style={{
          position: 'absolute',
          left: -17,
          top: -17,
          width: 34,
          height: 34,
          borderRadius: 999,
          border: `1.5px solid ${c}`,
          boxShadow: `0 0 8px ${c}66`,
        }}
      />
      {[0, 90, 180, 270].map((deg) => (
        <div
          key={deg}
          style={{
            position: 'absolute',
            left: -1,
            top: -3.5,
            width: 2,
            height: 7,
            background: c,
            transform: `rotate(${deg}deg) translateY(-21px)`,
          }}
        />
      ))}
      <div style={{ position: 'absolute', left: -1.5, top: -1.5, width: 3, height: 3, borderRadius: 999, background: c }} />
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center px-5 pointer-events-auto"
      style={{ background: 'rgba(5,6,10,0.5)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="holo-card animate-hud-in text-center"
        style={{
          ['--accent' as string]: theme.base,
          ['--accent-bright' as string]: theme.bright,
          width: 'min(460px, 100%)',
          padding: '26px 26px 24px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Everything the game draws over the 3D range: the start screen, the live
 * readout, wave banners, the hit flash and the score screen.
 */
export function ArenaHud() {
  const state = useApp((s) => s.arenaState);
  const score = useApp((s) => s.arenaScore);
  const wave = useApp((s) => s.arenaWave);
  const best = useApp((s) => s.arenaBest);
  const globalBest = useApp((s) => s.arenaGlobalBest);
  const startArena = useApp((s) => s.startArena);
  const openMap = useApp((s) => s.openMap);

  const start = () => {
    audio.unlock();
    audio.confirm();
    startArena();
  };

  return (
    <>
      <HitFlash />
      {state === 'PLAYING' && (
        <>
          <Readout />
          <WaveBanner />
          <Crosshair />
        </>
      )}

      {state === 'READY' && (
        <Panel>
          <div className="holo-card-eyebrow font-data">EMBERFALL RANGE</div>
          <h2 className="holo-card-title font-hud">HOLD THE LINE</h2>
          <p className="holo-card-text" style={{ marginTop: 12 }}>
            Rocks come in waves, each one bigger and faster. Shoot them before they reach the ship: three
            hits to the hull ends the run.
          </p>
          <p className="font-data" style={{ color: COLORS.textSecondary, fontSize: '0.75rem', marginBottom: 16 }}>
            <span className="fine-pointer-only">CLICK A ROCK TO FIRE · SPACE FIRES AT THE CROSSHAIR</span>
            <span className="coarse-pointer-only">TAP A ROCK TO FIRE</span>
          </p>
          <div className="font-data" style={{ color: theme.bright, fontSize: '0.75rem', marginBottom: 18 }}>
            ★ GALAXY BEST {globalBest}
          </div>
          <button className="hud-btn holo-card-link" style={{ fontSize: '0.9rem', padding: '12px 30px', borderWidth: 2 }} onClick={start}>
            [ START ]
          </button>
        </Panel>
      )}

      {state === 'OVER' && (
        <Panel>
          <div className="holo-card-eyebrow font-data">HULL BREACHED · WAVE {wave}</div>
          <h2 className="holo-card-title font-hud">RUN OVER</h2>
          <div
            className="font-hero"
            style={{
              fontSize: 'clamp(2.2rem, 9vw, 3.6rem)',
              color: COLORS.textPrimary,
              textShadow: `0 0 24px ${theme.base}`,
              margin: '14px 0 6px',
              letterSpacing: '0.08em',
            }}
          >
            {score}
          </div>
          <div className="font-data" style={{ color: COLORS.textSecondary, fontSize: '0.75rem', lineHeight: 1.8 }}>
            {score > 0 && score >= globalBest ? (
              <div style={{ color: COLORS.success }}>★ NEW GALAXY BEST</div>
            ) : (
              <div>★ GALAXY BEST {globalBest}</div>
            )}
            <div>YOUR BEST THIS VISIT {best}</div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button className="hud-btn holo-card-link" style={{ padding: '10px 22px', borderWidth: 2 }} onClick={start}>
              PLAY AGAIN
            </button>
            <button className="hud-btn" style={{ padding: '10px 22px' }} onClick={openMap}>
              ◈ OPEN MAP
            </button>
          </div>
        </Panel>
      )}
    </>
  );
}
