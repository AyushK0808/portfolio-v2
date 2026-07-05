'use client';

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useApp } from '@/state/store';
import { COLORS, SECTORS } from '@/lib/theme';
import { GALLERY_NODES, RING_CENTER } from '@/systems/flightplan';
import { GALLERY } from '@/content/gallery';
import { HoloPanel, HoloText } from '../HoloPanel';
import { Interactable } from '../Interactable';

const theme = SECTORS.D;

/** loads a texture if the file exists, otherwise null (placeholder shown) */
function useOptionalTexture(src: string): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.load(
      src,
      (t) => {
        if (!alive) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        setTex(t);
      },
      undefined,
      () => setTex(null),
    );
    return () => {
      alive = false;
      setTex((prev) => {
        prev?.dispose();
        return null;
      });
    };
  }, [src]);
  return tex;
}

function GalleryFramePanel({
  index,
}: {
  index: number;
}) {
  const frame = GALLERY[index];
  const node = GALLERY_NODES[index];
  const focus = useApp((s) => s.focus);
  const tex = useOptionalTexture(frame.src);

  const isFocus = focus === frame.id;
  const dimmed = focus !== null && !isFocus;
  const accent = index % 2 === 0 ? theme.base : (theme.alt ?? theme.base);

  // face the ring center
  const yaw = Math.atan2(RING_CENTER[0] - node.pos[0], RING_CENTER[2] - node.pos[2]);

  const W = 1.7;
  const H = 1.15;
  const B = 0.035; // border thickness

  return (
    <group position={node.pos} rotation={[0, yaw, 0.04]}>
      <Interactable id={frame.id} hoverScale={1.05}>
        {/* luminous border */}
        {(
          [
            [0, H / 2 + B / 2, W + B * 2, B],
            [0, -H / 2 - B / 2, W + B * 2, B],
            [-W / 2 - B / 2, 0, B, H],
            [W / 2 + B / 2, 0, B, H],
          ] as const
        ).map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0]}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial
              color={accent}
              transparent
              opacity={dimmed ? 0.15 : 0.85}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
        {/* photo or placeholder */}
        {tex ? (
          <mesh>
            <planeGeometry args={[W, H]} />
            <meshBasicMaterial
              map={tex}
              transparent
              opacity={dimmed ? 0.25 : 1}
              side={THREE.DoubleSide}
            />
          </mesh>
        ) : (
          <>
            <mesh>
              <planeGeometry args={[W, H]} />
              <meshBasicMaterial
                color={accent}
                transparent
                opacity={dimmed ? 0.04 : 0.09}
                side={THREE.DoubleSide}
              />
            </mesh>
            <HoloText x={0} y={0.12} size={0.075} color={accent} anchorX="center">
              {'◌ AWAITING TRANSMISSION'}
            </HoloText>
            <HoloText x={0} y={-0.05} size={0.045} color={COLORS.textMuted} anchorX="center">
              {`add /public${frame.src}`}
            </HoloText>
          </>
        )}
      </Interactable>
      {/* caption panel below the focused frame */}
      <group position={[0, -H / 2 - 0.42, 0.15]}>
        <HoloPanel width={1.9} height={0.5} color={accent} visible={isFocus} float={false}>
          <HoloText x={-0.86} y={0.16} size={0.075} color={COLORS.textPrimary} anchorX="left">
            {frame.caption}
          </HoloText>
          <HoloText x={-0.86} y={0.0} size={0.05} color={COLORS.textSecondary} anchorX="left">
            {frame.sub}
          </HoloText>
        </HoloPanel>
      </group>
    </group>
  );
}

/**
 * MISSION D — Observation deck: a ring of luminous frames drifting in the
 * nebula. Focus a frame to dolly in; the others dim to keep attention.
 */
export default function SectorD() {
  return (
    <group>
      {GALLERY.map((g, i) => (
        <GalleryFramePanel key={g.id} index={i} />
      ))}
      {/* soft center beacon */}
      <pointLight position={RING_CENTER} color={theme.base} intensity={1.6} distance={20} decay={1.6} />
      <pointLight
        position={[RING_CENTER[0], RING_CENTER[1] + 4, RING_CENTER[2]]}
        color={theme.alt}
        intensity={1.1}
        distance={18}
        decay={1.6}
      />
    </group>
  );
}
