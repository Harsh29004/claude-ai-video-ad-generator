import {useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {PerspectiveCamera} from 'three';
import type {CinematicSpec, Project} from '../project';
import {cameraPose, type Pose} from './camera';
import {clamp, lensToFov, type Vec3} from './math';
import {Particles} from './Particles';
import {PostFX} from './PostFX';
import {Titles} from './Titles';
import type {WorldDef} from './types';
import {abstract} from './worlds/abstract';
import {city} from './worlds/city';
import {space} from './worlds/space';
import {studio} from './worlds/studio';
import {terrain} from './worlds/terrain';

const worldDefs: Record<CinematicSpec['world'], WorldDef> = {studio, space, city, terrain, abstract};

/** Puts the default camera where the shot says, before the frame is drawn (layout effects run before render). */
function CameraRig({pose, fov, near, far}: {pose: Pose; fov: number; near: number; far: number}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    camera.fov = fov;
    camera.near = near;
    camera.far = far;
    camera.position.set(...pose.position);
    camera.layers.enable(1);
    camera.up.set(0, 1, 0);
    camera.lookAt(...pose.target);
    camera.rotateZ(pose.roll);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  });
  return null;
}

/** The box particles live in: it holds the camera's whole path and the subject, and stays fixed for the shot. */
function particleBox(poses: Pose[]): {center: Vec3; box: Vec3} {
  const pts = poses.flatMap((p) => [p.position, p.target]);
  const min = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i])));
  const max = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
  const span = Math.max(...max.map((m, i) => m - min[i]), 1);
  return {
    center: [0, 1, 2].map((i) => (min[i] + max[i]) / 2) as Vec3,
    box: [0, 1, 2].map((i) => Math.max(max[i] - min[i], span * 0.45) * 1.5 + 1) as Vec3,
  };
}

export function CinematicScene({scene, project}: {scene: CinematicSpec; project: Project}) {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const world = worldDefs[scene.world];
  const mood = scene.mood === 'auto' ? world.defaultMood : scene.mood;
  const accent = scene.color ?? project.accent;
  const framing = useMemo(() => world.framing(scene, mood), [world, scene, mood]);
  const baseLens = useMemo(() => world.lens(scene, mood), [world, scene, mood]);
  const lens = {...baseLens, bloom: baseLens.bloom * scene.bloom, dof: scene.focus ? baseLens.dof : 0, exposure: baseLens.exposure * scene.exposure};

  const last = Math.max(1, scene.durationInFrames - 1);
  const progress = clamp(frame / last);
  const pose = cameraPose(scene.camera, framing, progress, frame / fps, scene.seed);
  const fov = lensToFov(scene.camera.lens, width, height);
  const kind = scene.particles === 'auto' ? world.particles(scene, mood) : scene.particles;
  const {center, box} = useMemo(() => particleBox([0, 0.5, 1].map((p) => cameraPose({...scene.camera, shake: 0}, framing, p, 0, scene.seed))), [scene, framing]);
  const pixelsPerUnit = height / (2 * Math.tan((fov * Math.PI) / 360));

  return <AbsoluteFill style={{backgroundColor: '#000'}}>
    <ThreeCanvas width={width} height={height} dpr={1} shadows="percentage"
      gl={{alpha: false, antialias: false, powerPreference: 'high-performance', stencil: false}}
      camera={{fov, near: framing.near, far: framing.far, position: pose.position}}>
      <CameraRig pose={pose} fov={fov} near={framing.near} far={framing.far} />
      {world.render({spec: scene, mood, accent, framing, pose, t: (frame / fps) * scene.speed, progress})}
      <Particles kind={kind} seed={scene.seed} seconds={(frame / fps) * scene.speed} center={center} box={box} pixelsPerUnit={pixelsPerUnit} />
      <PostFX lens={lens} focus={pose.target} />
    </ThreeCanvas>
    <Titles headline={scene.headline} subhead={scene.subhead} position={scene.titlePosition} durationInFrames={scene.durationInFrames} accent={accent} />
  </AbsoluteFill>;
}
