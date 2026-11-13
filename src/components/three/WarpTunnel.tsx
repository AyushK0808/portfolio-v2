'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useApp } from '@/state/store';
import { LOCATIONS } from '@/lib/theme';
import { WarpMaterial } from './materials';
import { camTelemetry } from './CameraDirector';

/** the tunnel is blue-white; the destination only tints it */
const TUNNEL_BLUE = new THREE.Color('#4E9BFF');

/**
 * The hyperspace swirl: the middle beat of every jump, and the loader. A
 * cylinder wrapped around the camera whose opacity follows
 * `camTelemetry.tunnel`. Depth-tested and drawn before the other transparent
 * layers, so the cockpit (and its glass) stay in front of it.
 */
export function WarpTunnel() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<InstanceType<typeof WarpMaterial>>(null);
  const core = useRef<THREE.Sprite>(null);
  const tint = useMemo(() => new THREE.Color(), []);
  const dest = useMemo(() => new THREE.Color(), []);
  const glow = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.18, 'rgba(225,240,255,0.6)');
      g.addColorStop(0.5, 'rgba(150,200,255,0.12)');
      g.addColorStop(1, 'rgba(150,200,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useFrame((state) => {
    const m = mat.current;
    const tunnel = camTelemetry.tunnel;
    if (mesh.current) mesh.current.visible = tunnel > 0.004;
    if (core.current) {
      core.current.visible = tunnel > 0.004;
      (core.current.material as THREE.SpriteMaterial).opacity = tunnel;
      core.current.scale.setScalar(34 + Math.sin(state.clock.elapsedTime * 9) * 1.5);
    }
    if (!m || tunnel <= 0.004) return;
    m.uTime = state.clock.elapsedTime;
    m.uProgress = tunnel;
    // 0.5 = the pure swirl; the star-line beats are drawn by <StarStreaks>
    m.uRaw = 0.5;
    const jump = useApp.getState().jump;
    tint.copy(TUNNEL_BLUE);
    if (jump) tint.lerp(dest.set(LOCATIONS[jump.to].base), 0.3);
    (m.uColorFrom as THREE.Color).copy(TUNNEL_BLUE);
    (m.uColorTo as THREE.Color).copy(tint);
  });

  return (
    <>
      {/* the bright point the tunnel converges on, capping its far end */}
      <sprite ref={core} position={[0, 0, -120]} visible={false} renderOrder={-6}>
        <spriteMaterial
          map={glow}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </sprite>
      <mesh ref={mesh} rotation={[Math.PI / 2, 0, 0]} renderOrder={-5} visible={false} frustumCulled={false}>
      <cylinderGeometry args={[5, 5, 260, 48, 1, true]} />
      <warpMaterial
        ref={mat}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
      </mesh>
    </>
  );
}
