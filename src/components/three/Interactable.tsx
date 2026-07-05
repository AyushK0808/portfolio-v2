'use client';

import { ReactNode, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import { useApp } from '@/state/store';

/**
 * Wrapper that wires a world object into the reticle/selection system:
 * hover → store.hovered (+ blip), click → store.focus (dock), and the
 * bible §10 hover pop (scale 1.0 → 1.12).
 */
export function Interactable({
  id,
  children,
  position,
  hoverScale = 1.12,
  onSelect,
}: {
  id: string;
  children: ReactNode;
  position?: [number, number, number];
  hoverScale?: number;
  onSelect?: (id: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const hovered = useApp((s) => s.hovered === id);
  const setHovered = useApp((s) => s.setHovered);
  const setFocus = useApp((s) => s.setFocus);
  const gl = useThree((s) => s.gl);

  // swap the deck's idle reticle for the "armed" lock cursor while hovering
  useEffect(() => {
    if (!hovered) return;
    const el = gl.domElement;
    el.style.cursor = 'var(--cursor-armed)';
    return () => {
      el.style.cursor = '';
    };
  }, [hovered, gl]);

  useFrame((_, dt) => {
    if (!group.current) return;
    easing.damp3(group.current.scale, hovered ? hoverScale : 1, 0.1, dt);
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(id);
  };
  const out = () => {
    if (useApp.getState().hovered === id) setHovered(null);
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (onSelect) onSelect(id);
    else setFocus(id);
  };

  return (
    <group
      ref={group}
      position={position}
      onPointerOver={over}
      onPointerOut={out}
      onClick={click}
    >
      {children}
    </group>
  );
}
