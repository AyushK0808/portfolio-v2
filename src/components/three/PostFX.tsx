'use client';

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Bloom,
  EffectComposer,
  Noise,
  Scanline,
  SMAA,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction, ChromaticAberrationEffect } from 'postprocessing';
import { useApp } from '@/state/store';
import { camTelemetry } from './CameraDirector';

/**
 * Chromatic aberration built imperatively: the wrapped component from
 * @react-three/postprocessing JSON.stringifies its props as a memo key,
 * and under React 19 `ref` lands in props → circular-structure crash.
 * A <primitive> sidesteps that and gives us the instance for the warp ramp.
 */
function WarpAberration() {
  const effect = useMemo(() => new ChromaticAberrationEffect(), []);

  useFrame(() => {
    const env = camTelemetry.warpEnv;
    effect.offset.x = 0.001 + 0.003 * env;
    effect.offset.y = 0.0012 + 0.0038 * env;
  });

  return <primitive object={effect} />;
}

/**
 * Post stack in bible §5 order. Performance tier keeps only Bloom-lite,
 * Vignette and SMAA. Chromatic aberration ramps 4× during warp.
 */
export function PostFX() {
  const quality = useApp((s) => s.quality);

  if (quality === 'PERFORMANCE') {
    return (
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.8} luminanceThreshold={0.85} luminanceSmoothing={0.9} mipmapBlur />
        <Vignette darkness={0.55} offset={0.3} />
        <SMAA />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={1.4}
        luminanceThreshold={0.82}
        luminanceSmoothing={0.9}
        radius={0.45}
        mipmapBlur
      />
      <WarpAberration />
      <Vignette darkness={0.55} offset={0.3} />
      <Noise premultiply opacity={0.035} blendFunction={BlendFunction.SCREEN} />
      <Scanline density={1.15} opacity={0.08} />
      <SMAA />
    </EffectComposer>
  );
}
