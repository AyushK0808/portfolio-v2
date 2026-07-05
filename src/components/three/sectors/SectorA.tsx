'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useApp } from '@/state/store';
import { COLORS, SECTORS } from '@/lib/theme';
import { DOSSIER_POS, STATION_POS, SUBSYS_NODES, FLIGHT } from '@/systems/flightplan';
import { DOSSIER } from '@/content/bio';
import { SUBSYSTEMS } from '@/content/skills';
import { HoloPanel, HoloText, HoloBar } from '../HoloPanel';
import { Interactable } from '../Interactable';
import { HoloMarker, faceYaw } from '../Markers';
import { FONT_HUD } from '../materials';

const theme = SECTORS.A;

/** friendly modular home station — procedural, warm amber emissives */
function HomeStation() {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.03;
    if (ring.current) ring.current.rotation.z = state.clock.elapsedTime * 0.06;
  });

  const hull = <meshStandardMaterial color="#1A2230" metalness={0.75} roughness={0.45} />;
  const glow = (
    <meshStandardMaterial
      color="#000000"
      emissive={theme.base}
      emissiveIntensity={1.6}
      toneMapped={false}
    />
  );

  return (
    <group ref={group} position={STATION_POS}>
      {/* core */}
      <mesh>
        <cylinderGeometry args={[2.2, 2.2, 7, 10]} />
        {hull}
      </mesh>
      <mesh position={[0, 4.2, 0]}>
        <cylinderGeometry args={[0.9, 1.6, 1.6, 8]} />
        {hull}
      </mesh>
      {/* docking ring */}
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[6.5, 0.45, 8, 40]} />
        {hull}
      </mesh>
      {/* ring spokes */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
          <boxGeometry args={[13, 0.18, 0.18]} />
          {hull}
        </mesh>
      ))}
      {/* window bands */}
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[2.22, 2.22, 0.16, 10]} />
        {glow}
      </mesh>
      <mesh position={[0, -0.8, 0]}>
        <cylinderGeometry args={[2.22, 2.22, 0.16, 10]} />
        {glow}
      </mesh>
      {/* antenna */}
      <mesh position={[0, 6.3, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 2.6, 6]} />
        {hull}
      </mesh>
      <mesh position={[0, 7.7, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        {glow}
      </mesh>
      <pointLight color={theme.base} intensity={3} distance={40} decay={1.8} />
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
