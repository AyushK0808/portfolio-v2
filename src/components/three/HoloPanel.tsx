'use client';

import { ReactNode, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { easing } from 'maath';
import { useApp } from '@/state/store';
import { COLORS } from '@/lib/theme';
import { HoloMaterial, FONT_HUD, FONT_MONO } from './materials';

interface HoloPanelProps {
  width: number;
  height: number;
  color: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  title?: string;
  visible?: boolean;
  /** floats gently unless reduced motion */
  float?: boolean;
  children?: ReactNode;
}

/**
 * The reusable in-world content surface (bible §7.3): fresnel-edged glass
 * with scanlines, spawn animation (scale-Y print-in) and idle float.
 */
export function HoloPanel({
  width,
  height,
  color,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  title,
  visible = true,
  float = true,
  children,
}: HoloPanelProps) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const mat = useRef<InstanceType<typeof HoloMaterial>>(null);
  const reducedMotion = useApp((s) => s.reducedMotion);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const target = visible ? 1 : 0.001;
    easing.damp(g.scale, 'y', target, visible ? 0.14 : 0.07, dt);
    easing.damp(g.scale, 'x', visible ? 1 : 0.6, 0.16, dt);
    if (mat.current) {
      mat.current.uTime = state.clock.elapsedTime;
      easing.damp(mat.current, 'uOpacity', visible ? 1 : 0, 0.12, dt);
    }
    // hide content until mostly printed so text doesn't show squashed
    if (inner.current) inner.current.visible = g.scale.y > 0.85;
    if (float && !reducedMotion) {
      g.position.y = position[1] + Math.sin(state.clock.elapsedTime * (Math.PI * 2) / 4 + position[0]) * 0.02;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <group ref={group} scale={[1, 0.001, 1]}>
        {/* dark backing so bright world objects don't bleed through the text —
            renderOrder keeps it under the text/scanlines in the transparent pass */}
        <mesh position={[0, 0, -0.005]} renderOrder={-2}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            color="#05060A"
            transparent
            opacity={0.72}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh renderOrder={-1}>
          <planeGeometry args={[width, height]} />
          <holoMaterial
            ref={mat}
            uColor={new THREE.Color(color)}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <group ref={inner}>
          {title && (
            <Text
              font={FONT_HUD}
              fontSize={0.1}
              letterSpacing={0.14}
              color={COLORS.textPrimary}
              outlineWidth={0}
              outlineColor={color}
              outlineBlur={0.035}
              outlineOpacity={0.9}
              anchorX="left"
              anchorY="top"
              position={[-width / 2 + 0.08, height / 2 - 0.07, 0.01]}
            >
              {title.toUpperCase()}
            </Text>
          )}
          {children}
        </group>
      </group>
    </group>
  );
}

/* panel text renders white only (design note: no colored fills on cards) —
   the neutral hierarchy colors map to opacity, anything else becomes a glow */
const NEUTRAL_OPACITY: Record<string, number> = {
  [COLORS.textPrimary]: 1,
  [COLORS.textSecondary]: 0.78,
  [COLORS.textMuted]: 0.5,
};

/** monospace data row helper for panels */
export function HoloText({
  children,
  x,
  y,
  size = 0.055,
  color = COLORS.textSecondary,
  maxWidth,
  font = FONT_MONO,
  anchorX = 'left',
  lineHeight = 1.5,
}: {
  children: string;
  x: number;
  y: number;
  size?: number;
  /** accent colors tint the glow, not the fill — text itself stays white */
  color?: string;
  maxWidth?: number;
  font?: string;
  anchorX?: 'left' | 'center' | 'right';
  lineHeight?: number;
}) {
  const neutral = NEUTRAL_OPACITY[color];
  const glow = neutral === undefined;
  return (
    <Text
      font={font}
      fontSize={size}
      color={COLORS.textPrimary}
      fillOpacity={neutral ?? 1}
      outlineWidth={0}
      outlineColor={glow ? color : COLORS.textPrimary}
      outlineBlur={glow ? size * 0.35 : 0}
      outlineOpacity={0.85}
      anchorX={anchorX}
      anchorY="top"
      position={[x, y, 0.01]}
      maxWidth={maxWidth}
      lineHeight={lineHeight}
      letterSpacing={0.02}
    >
      {children}
    </Text>
  );
}

/** emissive proficiency bar (skills subsystems) */
export function HoloBar({
  x,
  y,
  width,
  level,
  color,
}: {
  x: number;
  y: number;
  width: number;
  level: number; // 0–100
  color: string;
}) {
  const fill = useRef<THREE.Group>(null);
  const pct = Math.max(level / 100, 0.001);

  useFrame((_, dt) => {
    if (!fill.current) return;
    easing.damp(fill.current.scale, 'x', pct, 0.4, dt);
  });

  return (
    <group position={[x, y, 0.012]}>
      <mesh position={[width / 2, 0, 0]}>
        <planeGeometry args={[width, 0.028]} />
        <meshBasicMaterial color={COLORS.panelEdge} transparent opacity={0.6} />
      </mesh>
      {/* scale the group, whose child is offset by half-width, so the
          fill grows from the left edge */}
      <group ref={fill} scale={[0.001, 1, 1]}>
        <mesh position={[width / 2, 0, 0.002]}>
          <planeGeometry args={[width, 0.028]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
