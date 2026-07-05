'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useApp } from '@/state/store';
import { COLORS } from '@/lib/theme';

/**
 * First-person cockpit rig, parented to the camera so the "you're in a
 * ship" frame never breaks. Procedural low-poly: dashboard, side struts,
 * blinking LED strip, yoke with stylized gloved hands, faint canopy shell.
 */
/** colored toggle-switch tips + blinking button palette (Falcon dash vibes) */
const SWITCH_TIPS = [COLORS.danger, COLORS.warning, COLORS.success, COLORS.hudCyan, COLORS.warning];
const BTN_COLORS = [COLORS.danger, COLORS.warning, COLORS.success, COLORS.hudCyan];

export function Cockpit() {
  const group = useRef<THREE.Group>(null);
  const yoke = useRef<THREE.Group>(null);
  const leds = useRef<THREE.InstancedMesh>(null);
  const btns = useRef<THREE.InstancedMesh>(null);
  const lever = useRef<THREE.Group>(null);
  const dice = useRef<THREE.Group>(null);
  const reducedMotion = useApp((s) => s.reducedMotion);
  const phase = useApp((s) => s.phase);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    // idle sway ±1° period 6s (bible §6) — cut under reduced motion
    if (group.current && !reducedMotion) {
      group.current.rotation.z = Math.sin((t * Math.PI * 2) / 6) * 0.0175;
      group.current.rotation.x = Math.sin((t * Math.PI * 2) / 7.3) * 0.008;
    }
    if (yoke.current && !reducedMotion) {
      yoke.current.rotation.x = Math.sin(t * 1.1) * 0.021;
    }
    // blink LEDs on a scripted loop
    if (leds.current) {
      for (let i = 0; i < 14; i++) {
        const blink = Math.sin(t * (1.4 + (i % 5) * 0.7) + i * 2.1) > 0.55 ? 1 : 0.25;
        dummy.position.set(-0.52 + i * 0.08, -0.415, -0.86);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(blink);
        dummy.updateMatrix();
        leds.current.setMatrixAt(i, dummy.matrix);
      }
      leds.current.instanceMatrix.needsUpdate = true;
    }
    // button grid: each key blinks its own color on its own clock
    if (btns.current) {
      for (let i = 0; i < 12; i++) {
        const on = Math.sin(t * (0.9 + (i % 4) * 0.55) + i * 1.37) > 0.35 ? 0.55 : 0.12;
        tmpColor.set(BTN_COLORS[i % BTN_COLORS.length]).multiplyScalar(on);
        btns.current.setColorAt(i, tmpColor);
      }
      if (btns.current.instanceColor) btns.current.instanceColor.needsUpdate = true;
    }
    // hyperdrive lever: thrown forward for the jump, eased back on arrival
    if (lever.current) {
      const target = phase === 'WARP' ? -0.55 : 0.35;
      lever.current.rotation.x += (target - lever.current.rotation.x) * Math.min(dt * 5, 1);
    }
    // lucky dice pendulum
    if (dice.current && !reducedMotion) {
      dice.current.rotation.z = Math.sin(t * 0.8) * 0.12;
      dice.current.rotation.x = Math.sin(t * 1.13) * 0.07;
    }
  });

  const strut = (
    <meshStandardMaterial color={COLORS.panelEdge} metalness={0.9} roughness={0.38} />
  );
  const piping = (
    <meshStandardMaterial
      color={COLORS.hudCyan}
      emissive={COLORS.hudCyan}
      emissiveIntensity={1.2}
      toneMapped={false}
    />
  );

  return (
    <group ref={group}>
      {/* dashboard */}
      <mesh position={[0, -0.52, -0.95]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[1.7, 0.34, 0.42]} />
        <meshStandardMaterial color="#0C111B" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* dashboard lip piping */}
      <mesh position={[0, -0.392, -0.878]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[1.7, 0.012, 0.012]} />
        {piping}
      </mesh>
      {/* LED strip */}
      <instancedMesh ref={leds} args={[undefined, undefined, 14]} position={[0, 0, 0]}>
        <sphereGeometry args={[0.011, 6, 6]} />
        <meshStandardMaterial
          emissive={COLORS.hudCyan}
          emissiveIntensity={2.2}
          color="#000000"
          toneMapped={false}
        />
      </instancedMesh>
      {/* ── dash-top gear: switches, keys, hyperdrive lever ── */}
      <group position={[0, -0.52, -0.95]} rotation={[0.5, 0, 0]}>
        {/* toggle switch bank (port side) */}
        <group position={[-0.56, 0.175, 0.07]}>
          <mesh>
            <boxGeometry args={[0.24, 0.01, 0.07]} />
            <meshStandardMaterial color="#141B28" roughness={0.6} metalness={0.5} />
          </mesh>
          {SWITCH_TIPS.map((tip, i) => (
            <group
              key={i}
              position={[-0.088 + i * 0.044, 0.005, 0]}
              rotation={[i % 2 ? 0.55 : -0.5, 0, 0]}
            >
              <mesh position={[0, 0.019, 0]}>
                <cylinderGeometry args={[0.004, 0.0055, 0.038, 6]} />
                <meshStandardMaterial color="#8A93A6" metalness={0.9} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.04, 0]}>
                <sphereGeometry args={[0.007, 6, 6]} />
                <meshStandardMaterial
                  color="#000000"
                  emissive={tip}
                  emissiveIntensity={1.1}
                  toneMapped={false}
                />
              </mesh>
            </group>
          ))}
        </group>

        {/* blinking key grid (starboard side) */}
        <instancedMesh
          ref={btns}
          args={[undefined, undefined, 12]}
          onUpdate={(mesh) => {
            const o = new THREE.Object3D();
            for (let i = 0; i < 12; i++) {
              const col = i % 4;
              const row = Math.floor(i / 4);
              o.position.set(0.44 + col * 0.046, 0.178, 0.04 + row * 0.044);
              o.updateMatrix();
              mesh.setMatrixAt(i, o.matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
          }}
        >
          <boxGeometry args={[0.03, 0.012, 0.03]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>

        {/* hyperdrive lever — punch it, Chewie */}
        <group position={[0.2, 0.175, 0.1]}>
          <mesh>
            <boxGeometry args={[0.07, 0.012, 0.12]} />
            <meshStandardMaterial color="#141B28" roughness={0.6} metalness={0.5} />
          </mesh>
          <group ref={lever} rotation={[0.35, 0, 0]}>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.007, 0.009, 0.1, 8]} />
              <meshStandardMaterial color="#8A93A6" metalness={0.9} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.105, 0]}>
              <sphereGeometry args={[0.016, 10, 10]} />
              <meshStandardMaterial
                color="#2A1608"
                emissive={COLORS.warning}
                emissiveIntensity={0.6}
                toneMapped={false}
              />
            </mesh>
          </group>
        </group>
      </group>

      {/* lucky gold dice — every good freighter has a pair */}
      <group ref={dice} position={[0.5, 0.76, -0.7]}>
        <mesh position={[0, -0.21, 0]}>
          <cylinderGeometry args={[0.0013, 0.0013, 0.42, 4]} />
          <meshStandardMaterial color="#8A6F1E" metalness={1} roughness={0.5} />
        </mesh>
        <mesh position={[-0.011, -0.435, 0]} rotation={[0.5, 0.7, 0.2]}>
          <boxGeometry args={[0.021, 0.021, 0.021]} />
          <meshStandardMaterial
            color="#E8B84B"
            metalness={1}
            roughness={0.28}
            emissive="#4A3407"
            emissiveIntensity={0.35}
          />
        </mesh>
        <mesh position={[0.012, -0.44, 0.006]} rotation={[0.2, 0.3, 0.6]}>
          <boxGeometry args={[0.021, 0.021, 0.021]} />
          <meshStandardMaterial
            color="#E8B84B"
            metalness={1}
            roughness={0.28}
            emissive="#4A3407"
            emissiveIntensity={0.35}
          />
        </mesh>
      </group>

      {/* side struts */}
      <mesh position={[-0.92, 0.1, -0.72]} rotation={[0, 0.5, 0.42]}>
        <boxGeometry args={[0.1, 2.4, 0.16]} />
        {strut}
      </mesh>
      <mesh position={[0.92, 0.1, -0.72]} rotation={[0, -0.5, -0.42]}>
        <boxGeometry args={[0.1, 2.4, 0.16]} />
        {strut}
      </mesh>
      {/* top frame bar */}
      <mesh position={[0, 0.78, -0.78]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[2.1, 0.09, 0.1]} />
        {strut}
      </mesh>
      {/* strut piping */}
      <mesh position={[-0.865, 0.1, -0.695]} rotation={[0, 0.5, 0.42]}>
        <boxGeometry args={[0.012, 2.38, 0.012]} />
        {piping}
      </mesh>
      <mesh position={[0.865, 0.1, -0.695]} rotation={[0, -0.5, -0.42]}>
        <boxGeometry args={[0.012, 2.38, 0.012]} />
        {piping}
      </mesh>
      {/* yoke + stylized hands (lower ~18% of frame) */}
      <group ref={yoke} position={[0, -0.62, -0.66]}>
        <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.02, 8, 24, Math.PI]} />
          <meshStandardMaterial color="#141B28" roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.025, 0.035, 0.16, 8]} />
          <meshStandardMaterial color="#141B28" roughness={0.5} metalness={0.6} />
        </mesh>
        {/* gloved hands: rounded knuckle blobs on the grips */}
        <mesh position={[-0.16, 0.06, 0.02]} rotation={[0.3, 0, 0.2]}>
          <capsuleGeometry args={[0.035, 0.07, 3, 8]} />
          <meshStandardMaterial color="#1A2230" roughness={0.8} />
        </mesh>
        <mesh position={[0.16, 0.06, 0.02]} rotation={[0.3, 0, -0.2]}>
          <capsuleGeometry args={[0.035, 0.07, 3, 8]} />
          <meshStandardMaterial color="#1A2230" roughness={0.8} />
        </mesh>
      </group>
      {/* faint canopy shell glint */}
      <mesh position={[0, 0.25, -0.4]}>
        <sphereGeometry args={[1.45, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.05}
          roughness={0.1}
          metalness={0}
          color="#0A2A33"
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      {/* under-dash cyan uplights (bible §4) */}
      <pointLight position={[-0.4, -0.7, -0.7]} color={COLORS.hudCyan} intensity={0.6} distance={3} />
      <pointLight position={[0.4, -0.7, -0.7]} color={COLORS.hudCyan} intensity={0.6} distance={3} />
    </group>
  );
}
