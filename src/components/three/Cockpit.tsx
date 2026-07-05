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
export function Cockpit() {
  const group = useRef<THREE.Group>(null);
  const yoke = useRef<THREE.Group>(null);
  const leds = useRef<THREE.InstancedMesh>(null);
  const reducedMotion = useApp((s) => s.reducedMotion);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
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
        dummy.scale.setScalar(blink);
        dummy.updateMatrix();
        leds.current.setMatrixAt(i, dummy.matrix);
      }
      leds.current.instanceMatrix.needsUpdate = true;
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
