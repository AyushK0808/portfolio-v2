'use client';

import { ReactNode, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

/**
 * Auto-fitting glTF loader. Loads a .glb, recenters it on the origin and scales
 * its longest axis to `fit` world units, so callers can drop real models into
 * the scene without hand-tuning raw export scales. Suspends while loading — mount
 * inside a <Suspense>. An optional emissive boost lifts dark set-dressing models
 * out of the near-black space palette.
 */
interface ModelProps {
  url: string;
  /** longest-axis target size in world units (model is uniformly scaled to fit) */
  fit?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** extra uniform multiplier on top of the fit scale */
  scale?: number;
  visible?: boolean;
  /** add this much emissive so unlit/dark models read against the void */
  emissiveBoost?: number;
  /** exempt from scene fog — background planets sit past the fog falloff and
   *  would otherwise dissolve into the sector haze */
  noFog?: boolean;
  children?: ReactNode;
}

export function Model({
  url,
  fit,
  position,
  rotation,
  scale = 1,
  visible = true,
  emissiveBoost = 0,
  noFog = false,
  children,
}: ModelProps) {
  const { scene } = useGLTF(url);

  // clone so multiple placements (and our material tweaks) never mutate the
  // shared cached scene
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    if (emissiveBoost > 0 || noFog) {
      c.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mesh.material = mats.map((m) => {
          const mat = (m as THREE.MeshStandardMaterial).clone();
          if (emissiveBoost > 0 && 'emissive' in mat) {
            if (mat.emissiveMap) {
              // authored glow (city lights, lava): scale it, don't replace it
              mat.emissiveIntensity = emissiveBoost;
            } else if (mat.emissive.getHex() === 0) {
              // dead-dark material: fake a glow from its base color
              mat.emissive = new THREE.Color(
                (mat.color as THREE.Color)?.getHex?.() ?? 0xffffff,
              );
              mat.emissiveIntensity = emissiveBoost;
            }
            // materials with authored flat emissive keep their look
          }
          if (noFog) mat.fog = false;
          return mat;
        });
      });
    }
    return c;
  }, [scene, emissiveBoost, noFog]);

  const { fitScale, center } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const c = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(c);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return { fitScale: fit ? fit / maxDim : 1, center: c };
  }, [cloned, fit]);

  return (
    <group position={position} rotation={rotation} visible={visible}>
      <group scale={fitScale * scale}>
        <primitive object={cloned} position={[-center.x, -center.y, -center.z]} />
      </group>
      {children}
    </group>
  );
}
