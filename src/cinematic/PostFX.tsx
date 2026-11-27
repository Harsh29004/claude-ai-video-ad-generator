import {useFrame, useThree} from '@react-three/fiber';
import {
  BloomEffect, ChromaticAberrationEffect, DepthOfFieldEffect, EffectComposer, EffectPass, FXAAEffect, RenderPass,
  ToneMappingEffect, ToneMappingMode, VignetteEffect,
} from 'postprocessing';
import {useEffect, useLayoutEffect, useMemo} from 'react';
import {HalfFloatType, NoToneMapping, Vector2, Vector3} from 'three';
import type {Vec3} from './math';

export type Lens = {
  /** Bloom strength. 0 disables it. */
  bloom: number;
  /** Scene luminance above which highlights bloom. Lower = dreamier. */
  bloomThreshold: number;
  /** Depth-of-field bokeh size. 0 disables it. */
  dof: number;
  /** How deep (world units) the sharp zone around the focus point is. */
  focusRange: number;
  tone: 'aces' | 'agx' | 'neutral';
  exposure: number;
  chromatic: number;
  vignette: number;
};

const toneModes = {aces: ToneMappingMode.ACES_FILMIC, agx: ToneMappingMode.AGX, neutral: ToneMappingMode.NEUTRAL} as const;

/**
 * The film pipeline: depth of field → bloom → chromatic aberration → tone mapping → vignette → FXAA.
 *
 * Built synchronously with useMemo rather than @react-three/postprocessing's <EffectComposer>, which creates its
 * passes in an effect. That arrives one frame late, so the first frame of every shot rendered without the grade
 * and flickered at each cut. The composer renders from a priority-1 frame callback, which Remotion's
 * <ThreeCanvas> runs once per video frame through advance(). Nothing here animates by itself.
 */
export function PostFX({lens, focus}: {lens: Lens; focus: Vec3}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const pipe = useMemo(() => {
    // HDR buffers so bloom sees real highlight values. No MSAA: multisampled half-float targets fail silently
    // (a black frame) on some ANGLE/D3D11 drivers, so edges are smoothed by FXAA in the last pass instead.
    const composer = new EffectComposer(gl, {frameBufferType: HalfFloatType, multisampling: 0});
    composer.addPass(new RenderPass(scene, camera));
    let dof: DepthOfFieldEffect | null = null;
    if (lens.dof > 0) {
      dof = new DepthOfFieldEffect(camera, {focusDistance: 5, focusRange: lens.focusRange, bokehScale: lens.dof, resolutionScale: 0.5});
      composer.addPass(new EffectPass(camera, dof));
    }
    const effects = [];
    if (lens.bloom > 0) {
      effects.push(new BloomEffect({mipmapBlur: true, intensity: lens.bloom, luminanceThreshold: lens.bloomThreshold, luminanceSmoothing: 0.3, radius: 0.72}));
    }
    if (lens.chromatic > 0) {
      effects.push(new ChromaticAberrationEffect({offset: new Vector2(lens.chromatic * 0.0012, lens.chromatic * 0.0009), radialModulation: true, modulationOffset: 0.25}));
    }
    effects.push(new ToneMappingEffect({mode: toneModes[lens.tone]}));
    if (lens.vignette > 0) effects.push(new VignetteEffect({offset: 0.28, darkness: lens.vignette}));
    composer.addPass(new EffectPass(camera, ...effects));
    composer.addPass(new EffectPass(camera, new FXAAEffect()));
    return {composer, dof};
  }, [gl, scene, camera, lens.dof, lens.focusRange, lens.bloom, lens.bloomThreshold, lens.chromatic, lens.tone, lens.vignette]);

  useLayoutEffect(() => {
    pipe.composer.setSize(size.width, size.height);
  }, [pipe, size.width, size.height]);

  useLayoutEffect(() => {
    const previous = [gl.toneMapping, gl.toneMappingExposure] as const;
    gl.toneMapping = NoToneMapping;
    gl.toneMappingExposure = lens.exposure;
    return () => {
      [gl.toneMapping, gl.toneMappingExposure] = previous;
    };
  }, [gl, lens.exposure]);

  // Keep the focus point on the subject as the camera moves.
  useLayoutEffect(() => {
    if (!pipe.dof) return;
    if (!pipe.dof.target) pipe.dof.target = new Vector3();
    pipe.dof.target.set(...focus);
  });

  useEffect(() => () => pipe.composer.dispose(), [pipe]);

  useFrame(() => {
    pipe.composer.render();
  }, 1);

  return null;
}
