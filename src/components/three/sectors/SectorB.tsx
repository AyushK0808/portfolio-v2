'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useApp } from '@/state/store';
import { COLORS, SECTORS } from '@/lib/theme';
import { CORRIDOR_NODES, FLIGHT } from '@/systems/flightplan';
import { EXPERIENCE, ExperienceNode } from '@/content/experience';
import { CoruscantPlanet } from '../Planets';
import { HoloPanel, HoloText } from '../HoloPanel';
import { Interactable } from '../Interactable';
import { HoloMarker, faceYaw } from '../Markers';
import { FONT_HUD } from '../materials';

const theme = SECTORS.B;

// approach path off the port bow: a distant speck at the corridor entry that
// swells to fill the left of the frame by the final flight log
const CORUSCANT_FAR = new THREE.Vector3(-85, -14, -150);
const CORUSCANT_NEAR = new THREE.Vector3(
  -42,
  -4,
  CORRIDOR_NODES[CORRIDOR_NODES.length - 1].pos[2] - 53,
);
const coruscantTarget = new THREE.Vector3();

/** Coruscant off the port bow, drawing closer with every outpost logged */
function Coruscant() {
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const focus = useApp((s) => s.focus);
  const idx = focus ? CORRIDOR_NODES.findIndex((n) => n.id === focus) : -1;
  const progress = (idx + 1) / CORRIDOR_NODES.length;

  useFrame((state, dt) => {
    if (spin.current) spin.current.rotation.y = state.clock.elapsedTime * 0.01;
    if (group.current) {
      // slow cinematic drift toward the mark for the current flight log
      coruscantTarget.copy(CORUSCANT_FAR).lerp(CORUSCANT_NEAR, progress);
      group.current.position.lerp(coruscantTarget, 1 - Math.exp(-dt * 0.9));
    }
  });

  return (
    <group ref={group} position={CORUSCANT_FAR}>
      <group ref={spin}>
        {/* procedural ecumenopolis: night-side circuit-grid faces the corridor,
            sun off the port bow lights the far crescent. The shader is fully
            self-lit — no key light needed, nothing reaches the cockpit. */}
        <CoruscantPlanet radius={48} sunDirection={[-0.7, 0.22, -0.5]} />
      </group>
    </group>
  );
}

const KIND_TAG: Record<ExperienceNode['kind'], string> = {
  education: 'ACADEMY',
  work: 'DEPLOYMENT',
  leadership: 'COMMAND',
};

/** small outpost station, three visual variants keyed by node kind */
function Outpost({ kind, seed }: { kind: ExperienceNode['kind']; seed: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.08 + seed;
  });

  const hull = <meshStandardMaterial color="#141C2C" metalness={0.8} roughness={0.4} />;
  const glow = (
    <meshStandardMaterial color="#000" emissive={theme.base} emissiveIntensity={1.5} toneMapped={false} />
  );

  return (
    <group ref={group}>
      {kind === 'education' && (
        <>
          <mesh>
            <dodecahedronGeometry args={[0.9, 0]} />
            {hull}
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.4, 0.07, 6, 28]} />
            {glow}
          </mesh>
        </>
      )}
      {kind === 'work' && (
        <>
          <mesh>
            <boxGeometry args={[1.2, 1.2, 1.2]} />
            {hull}
          </mesh>
          {/* solar wings */}
          <mesh position={[1.35, 0, 0]}>
            <boxGeometry args={[1.4, 0.05, 0.8]} />
            {glow}
          </mesh>
          <mesh position={[-1.35, 0, 0]}>
            <boxGeometry args={[1.4, 0.05, 0.8]} />
            {glow}
          </mesh>
        </>
      )}
      {kind === 'leadership' && (
        <>
          <mesh>
            <octahedronGeometry args={[1, 0]} />
            {hull}
          </mesh>
          <mesh position={[0, 1.3, 0]}>
            <coneGeometry args={[0.3, 0.8, 6]} />
            {glow}
          </mesh>
        </>
      )}
    </group>
  );
}

/**
 * MISSION B — Trajectory Corridor: the experience timeline as a chain of
 * outposts along a glowing flight ribbon, chronological order.
 */
export default function SectorB() {
  const focus = useApp((s) => s.focus);

  const ribbon = useMemo(() => {
    const pts = [
      new THREE.Vector3(0, 0.5, 4),
      ...CORRIDOR_NODES.map((n) => new THREE.Vector3(...n.pos)),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 120, 0.035, 6, false);
  }, []);

  const pulse = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((state) => {
    if (pulse.current) {
      pulse.current.opacity = 0.35 + Math.sin(state.clock.elapsedTime * 2.2) * 0.15;
    }
  });

  return (
    <group>
      <Coruscant />

      {/* flight line ribbon */}
      <mesh geometry={ribbon}>
        <meshBasicMaterial ref={pulse} color={theme.base} transparent opacity={0.4} toneMapped={false} />
      </mesh>

      {EXPERIENCE.map((exp, i) => {
        const node = CORRIDOR_NODES[i];
        const park = FLIGHT.B.pois[exp.id].pos;
        const facing = faceYaw(node.pos, park);
        const isFocus = focus === exp.id;
        return (
          <group key={exp.id} position={node.pos}>
            <Outpost kind={exp.kind} seed={i * 1.7} />
            <group rotation={facing}>
              {!isFocus && (
                <group position={[0, 1.9, 0]}>
                  <Interactable id={exp.id}>
                    <HoloMarker color={theme.base} label={exp.org} />
                  </Interactable>
                </group>
              )}
              {/* dock panel */}
              <group position={[0, 0.4, 2.2]}>
                <HoloPanel
                  width={3.9}
                  height={2.5}
                  color={theme.base}
                  visible={isFocus}
                  title={`LOG ${String(i + 1).padStart(2, '0')}/${EXPERIENCE.length} — ${KIND_TAG[exp.kind]}`}
                >
                  <HoloText x={-1.82} y={0.92} size={0.16} color={COLORS.textPrimary} font={FONT_HUD}>
                    {exp.org}
                  </HoloText>
                  <HoloText x={-1.82} y={0.67} size={0.072} color={theme.bright}>
                    {exp.role}
                  </HoloText>
                  <HoloText x={-1.82} y={0.53} size={0.058} color={COLORS.textMuted}>
                    {`${exp.dates} · ${exp.location}`}
                  </HoloText>
                  <HoloText x={-1.82} y={0.35} size={0.066} color={COLORS.textSecondary} maxWidth={3.64} lineHeight={1.5}>
                    {exp.bullets.map((b) => `▸ ${b}`).join('\n')}
                  </HoloText>
                  <HoloText x={-1.82} y={-1.04} size={0.058} color={theme.base} maxWidth={3.64}>
                    {exp.tech.join(' · ')}
                  </HoloText>
                </HoloPanel>
              </group>
            </group>
          </group>
        );
      })}
    </group>
  );
}
