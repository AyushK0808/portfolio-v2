'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useApp } from '@/state/store';
import { audio } from '@/systems/audio';
import { COLORS, SECTORS } from '@/lib/theme';
import { ARTIFACT_NODES, FLIGHT } from '@/systems/flightplan';
import { PROJECTS, Project } from '@/content/projects';
import { HoloPanel, HoloText } from '../HoloPanel';
import { Interactable } from '../Interactable';
import { HoloMarker, faceYaw } from '../Markers';
import { FONT_HUD } from '../materials';

const theme = SECTORS.C;

/** distinct low-poly artifact per project mesh type (bible §7.6) */
function ArtifactMesh({ type, seed }: { type: Project['mesh']; seed: number }) {
  const group = useRef<THREE.Group>(null);
  const reducedMotion = useApp((s) => s.reducedMotion);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y = t * (0.1 + (seed % 3) * 0.05) + seed;
    group.current.rotation.x = seed * 0.7;
    if (!reducedMotion) group.current.position.y = Math.sin(t * 0.7 + seed) * 0.15;
  });

  const hull = <meshStandardMaterial color="#171226" metalness={0.7} roughness={0.5} />;
  const glow = (
    <meshStandardMaterial color="#000" emissive={theme.base} emissiveIntensity={1.6} toneMapped={false} />
  );

  return (
    <group ref={group}>
      {type === 'satellite' && (
        <>
          <mesh><boxGeometry args={[0.7, 0.7, 0.9]} />{hull}</mesh>
          <mesh position={[1.0, 0, 0]}><boxGeometry args={[1.1, 0.04, 0.6]} />{glow}</mesh>
          <mesh position={[-1.0, 0, 0]}><boxGeometry args={[1.1, 0.04, 0.6]} />{glow}</mesh>
        </>
      )}
      {type === 'derelict' && (
        <>
          <mesh rotation={[0.4, 0, 0.9]}><cylinderGeometry args={[0.45, 0.6, 1.7, 7]} />{hull}</mesh>
          <mesh position={[0.5, 0.6, 0]} rotation={[0.9, 0.4, 0]}><boxGeometry args={[0.5, 0.5, 0.5]} />{hull}</mesh>
          <mesh position={[0, -0.5, 0.3]}><sphereGeometry args={[0.12, 6, 6]} />{glow}</mesh>
        </>
      )}
      {type === 'shard' && (
        <mesh scale={[0.5, 1.5, 0.5]}><octahedronGeometry args={[0.9, 0]} />{glow}</mesh>
      )}
      {type === 'probe' && (
        <>
          <mesh><sphereGeometry args={[0.55, 10, 10]} />{hull}</mesh>
          <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.02, 0.02, 1, 5]} />{hull}</mesh>
          <mesh position={[0, 1.45, 0]}><sphereGeometry args={[0.1, 6, 6]} />{glow}</mesh>
        </>
      )}
      {type === 'ring' && (
        <>
          <mesh rotation={[0.6, 0, 0.3]}><torusGeometry args={[0.85, 0.16, 6, 20]} />{hull}</mesh>
          <mesh><sphereGeometry args={[0.3, 8, 8]} />{glow}</mesh>
        </>
      )}
      {type === 'reactor' && (
        <>
          <mesh><icosahedronGeometry args={[0.75, 0]} />{hull}</mesh>
          <mesh scale={0.45}><icosahedronGeometry args={[0.75, 0]} />{glow}</mesh>
        </>
      )}
      {type === 'relay' && (
        <>
          <mesh rotation={[-0.7, 0, 0]}><coneGeometry args={[0.75, 0.6, 12, 1, true]} />{hull}</mesh>
          <mesh position={[0, -0.6, 0]}><cylinderGeometry args={[0.1, 0.14, 0.8, 6]} />{hull}</mesh>
          <mesh position={[0, 0.05, 0.22]} rotation={[-0.7, 0, 0]}><sphereGeometry args={[0.08, 6, 6]} />{glow}</mesh>
        </>
      )}
      {type === 'capsule' && (
        <>
          <mesh><capsuleGeometry args={[0.42, 0.8, 4, 10]} />{hull}</mesh>
          <mesh position={[0, 0, 0.42]}><sphereGeometry args={[0.09, 6, 6]} />{glow}</mesh>
        </>
      )}
    </group>
  );
}

function LinkChip({
  id,
  label,
  href,
  x,
  y,
  color,
}: {
  id: string;
  label: string;
  href: string;
  x: number;
  y: number;
  color: string;
}) {
  const hovered = useApp((s) => s.hovered === id);
  return (
    <group position={[x, y, 0.02]}>
      <Interactable id={id} onSelect={() => window.open(href, '_blank', 'noopener')}>
        <mesh>
          <planeGeometry args={[0.92, 0.19]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={hovered ? 0.5 : 0.18}
            toneMapped={false}
          />
        </mesh>
        <Text
          font={FONT_HUD}
          fontSize={0.068}
          letterSpacing={0.1}
          color={hovered ? COLORS.textPrimary : color}
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0.01]}
        >
          {label}
        </Text>
      </Interactable>
    </group>
  );
}

/**
 * MISSION C — Debris field of 12 project artifacts. Approach + scan to
 * decrypt each signature into a project card.
 */
export default function SectorC() {
  const focus = useApp((s) => s.focus);
  const scanned = useApp((s) => s.scanned);
  const markScanned = useApp((s) => s.markScanned);
  const quality = useApp((s) => s.quality);

  // scanning sweep state: which artifact, when the sweep started
  const [scan, setScan] = useState<{ id: string; at: number } | null>(null);
  const sweepRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (focus && PROJECTS.some((p) => p.id === focus) && !scanned.includes(focus)) {
      // wait for the dock flight, then sweep
      const t1 = window.setTimeout(() => {
        setScan({ id: focus, at: performance.now() });
        audio.scanSweep();
      }, 800);
      const t2 = window.setTimeout(() => {
        markScanned(focus);
        setScan(null);
      }, 1500);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
  }, [focus, scanned, markScanned]);

  useFrame(() => {
    if (!sweepRef.current || !scan) return;
    const p = THREE.MathUtils.clamp((performance.now() - scan.at) / 600, 0, 1);
    sweepRef.current.position.y = THREE.MathUtils.lerp(-1.6, 1.6, p);
  });

  // micro-debris cloud (cinematic tier only)
  const debris = useMemo(() => {
    const m = new THREE.Matrix4();
    const list: THREE.Matrix4[] = [];
    const rng = (a: number) => {
      // deterministic pseudo-random
      const x = Math.sin(a * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 220; i++) {
      const r = 12 + rng(i) * 26;
      const a = rng(i + 500) * Math.PI * 2;
      const y = (rng(i + 900) - 0.5) * 18;
      const s = 0.03 + rng(i + 1300) * 0.1;
      m.makeScale(s, s, s);
      m.setPosition(Math.cos(a) * r, y, -30 + Math.sin(a) * r);
      list.push(m.clone());
    }
    return list;
  }, []);

  return (
    <group>
      {quality === 'CINEMATIC' && (
        <instancedMesh
          args={[undefined, undefined, debris.length]}
          onUpdate={(mesh) => {
            debris.forEach((m, i) => mesh.setMatrixAt(i, m));
            mesh.instanceMatrix.needsUpdate = true;
          }}
        >
          <tetrahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#241A38" roughness={0.9} />
        </instancedMesh>
      )}

      {PROJECTS.map((proj, i) => {
        const node = ARTIFACT_NODES[i];
        const park = FLIGHT.C.pois[proj.id].pos;
        const facing = faceYaw(node.pos, park);
        const isScanned = scanned.includes(proj.id);
        const isFocus = focus === proj.id;
        const scanning = scan?.id === proj.id;
        return (
          <group key={proj.id} position={node.pos}>
            <Interactable id={proj.id} hoverScale={1.08}>
              <ArtifactMesh type={proj.mesh} seed={i + 1} />
            </Interactable>
            <group rotation={facing}>
              {!isFocus && (
                <group position={[0, 1.5, 0]}>
                  <HoloMarker
                    color={isScanned ? theme.deep : theme.base}
                    label={isScanned ? proj.title : 'UNKNOWN SIGNATURE'}
                    scanned={isScanned}
                  />
                </group>
              )}
              {/* scanning sweep bar */}
              {scanning && (
                <mesh ref={sweepRef} position={[0, -1.6, 0.6]}>
                  <planeGeometry args={[3, 0.05]} />
                  <meshBasicMaterial
                    color={theme.bright}
                    transparent
                    opacity={0.9}
                    toneMapped={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              )}
              {/* project card */}
              <group position={[0, 0.3, 1.9]}>
                <HoloPanel
                  width={3.6}
                  height={2.2}
                  color={theme.base}
                  visible={isFocus && isScanned}
                  title={`ARTIFACT ${String(i + 1).padStart(2, '0')} — DECRYPTED`}
                >
                  <HoloText x={-1.68} y={0.8} size={0.15} color={COLORS.textPrimary} font={FONT_HUD}>
                    {proj.title}
                  </HoloText>
                  <HoloText x={1.68} y={0.82} size={0.055} color={theme.bright} anchorX="right">
                    {proj.tags.join(' · ')}
                  </HoloText>
                  <HoloText x={-1.68} y={0.52} size={0.07} color={COLORS.textSecondary} maxWidth={3.36} lineHeight={1.5}>
                    {proj.oneLiner}
                  </HoloText>
                  <HoloText x={-1.68} y={-0.5} size={0.06} color={theme.base} maxWidth={3.36}>
                    {proj.stack.join(' · ')}
                  </HoloText>
                  {proj.note && (
                    <HoloText x={-1.68} y={-0.72} size={0.052} color={COLORS.textMuted} maxWidth={3.36}>
                      {proj.note}
                    </HoloText>
                  )}
                  {proj.repo && (
                    <LinkChip
                      id={`link-${proj.id}-repo`}
                      label="OPEN REPO ▸"
                      href={proj.repo}
                      x={-1.15}
                      y={-0.94}
                      color={theme.bright}
                    />
                  )}
                  {proj.live && (
                    <LinkChip
                      id={`link-${proj.id}-live`}
                      label="LIVE LINK ▸"
                      href={proj.live}
                      x={-0.1}
                      y={-0.94}
                      color={COLORS.success}
                    />
                  )}
                </HoloPanel>
              </group>
            </group>
          </group>
        );
      })}
    </group>
  );
}
