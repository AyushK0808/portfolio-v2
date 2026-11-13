'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LOCATIONS } from '@/lib/theme';
import { RELAY_POS } from '@/systems/flightplan';
import { GlowMaterial, HullMaterial } from '../kit';
import { Moon, Spin } from '../Worlds';

const theme = LOCATIONS.COMMS;

/** the relay: a deep-space dish on a truss mast, slowly tracking, with a pulsing feed horn */
export function Relay() {
  const dish = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (dish.current) {
      dish.current.rotation.y = 0.5 + Math.sin(t * 0.12) * 0.22;
      dish.current.rotation.x = -0.35 + Math.sin(t * 0.09 + 1) * 0.06;
    }
    if (pulse.current) {
      // a ring of light travelling out along the beam, once every couple of seconds
      const k = (t * 0.5) % 1;
      pulse.current.position.z = 0.9 + k * 7;
      pulse.current.scale.setScalar(0.6 + k * 2.2);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.7;
    }
  });

  return (
    <group position={RELAY_POS}>
      {/* mast + solar wings */}
      <mesh position={[0, -2.6, 0]}>
        <cylinderGeometry args={[0.14, 0.22, 4.6, 8]} />
        <HullMaterial tint="#8a9a92" />
      </mesh>
      <mesh position={[0, -3.4, 0]}>
        <boxGeometry args={[5.4, 0.06, 1.3]} />
        <HullMaterial tint="#3c5a58" repeat={2} />
      </mesh>
      <mesh position={[0, -4.95, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.9]} />
        <HullMaterial tint="#8a9a92" />
      </mesh>
      <mesh position={[0, -5.25, 0.46]}>
        <planeGeometry args={[0.5, 0.12]} />
        <GlowMaterial color={theme.base} />
      </mesh>

      {/* the dish */}
      <group ref={dish}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          {/* a shallow bowl: the lower cap of a sphere, opening toward +Z */}
          <sphereGeometry args={[2.6, 40, 16, 0, Math.PI * 2, 0, 0.62]} />
          <meshStandardMaterial color="#aab8b2" metalness={0.85} roughness={0.38} side={THREE.DoubleSide} envMapIntensity={1.1} />
        </mesh>
        <group position={[0, 0, -2.6]}>
          {/* feed horn on three struts, at the bowl's focus */}
          {[0, 1, 2].map((i) => {
            const a = (i / 3) * Math.PI * 2 + 0.5;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.68, Math.sin(a) * 0.68, 1.75]} rotation={[Math.sin(a) * 0.36, -Math.cos(a) * 0.36, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 2.2, 5]} />
                <HullMaterial tint="#8a9a92" />
              </mesh>
            );
          })}
          <mesh position={[0, 0, 2.85]}>
            <cylinderGeometry args={[0.16, 0.1, 0.36, 10]} />
            <HullMaterial tint="#8a9a92" />
          </mesh>
          <mesh position={[0, 0, 2.62]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <GlowMaterial color={theme.bright} intensity={2.4} />
          </mesh>
          <mesh ref={pulse} position={[0, 0, 3.4]}>
            <ringGeometry args={[0.5, 0.56, 40]} />
            <meshBasicMaterial
              color={theme.bright}
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
              fog={false}
            />
          </mesh>
        </group>
      </group>

      <pointLight position={[2, 1, 4]} color={theme.bright} intensity={12} distance={16} decay={1.6} />
    </group>
  );
}

/**
 * COMMS — Echo Relay: a deep-space dish holding station over a quiet moon.
 * The contact form and links are an overlay card (see hud/CommsPanel).
 * Reached from the map only.
 */
export default function Comms() {
  return (
    <group>
      <group position={[70, -45, -190]}>
        <Spin speed={0.003}>
          <Moon radius={75} sunDirection={[-0.7, 0.35, 0.6]} />
        </Spin>
      </group>
      <Relay />
    </group>
  );
}
