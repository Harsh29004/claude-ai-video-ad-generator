import {Environment, Lightformer} from '@react-three/drei';
import {useLayoutEffect, useMemo} from 'react';
import {BackSide, Color, IcosahedronGeometry, InstancedMesh, Object3D, ShaderMaterial, TorusGeometry, type BufferGeometry, type Material} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {makeMaterial} from '../materials';
import {rng, type Vec3} from '../math';
import {Subject, subjectRadius} from '../subjects';
import type {Mood, WorldContext, WorldDef} from '../types';

function palette(mood: Mood, accent: string) {
  switch (mood) {
    case 'noon': return {bgTop: '#f2f4f8', bgBottom: '#cfd6e2', glow: accent, colors: [accent, '#ffb36b', '#8f7bff'], light: true};
    case 'golden': return {bgTop: '#1a0d05', bgBottom: '#3a1d0c', glow: '#ff9a4a', colors: ['#ffb05e', accent, '#ff6a6a'], light: false};
    case 'neon': return {bgTop: '#05010c', bgBottom: '#1a0630', glow: '#ff2fb4', colors: ['#ff2fb4', '#22d3ff', '#b84dff'], light: false};
    default: return {bgTop: '#03050c', bgBottom: '#101a33', glow: accent, colors: [accent, '#7b5cff', '#ff6fae'], light: false};
  }
}

const backdrop = (top: string, bottom: string, glow: string) => new ShaderMaterial({
  side: BackSide, depthWrite: false,
  uniforms: {uTop: {value: new Color(top)}, uBottom: {value: new Color(bottom)}, uGlow: {value: new Color(glow)}},
  vertexShader: `varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 uTop, uBottom, uGlow; varying vec3 vD;
    void main() {
      vec3 c = mix(uBottom, uTop, smoothstep(-0.6, 0.8, vD.y));
      c += uGlow * 0.22 * pow(max(0.0, -vD.z), 6.0);
      gl_FragColor = vec4(c, 1.0);
    }`,
});

type Item = {angle: number; radius: number; z: number; size: number; spin: Vec3; phase: number};

/** One instanced family of floating objects on a slowly turning helix. Every transform is a function of t. */
function Field({geometry, material, items, t, colors}: {geometry: BufferGeometry; material: Material; items: Item[]; t: number; colors?: string[]}) {
  const mesh = useMemo(() => {
    const m = new InstancedMesh(geometry, material, items.length);
    m.frustumCulled = false;
    return m;
  }, [geometry, material, items.length]);
  useLayoutEffect(() => {
    if (!colors) return;
    const c = new Color();
    items.forEach((_, i) => mesh.setColorAt(i, c.set(colors[i % colors.length])));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [mesh, items, colors]);
  useLayoutEffect(() => {
    const o = new Object3D();
    items.forEach((it, i) => {
      const a = it.angle + t * 0.22;
      const r = it.radius * (1 + 0.07 * Math.sin(t * 0.8 + it.phase));
      o.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.82 + Math.sin(t * 0.6 + it.phase) * 0.25, it.z);
      o.rotation.set(it.spin[0] * t, it.spin[1] * t, it.spin[2] * t);
      o.scale.setScalar(it.size);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

function AbstractScene({ctx}: {ctx: WorldContext}) {
  const {spec, t, accent} = ctx;
  const p = palette(ctx.mood, accent);
  const families = useMemo(() => {
    const random = rng(spec.seed + 55);
    const make = (count: number, minR: number): Item[] => Array.from({length: count}, (_, i) => ({
      angle: i * 2.39996 + random() * 0.6, radius: minR + random() * 2.6, z: 14 - random() * 62,
      size: 0.22 + Math.pow(random(), 2) * 0.55, spin: [random() - 0.5, random() - 0.5, random() - 0.5].map((v) => v * 1.4) as Vec3, phase: random() * 6.28,
    }));
    return {spheres: make(48, 2.6), cubes: make(40, 3), rings: make(22, 3.4)};
  }, [spec.seed]);
  const parts = useMemo(() => ({
    sphere: new IcosahedronGeometry(1, 6), cube: new RoundedBoxGeometry(1.4, 1.4, 1.4, 4, 0.22), ring: new TorusGeometry(0.8, 0.26, 32, 96),
    chrome: makeMaterial('chrome', accent), ceramic: makeMaterial('ceramic', '#ffffff'), iridescent: makeMaterial('iridescent', accent),
    backdrop: backdrop(p.bgTop, p.bgBottom, p.glow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [accent, ctx.mood]);

  return <>
    <mesh material={parts.backdrop} scale={120}><sphereGeometry args={[1, 48, 24]} /></mesh>
    <fog attach="fog" args={[p.bgBottom, 18, 70]} />
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={p.light ? 3 : 4} color="#ffffff" position={[0, 6, 4]} scale={[10, 3, 1]} />
      <Lightformer form="rect" intensity={3} color={p.colors[0]} position={[-6, 1, 0]} scale={[2, 8, 1]} />
      <Lightformer form="rect" intensity={3} color={p.colors[1]} position={[6, 1, 0]} scale={[2, 8, 1]} />
      <Lightformer form="ring" intensity={2.5} color={p.colors[2]} position={[0, 0, -9]} scale={4} />
      <Lightformer form="rect" intensity={p.light ? 1.5 : 0.4} color={p.bgBottom} position={[0, -6, 0]} scale={[14, 14, 1]} />
    </Environment>
    <ambientLight intensity={p.light ? 0.6 : 0.15} />
    <directionalLight position={[3, 6, 5]} intensity={p.light ? 2 : 1.4} />
    <pointLight position={[0, 0, -6]} intensity={60} color={p.glow} />
    <Field geometry={parts.sphere} material={parts.chrome} items={families.spheres} t={t} />
    <Field geometry={parts.cube} material={parts.ceramic} items={families.cubes} t={t} colors={p.colors} />
    <Field geometry={parts.ring} material={parts.iridescent} items={families.rings} t={t} />
    {spec.subject.kind !== 'none' && <group scale={Math.min(1.4, 1.6 / subjectRadius(spec.subject))}>
      <Subject spec={spec.subject} accent={accent} seconds={t} />
    </group>}
  </>;
}

/** Motion-graphics space: chrome, ceramic and iridescent forms spiralling around the subject, deep bokeh. */
export const abstract: WorldDef = {
  defaultMood: 'night',
  framing: (spec) => ({
    target: [0, 0, 0], radius: spec.subject.kind === 'none' ? 7.5 : 4.2 + subjectRadius(spec.subject) * 1.6, height: 0.5, azimuth: 0, near: 0.05, far: 300,
    travel: (u) => {
      const z = 15 - u * 34;
      return {position: [Math.sin(u * 3) * 0.7, Math.cos(u * 2) * 0.5, z], target: [Math.sin(u * 3 + 0.4) * 0.5, 0, z - 10]};
    },
  }),
  lens: () => ({bloom: 0.75, bloomThreshold: 0.88, dof: 3.2, focusRange: 2.6, tone: 'aces', exposure: 1, chromatic: 0.4, vignette: 0.45}),
  particles: () => 'bokeh',
  render: (ctx) => <AbstractScene ctx={ctx} />,
};
