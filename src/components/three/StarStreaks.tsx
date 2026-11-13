'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { camTelemetry } from './CameraDirector';

/**
 * Stars pulled into lines: the first and last beat of every hyperspace jump,
 * and the loader. A tube of thin streaks around the camera's forward axis that
 * race toward and past the pilot; their length and speed follow
 * `camTelemetry.streak` (0 = invisible points, 1 = full lines). Parented to the
 * camera and depth-tested, so the cockpit frame stays in front of them.
 */

const COUNT = 360;

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NEAR_Z = 10;
const FAR_Z = -130;

export function StarStreaks() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lanes = useMemo(() => {
    const rng = seeded(4242);
    return Array.from({ length: COUNT }, () => {
      const a = rng() * Math.PI * 2;
      // keep clear of the cockpit: nothing closer than 2.2 units to the axis
      const r = 3 + Math.pow(rng(), 1.5) * 22;
      return {
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        z: FAR_Z + rng() * (NEAR_Z - FAR_Z),
        speed: 70 + rng() * 120,
        len: 5 + rng() * 16,
        thick: 0.6 + rng() * 0.9,
      };
    });
  }, []);

  useFrame((_, rawDt) => {
    const m = mesh.current;
    if (!m) return;
    const st = camTelemetry.streak;
    m.visible = st > 0.01;
    if (!m.visible) return;
    const dt = Math.min(rawDt, 0.05);
    if (mat.current) mat.current.opacity = Math.min(1, st * 1.7) * 0.85;
    for (let i = 0; i < COUNT; i++) {
      const l = lanes[i];
      l.z += l.speed * (0.15 + st) * dt;
      if (l.z > NEAR_Z) l.z -= NEAR_Z - FAR_Z;
      const len = 0.05 + st * st * l.len;
      dummy.position.set(l.x, l.y, l.z - len / 2);
      dummy.scale.set(l.thick, l.thick, len);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false} visible={false} renderOrder={-4}>
      <boxGeometry args={[0.02, 0.02, 1]} />
      <meshBasicMaterial
        ref={mat}
        color="#CFE6FF"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </instancedMesh>
  );
}
