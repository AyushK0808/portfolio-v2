'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, Text } from '@react-three/drei';
import { useApp } from '@/state/store';
import { COLORS, SECTORS, MissionId } from '@/lib/theme';
import { DIAL_NODES } from '@/systems/flightplan';
import { Interactable } from '../Interactable';
import { HoloMaterial, FONT_HUD, FONT_MONO } from '../materials';
import { InstrumentCluster } from '@/components/hud/instruments';

const NODE_LABEL: Record<MissionId, string> = {
  A: 'DOSSIER',
  B: 'FLIGHT LOG',
  C: 'PROJECTS',
  D: 'GALLERY',
  E: 'ARENA',
  CONTACT: 'COMMS',
};

/** mission glyphs — outline strokes (24×24 SVG path data) rasterized to
 *  canvas textures; monochrome line-art versions of the old emoji icons */
const NODE_ICON: Record<MissionId, string> = {
  // pilot (was 🧑‍🚀): head + shoulders
  A: 'M16 8a4 4 0 1 1-8 0a4 4 0 0 1 8 0M4 21v-1a8 8 0 0 1 16 0v1',
  // satellite (was 🛰️)
  B: 'M13 7L9 3L5 7l4 4M17 11l4 4-4 4-4-4M8 12l4 4 6-6-4-4-6 6M16 8l3-3M9 21a6 6 0 0 0-6-6',
  // wrench (was 🛠️)
  C: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  // picture frame (was 🖼️)
  D: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM10.5 8.5a1.5 1.5 0 1 1-3 0a1.5 1.5 0 0 1 3 0M21 15l-5-5L5 21',
  // target (was 🎯)
  E: 'M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0M17 12a5 5 0 1 1-10 0a5 5 0 0 1 10 0M13 12a1 1 0 1 1-2 0a1 1 0 0 1 2 0',
  // satellite dish (was 📡)
  CONTACT: 'M4 10a7.31 7.31 0 0 0 10 10ZM9 15l3-3M17 13a6 6 0 0 0-6-6M21 13A10 10 0 0 0 11 3',
};

function useIconTexture(path: string, glow: string) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.scale(128 / 28, 128 / 28); // 24-unit art + 2-unit bleed for the glow
      ctx.translate(2, 2);
      ctx.lineWidth = 1.7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = COLORS.textPrimary;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 10;
      const p = new Path2D(path);
      ctx.stroke(p);
      ctx.stroke(p); // second pass thickens the glow
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [path, glow]);
}

function DialNode({ id, pos }: { id: MissionId; pos: [number, number, number] }) {
  const theme = SECTORS[id];
  const selectMission = useApp((s) => s.selectMission);
  const hovered = useApp((s) => s.hovered === `dial-${id}`);
  const mat = useRef<InstanceType<typeof HoloMaterial>>(null);
  const iconTex = useIconTexture(NODE_ICON[id], theme.bright);
  const yaw: [number, number, number] = [0, Math.atan2(pos[0], pos[2]) + Math.PI, 0];

  useFrame((state, dt) => {
    if (!mat.current) return;
    mat.current.uTime = state.clock.elapsedTime;
    const target = hovered ? 1 : 0.55;
    mat.current.uOpacity += (target - mat.current.uOpacity) * Math.min(dt * 10, 1);
  });

  return (
    <group position={pos} rotation={yaw}>
      <Interactable id={`dial-${id}`} onSelect={() => selectMission(id)}>
        <mesh>
          <planeGeometry args={[0.92, 0.6]} />
          <holoMaterial
            ref={mat}
            uColor={new THREE.Color(theme.base)}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0.1, 0.01]}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial
            map={iconTex}
            transparent
            toneMapped={false}
            depthWrite={false}
            opacity={hovered ? 1 : 0.85}
          />
        </mesh>
        <Text
          font={FONT_HUD}
          fontSize={0.072}
          letterSpacing={0.14}
          color={hovered ? theme.bright : theme.base}
          anchorX="center"
          anchorY="middle"
          position={[0, -0.15, 0.01]}
        >
          {NODE_LABEL[id]}
        </Text>
      </Interactable>
    </group>
  );
}

/**
 * BRIDGE — home base. Holographic mission dial floating over the dashboard
 * (bible §9 state 1). Selecting a node engages the warp.
 */
export default function Bridge() {
  const ring = useRef<THREE.Mesh>(null);
  // the dial is the "select mission" UI — keep it stowed through the title
  // screen AND the boarding flight (the POWERUP camera dives right through
  // the dial's airspace); it raises the moment the pilot hits the seat
  const phase = useApp((s) => s.phase);
  const dialUp = phase !== 'BOOT' && phase !== 'POWERUP';

  useFrame((state) => {
    if (ring.current) ring.current.rotation.z = state.clock.elapsedTime * 0.05;
  });

  return (
    <group>
      {dialUp && (
        <group>
          {DIAL_NODES.map((n) => (
            <DialNode key={n.id} id={n.id} pos={n.pos} />
          ))}

          {/* holo base ring under the dial */}
          <mesh ref={ring} position={[0, 0.4, -2.6]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.6, 2.72, 64]} />
            <meshBasicMaterial
              color={COLORS.hudCyanDim}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>

          {/* radar + instrument charts projected inside the dial, tilted
              toward the pilot like a holo console readout — bridge only.
              gated on phase (not just sector) so the DOM <Html> can't flash
              through the lightspeed tunnel: during warp `sector` stays BRIDGE
              for the first half of the transition (store swaps it mid-warp) */}
          {phase === 'BRIDGE' && (
            <Html
              transform
              position={[0, 0.68, -2.45]}
              rotation={[-0.5, 0, 0]}
              scale={0.22}
              zIndexRange={[30, 10]}
              style={{ pointerEvents: 'none', userSelect: 'none', opacity: 0.94 }}
            >
              <InstrumentCluster />
            </Html>
          )}
          {/* header sits above the node rows — the instrument cluster now
              owns the space over the base ring */}
          <Text
            font={FONT_MONO}
            fontSize={0.07}
            color={COLORS.textMuted}
            anchorX="center"
            position={[0, 2.55, -3.4]}
            rotation={[0.12, 0, 0]}
          >
            NAV DIAL v2.0 — PLOT HYPERSPACE VECTOR
          </Text>
        </group>
      )}
    </group>
  );
}
