import {ContactShadows, Environment, Lightformer, MeshReflectorMaterial} from '@react-three/drei';
import {useMemo} from 'react';
import {AdditiveBlending, CanvasTexture, Color, CylinderGeometry, DoubleSide, SRGBColorSpace, ShaderMaterial} from 'three';
import {Subject, subjectRadius} from '../subjects';
import type {Mood, WorldContext, WorldDef} from '../types';

type Palette = {bg: string; key: string; rimA: string; rimB: string; floor: string; light: boolean};

function palette(mood: Mood, accent: string): Palette {
  switch (mood) {
    case 'noon': return {bg: '#e4e8ee', key: '#ffffff', rimA: '#ffffff', rimB: accent, floor: '#d9dee6', light: true};
    case 'neon': return {bg: '#06030c', key: '#fbe8ff', rimA: '#ff2fb4', rimB: '#22d3ff', floor: '#0a0710', light: false};
    case 'golden': return {bg: '#0f0905', key: '#ffc98a', rimA: '#ff8a3d', rimB: accent, floor: '#110b07', light: false};
    case 'dusk': return {bg: '#0b0812', key: '#ffd6b0', rimA: '#ff6f91', rimB: '#6c7bff', floor: '#0d0a14', light: false};
    case 'dawn': return {bg: '#0c0e14', key: '#ffe2cf', rimA: '#ff9e7a', rimB: '#8ad4ff', floor: '#0e1016', light: false};
    default: return {bg: '#0a0d14', key: '#fff3e6', rimA: accent, rimB: '#7d82ff', floor: '#10131b', light: false};
  }
}

const shaftShader = {
  vertexShader: /* glsl */ `
    varying float vY;
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      vY = uv.y;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uStrength;
    varying float vY;
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      float facing = pow(abs(dot(normalize(vN), normalize(vV))), 1.8);
      float a = pow(vY, 1.7) * facing * uStrength;
      gl_FragColor = vec4(uColor, a);
    }`,
};

/** A soft volumetric-looking shaft of light (a fresnel-faded open cone). */
function LightShaft({color, strength, position, tilt}: {color: string; strength: number; position: [number, number, number]; tilt: number}) {
  const geometry = useMemo(() => new CylinderGeometry(0.18, 2.4, 8, 64, 1, true), []);
  const material = useMemo(() => new ShaderMaterial({
    ...shaftShader, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
    uniforms: {uColor: {value: new Color(color)}, uStrength: {value: strength}},
  }), [color, strength]);
  // Layer 1 only: the main camera sees it, but ContactShadows' camera (layer 0) does not cast a ring from it.
  return <mesh geometry={geometry} material={material} position={position} rotation={[0, 0, tilt]} layers={1} />;
}

/** A softly lit gradient wall far behind the subject, so it separates from the background instead of sinking into black. */
function Backdrop({color, strength}: {color: string; strength: number}) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 150, 0, 128, 150, 128);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  return <mesh position={[0, 4, -14]} layers={1}>
    <planeGeometry args={[34, 16]} />
    <meshBasicMaterial map={texture} color={new Color(color).multiplyScalar(strength)} transparent depthWrite={false} blending={AdditiveBlending} />
  </mesh>;
}

function StudioScene({ctx}: {ctx: WorldContext}) {
  const p = palette(ctx.mood, ctx.accent);
  const y = ctx.framing.target[1];
  return <>
    <color attach="background" args={[p.bg]} />
    <fog attach="fog" args={[p.bg, 13, 36]} />
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={p.light ? 3 : 5.5} color={p.key} position={[0, 6, 1.5]} scale={[10, 4.5, 1]} />
      <Lightformer form="rect" intensity={3.6} color={p.rimA} position={[-5, 2, -1]} scale={[7, 1.4, 1]} />
      <Lightformer form="rect" intensity={3.6} color={p.rimB} position={[5, 2, -1]} scale={[7, 1.4, 1]} />
      <Lightformer form="rect" intensity={2.4} color={p.key} position={[-3.5, 1.2, 4]} scale={[0.8, 5, 1]} />
      <Lightformer form="rect" intensity={2.4} color={p.key} position={[3.5, 1.2, 4]} scale={[0.8, 5, 1]} />
      <Lightformer form="ring" intensity={2.2} color={p.rimA} position={[0, 2.5, -7]} scale={3} />
      <Lightformer form="rect" intensity={p.light ? 1.8 : 1.5} color="#ffffff" position={[0, 1, 7]} scale={[10, 3, 1]} />
      <Lightformer form="rect" intensity={p.light ? 0.8 : 0.35} color={p.key} position={[0, -3, 0]} scale={[12, 12, 1]} />
    </Environment>
    <hemisphereLight args={[p.key, p.bg, p.light ? 0.6 : 0.4]} />
    <Backdrop color={new Color(p.key).lerp(new Color(p.rimB), 0.3).getStyle()} strength={p.light ? 0.12 : 0.2} />
    <spotLight position={[-3.5, 4, 5]} angle={0.6} penumbra={1} intensity={p.light ? 30 : 60} color={p.key} />
    <spotLight position={[3, 7.5, 4]} angle={0.5} penumbra={1} intensity={p.light ? 130 : 240} color={p.key}
      castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
    <pointLight position={[-3.6, 2.6, -3]} intensity={32} color={p.rimA} />
    <pointLight position={[3.6, 1.8, -3.2]} intensity={26} color={p.rimB} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <MeshReflectorMaterial blur={[420, 120]} resolution={512} mixBlur={1} mixStrength={p.light ? 6 : 30} roughness={1}
        depthScale={1.1} minDepthThreshold={0.4} maxDepthThreshold={1.35} color={p.floor} metalness={p.light ? 0.1 : 0.55} mirror={0.5} />
    </mesh>
    <ContactShadows position={[0, 0.003, 0]} opacity={p.light ? 0.5 : 0.75} scale={14} blur={2.6} far={5} resolution={512} />
    {!p.light && <>
      <LightShaft color={p.key} strength={0.07} position={[-1.6, 4.2, -1.8]} tilt={-0.32} />
      <LightShaft color={p.rimA} strength={0.05} position={[2.2, 4.2, -2.4]} tilt={0.38} />
    </>}
    <group position={[0, y, 0]}>
      <Subject spec={ctx.spec.subject} accent={ctx.accent} seconds={ctx.t} />
    </group>
  </>;
}

/** A photo studio: infinite glossy floor, softbox reflections, rim lights, light shafts and floating dust. */
export const studio: WorldDef = {
  defaultMood: 'night',
  framing: (spec) => {
    const r = subjectRadius(spec.subject);
    const tight = spec.subject.kind === 'device' ? 0.78 : 1;
    return {target: [0, 0.35 + r, 0], radius: (3 + r * 3.2) * tight, height: 0.25 + r * 0.3, azimuth: 0, near: 0.05, far: 200, floor: () => 0.05};
  },
  lens: (spec, mood) => ({
    bloom: 0.55, bloomThreshold: 0.9, dof: 2.2, focusRange: 1.4 + subjectRadius(spec.subject),
    tone: spec.subject.kind === 'device' || mood === 'noon' ? 'neutral' : 'aces', exposure: mood === 'noon' ? 1 : 1.25, chromatic: 0.35, vignette: 0.38,
  }),
  particles: (_, mood) => mood === 'noon' ? 'none' : 'dust',
  render: (ctx) => <StudioScene ctx={ctx} />,
};
