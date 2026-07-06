'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useApp } from '@/state/store';
import { COLORS, SECTORS } from '@/lib/theme';
import { DOSSIER_POS, STATION_POS, SUBSYS_NODES, FLIGHT } from '@/systems/flightplan';
import { DOSSIER } from '@/content/bio';
import { SUBSYSTEMS } from '@/content/skills';
import { Model } from '../Model';
import { HoloPanel, HoloText, HoloBar } from '../HoloPanel';
import { Interactable } from '../Interactable';
import { HoloMarker, faceYaw } from '../Markers';
import { FONT_HUD } from '../materials';

const theme = SECTORS.A;

const BIG_SHIP_URL = '/3d/big_ship.glb';
useGLTF.preload(BIG_SHIP_URL);

/** home station — the big_ship capital vessel anchoring the sector, warm amber rig */
function HomeStation() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    // slow yaw drift so the capital ship feels like it's holding station
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.02;
  });

  return (
    <group position={STATION_POS}>
      <group ref={group}>
        {/* no inner <Suspense>: let the big_ship load bubble up to the Scene
            boundary so the sector placeholder + lightspeed loader wait on it */}
        <Model url={BIG_SHIP_URL} fit={22} />
      </group>
      {/* warm amber rig so the hull reads in the sector palette */}
      <pointLight color={theme.base} intensity={4} distance={60} decay={1.6} />
      <pointLight position={[0, 14, 8]} color={theme.bright} intensity={3} distance={50} decay={1.8} />
      <directionalLight position={[10, 12, 6]} color="#FFE0A8" intensity={1.4} />
    </group>
  );
}

/**
 * MISSION A — Home Station: Captain's Dossier + Ship Subsystems (skills).
 */
export default function SectorA() {
  const focus = useApp((s) => s.focus);

  const dossierPark = FLIGHT.A.pois.dossier.pos;

  return (
    <group>
      <HomeStation />

      {/* ── Captain's Dossier ── */}
      <group position={DOSSIER_POS} rotation={faceYaw(DOSSIER_POS, dossierPark)}>
        {focus !== 'dossier' && (
          <Interactable id="dossier">
            <HoloMarker color={theme.base} label="Captain's Dossier" active />
          </Interactable>
        )}
        <HoloPanel
          width={3.1}
          height={2.35}
          color={theme.base}
          visible={focus === 'dossier'}
          title="CAPTAIN'S DOSSIER — CLEARANCE GRANTED"
        >
          <HoloText x={-1.42} y={0.92} size={0.135} color={COLORS.textPrimary} font={FONT_HUD}>
            {DOSSIER.callsign}
          </HoloText>
          <HoloText x={-1.42} y={0.72} size={0.052} color={theme.bright}>
            {`${DOSSIER.rank} · ${DOSSIER.posting}`}
          </HoloText>
          <HoloText x={-1.42} y={0.60} size={0.052} color={COLORS.textSecondary}>
            {`${DOSSIER.origin} · GPA ${DOSSIER.gpa}`}
          </HoloText>
          <HoloText x={-1.42} y={0.44} size={0.055} color={COLORS.textSecondary} maxWidth={2.84} lineHeight={1.45}>
            {DOSSIER.bio.join('\n\n')}
          </HoloText>
          <HoloText x={-1.42} y={-0.92} size={0.048} color={theme.base}>
            {DOSSIER.traits.join('  ·  ')}
          </HoloText>
          <HoloText x={1.42} y={0.92} size={0.05} color={COLORS.success} anchorX="right">
            {`STATUS: ${DOSSIER.status}`}
          </HoloText>
        </HoloPanel>
      </group>

      {/* ── Ship Subsystems (skills) — one checkpoint per subsystem ── */}
      {SUBSYSTEMS.map((sub, i) => {
        const node = SUBSYS_NODES[i];
        const park = FLIGHT.A.pois[node.id].pos;
        const isFocus = focus === node.id;
        return (
          <group key={sub.id} position={node.pos} rotation={faceYaw(node.pos, park)}>
            {!isFocus && (
              <group position={[0, 0.55, 0]}>
                <Interactable id={node.id}>
                  <HoloMarker color={theme.base} label={sub.system} active />
                </Interactable>
              </group>
            )}
            <HoloPanel
              width={2.7}
              height={1.75}
              color={theme.base}
              visible={isFocus}
              title={`SUBSYSTEM ${String(i + 1).padStart(2, '0')}/${SUBSYSTEMS.length} — SKILL READOUT`}
            >
              <HoloText x={-1.25} y={0.6} size={0.15} color={theme.bright} font={FONT_HUD}>
                {sub.system}
              </HoloText>
              <HoloText x={-1.25} y={0.37} size={0.07} color={COLORS.textSecondary}>
                {sub.domain}
              </HoloText>
              <HoloBar x={-1.25} y={0.19} width={2.0} level={sub.level} color={theme.base} />
              <HoloText x={1.25} y={0.26} size={0.062} color={theme.bright} anchorX="right">
                {`${sub.level}%`}
              </HoloText>
              <HoloText x={-1.25} y={0.05} size={0.068} color={COLORS.textPrimary} maxWidth={2.5} lineHeight={1.4}>
                {sub.items.join(' · ')}
              </HoloText>
              <HoloText x={-1.25} y={-0.36} size={0.058} color={COLORS.textSecondary} maxWidth={2.5} lineHeight={1.4}>
                {sub.detail}
              </HoloText>
              <HoloText x={1.25} y={0.6} size={0.05} color={COLORS.success} anchorX="right">
                NOMINAL
              </HoloText>
            </HoloPanel>
          </group>
        );
      })}
    </group>
  );
}
