'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/state/store';
import { COLORS, SECTORS, SectorId } from '@/lib/theme';
import { DIAL_NODES, FLIGHT } from '@/systems/flightplan';

/**
 * Cockpit instrument cluster — radar dish + animated charts. Lives in its
 * own module so the Bridge can project it inside the 3D nav dial (via
 * <Html>) while the HUD keeps the news marquee.
 */

/** radar dots for the mounted sector, normalized to the dish */
function useRadarPoints(sector: SectorId) {
  return useMemo(() => {
    let pts: { id: string; x: number; z: number; color: string }[] = [];
    if (sector === 'BRIDGE') {
      pts = DIAL_NODES.map((n) => ({
        id: n.id,
        x: n.pos[0],
        z: n.pos[2],
        color: SECTORS[n.id].base,
      }));
    } else {
      const plan = FLIGHT[sector];
      pts = Object.entries(plan.pois).map(([id, pose]) => ({
        id,
        x: pose.look[0],
        z: pose.look[2],
        color: SECTORS[sector].base,
      }));
    }
    const maxR = Math.max(12, ...pts.map((p) => Math.hypot(p.x, p.z))) * 1.15;
    return pts.map((p) => ({ ...p, nx: p.x / maxR, nz: p.z / maxR }));
  }, [sector]);
}

export function Radar() {
  const sector = useApp((s) => s.sector);
  const focus = useApp((s) => s.focus);
  const scanned = useApp((s) => s.scanned);
  const points = useRadarPoints(sector);
  const R = 62;

  return (
    <svg width={R * 2 + 8} height={R * 2 + 8} style={{ opacity: 0.9 }}>
      <g transform={`translate(${R + 4},${R + 4})`}>
        <circle r={R} fill="rgba(14,20,32,0.45)" stroke={COLORS.hudCyanDim} strokeWidth="1" />
        <circle r={R * 0.62} fill="none" stroke={COLORS.hudCyanDim} strokeWidth="0.5" opacity="0.6" />
        <circle r={R * 0.28} fill="none" stroke={COLORS.hudCyanDim} strokeWidth="0.5" opacity="0.6" />
        <line x1={-R} x2={R} y1="0" y2="0" stroke={COLORS.hudCyanDim} strokeWidth="0.5" opacity="0.4" />
        <line y1={-R} y2={R} x1="0" x2="0" stroke={COLORS.hudCyanDim} strokeWidth="0.5" opacity="0.4" />
        {/* rotating sweep */}
        <g>
          <line x1="0" y1="0" x2="0" y2={-R} stroke={COLORS.hudCyan} strokeWidth="1" opacity="0.55" />
          <path d={`M0,0 L0,${-R} A${R},${R} 0 0,1 ${R * 0.42},${-R * 0.9} Z`} fill={COLORS.hudCyan} opacity="0.08" />
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0"
            to="360"
            dur="4s"
            repeatCount="indefinite"
          />
        </g>
        {/* waypoints (world +x → right, world -z → up) */}
        {points.map((p) => {
          const dim = sector === 'C' && scanned.includes(p.id);
          const active = focus === p.id;
          return (
            <circle
              key={p.id}
              cx={p.nx * R}
              cy={p.nz * R}
              r={active ? 4 : 2.4}
              fill={p.color}
              opacity={dim ? 0.35 : 0.95}
            >
              {active && (
                <animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite" />
              )}
            </circle>
          );
        })}
        {/* you */}
        <circle r="2.6" fill={COLORS.hudCyanBright} />
      </g>
    </svg>
  );
}

/** animated random-walk sparkline — pure instrument dressing */
export function Sparkline({ label, color }: { label: string; color: string }) {
  const [pts, setPts] = useState<number[]>(() =>
    Array.from({ length: 26 }, () => 0.3 + Math.random() * 0.4),
  );
  useEffect(() => {
    const iv = window.setInterval(() => {
      setPts((p) => {
        const next = Math.min(0.95, Math.max(0.08, p[p.length - 1] + (Math.random() - 0.5) * 0.28));
        return [...p.slice(1), next];
      });
    }, 320);
    return () => window.clearInterval(iv);
  }, []);
  const W = 96;
  const H = 22;
  const path = pts
    .map((v, i) => `${((i / (pts.length - 1)) * W).toFixed(1)},${(H - v * H).toFixed(1)}`)
    .join(' ');
  return (
    <div>
      <div
        className="flex justify-between font-data"
        style={{ fontSize: '0.5625rem', color: COLORS.textMuted }}
      >
        <span>{label}</span>
        <span style={{ color }}>{Math.round(pts[pts.length - 1] * 100)}%</span>
      </div>
      <svg width={W} height={H}>
        <polyline points={`0,${H} ${path} ${W},${H}`} fill={color} opacity="0.08" stroke="none" />
        <polyline points={path} fill="none" stroke={color} strokeWidth="1.2" opacity="0.9" />
      </svg>
    </div>
  );
}

/** jittering channel bars — more instrument dressing */
export function BarGraph({ label, color }: { label: string; color: string }) {
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: 10 }, () => 0.2 + Math.random() * 0.6),
  );
  useEffect(() => {
    const iv = window.setInterval(() => {
      setBars((b) =>
        b.map((v) => Math.min(1, Math.max(0.08, v + (Math.random() - 0.5) * 0.45))),
      );
    }, 420);
    return () => window.clearInterval(iv);
  }, []);
  const W = 96;
  const H = 20;
  const bw = W / bars.length;
  return (
    <div>
      <div className="font-data" style={{ fontSize: '0.5625rem', color: COLORS.textMuted }}>
        {label}
      </div>
      <svg width={W} height={H}>
        {bars.map((v, i) => (
          <rect
            key={i}
            x={i * bw + 1}
            y={H - v * H}
            width={bw - 2}
            height={v * H}
            fill={color}
            opacity={0.35 + v * 0.55}
          />
        ))}
      </svg>
    </div>
  );
}

/** the full instrument cluster projected inside the nav dial */
export function InstrumentCluster() {
  return (
    <div className="flex items-end gap-3">
      <div className="hud-panel flex flex-col gap-1.5 px-2.5 py-1.5">
        <Sparkline label="PWR FLUX" color={COLORS.hudCyan} />
        <BarGraph label="REACTOR" color={COLORS.success} />
      </div>
      <Radar />
      <div className="hud-panel flex flex-col gap-1.5 px-2.5 py-1.5">
        <Sparkline label="SIG NOISE" color={COLORS.warning} />
        <BarGraph label="THRUST" color={COLORS.danger} />
      </div>
    </div>
  );
}
