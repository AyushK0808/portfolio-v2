'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useApp } from '@/state/store';
import { COLORS, MISSION_ORDER, SECTORS, MissionId } from '@/lib/theme';
import { DIAL_NODES } from '@/systems/flightplan';
import { Interactable } from '../Interactable';
import { HoloMaterial, FONT_HUD, FONT_MONO } from '../materials';

const NODE_LABEL: Record<MissionId, string> = {
  A: 'DOSSIER',
  B: 'FLIGHT LOG',
  C: 'PROJECTS',
  D: 'GALLERY',
  E: 'ARENA',
  CONTACT: 'COMMS',
};

function DialNode({ id, pos }: { id: MissionId; pos: [number, number, number] }) {
  const theme = SECTORS[id];
  const selectMission = useApp((s) => s.selectMission);
  const hovered = useApp((s) => s.hovered === `dial-${id}`);
  const mat = useRef<InstanceType<typeof HoloMaterial>>(null);
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
        <Text
          font={FONT_HUD}
          fontSize={0.15}
          letterSpacing={0.1}
          color={hovered ? theme.bright : theme.base}
          anchorX="center"
          anchorY="middle"
          position={[0, 0.1, 0.01]}
        >
          {id === 'CONTACT' ? '✉' : id}
        </Text>
        <Text
          font={FONT_HUD}
          fontSize={0.072}
          letterSpacing={0.14}
          color={hovered ? theme.bright : theme.base}
          anchorX="center"
          anchorY="middle"
          position={[0, -0.13, 0.01]}
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
  // the dial is the "select mission" UI — keep it stowed on the title screen
  // (phase BOOT) and only raise it once the pilot powers up
  const phase = useApp((s) => s.phase);
  const dialUp = phase !== 'BOOT';

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
          <Text
            font={FONT_MONO}
            fontSize={0.07}
            color={COLORS.textMuted}
            anchorX="center"
            position={[0, 0.62, -2.9]}
            rotation={[-0.4, 0, 0]}
          >
            NAV DIAL v2.0 — PLOT HYPERSPACE VECTOR
          </Text>
        </group>
      )}

      {/* distant scenery: a far-off station and planet glow for depth */}
      <mesh position={[-60, 18, -160]}>
        <sphereGeometry args={[22, 32, 32]} />
        <meshStandardMaterial color="#101B2E" roughness={1} />
      </mesh>
      <mesh position={[-60, 18, -160]} scale={1.03}>
        <sphereGeometry args={[22, 32, 32]} />
        <meshBasicMaterial color={COLORS.hudCyanDim} transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      <group position={[45, -6, -120]} rotation={[0.2, 0.8, 0.1]}>
        <mesh>
          <cylinderGeometry args={[1.2, 1.2, 14, 8]} />
          <meshStandardMaterial color={COLORS.panelEdge} metalness={0.8} roughness={0.5} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[6, 0.5, 8, 32]} />
          <meshStandardMaterial color={COLORS.panelEdge} metalness={0.8} roughness={0.5} />
        </mesh>
      </group>

      {/* distant capital-ship wedge slipping by — a quiet Star Wars nod */}
      <group position={[-90, -20, -230]} rotation={[0.06, 0.5, 0.02]}>
        {/* long flat triangular hull (3-sided cone, squashed) */}
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[10, 46, 2.4]}>
          <coneGeometry args={[1, 1, 3]} />
          <meshStandardMaterial color="#0B1420" metalness={0.6} roughness={0.6} />
        </mesh>
        {/* command tower */}
        <mesh position={[0, 1.2, 16]}>
          <boxGeometry args={[3.2, 2.2, 4]} />
          <meshStandardMaterial color="#0E1826" metalness={0.7} roughness={0.5} />
        </mesh>
        {/* faint cyan running lights along the belly */}
        <mesh position={[0, -1, -2]}>
          <boxGeometry args={[9, 0.12, 40]} />
          <meshBasicMaterial color={COLORS.hudCyanDim} transparent opacity={0.25} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
