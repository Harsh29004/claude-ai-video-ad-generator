import {Environment, MeshReflectorMaterial, Sky} from '@react-three/drei';
import {useMemo} from 'react';
import {
  BufferAttribute, CanvasTexture, Color, DirectionalLight, MeshStandardMaterial, PlaneGeometry, RepeatWrapping,
  SRGBColorSpace, type BufferGeometry,
} from 'three';
import {deg, fbm3, noise3, ridged3, smoothstep, type Vec3} from '../math';
import {Subject, subjectRadius} from '../subjects';
import type {Mood, WorldContext, WorldDef} from '../types';
import {Stars} from './space';

const WATER = -5;

type Land = {height: (x: number, z: number) => number; riverX: (z: number) => number};
const lands = new Map<number, Land>();

/** Alpine ridges, with a river valley carved along the flight path. */
function land(seed: number): Land {
  let l = lands.get(seed);
  if (l) return l;
  const n = noise3(seed + 101), m = noise3(seed + 202);
  const riverX = (z: number) => 22 * Math.sin(z * 0.011) + 9 * Math.sin(z * 0.029 + 1.3);
  const height = (x: number, z: number) => {
    const valley = smoothstep(14, 120, Math.abs(x - riverX(z)));
    const ridges = Math.pow(ridged3(n, x * 0.004, 0.3, z * 0.004, 7), 1.1);
    const hills = fbm3(m, x * 0.017, 0.5, z * 0.017, 4);
    return (ridges * 120 + hills * 18 + fbm3(m, x * 0.06, 1.7, z * 0.06, 3) * 2.5) * valley + (valley - 1) * 6 + hills * 2.5 - 2;
  };
  lands.set(seed, l = {height, riverX});
  return l;
}

type Sun = {elev: number; az: number; color: string; intensity: number; fog: string; turbidity: number; rayleigh: number; exposure: number};

function sun(mood: Mood): Sun {
  switch (mood) {
    case 'noon': return {elev: 58, az: 150, color: '#fff8ee', intensity: 3.4, fog: '#9fb8d0', turbidity: 3, rayleigh: 1, exposure: 0.52};
    case 'dawn': return {elev: 3, az: -40, color: '#ffbea6', intensity: 2.6, fog: '#cfa3a6', turbidity: 5, rayleigh: 3, exposure: 0.7};
    case 'dusk': case 'neon': return {elev: 1.6, az: 35, color: '#ff9466', intensity: 2.6, fog: '#a86455', turbidity: 9, rayleigh: 3.6, exposure: 0.75};
    case 'night': return {elev: -9, az: 30, color: '#9fb5ff', intensity: 0.55, fog: '#0b1120', turbidity: 2, rayleigh: 0.6, exposure: 0.95};
    default: return {elev: 7, az: 62, color: '#ffcf9a', intensity: 3.8, fog: '#b98a6a', turbidity: 6, rayleigh: 2.2, exposure: 0.5};
  }
}

function sunDirection(s: Sun): Vec3 {
  const e = deg(s.elev), a = deg(s.az);
  // az 0 = straight ahead of the camera's default view (toward -z).
  return [-Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
}

function terrainGeometry(l: Land, seed: number, size: number, segments: number, cz: number, far: boolean): BufferGeometry {
  const g = new PlaneGeometry(size, size, segments, segments);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, cz);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let y = l.height(x, z);
    if (far) {
      const d = Math.hypot(x, z - cz);
      y *= 1 + 1.6 * smoothstep(450, 2400, d);
      // Sink the far mesh under the detailed near mesh so the two never fight.
      if (Math.abs(x) < 470 && Math.abs(z - cz) < 470) y -= 260;
      y -= 1.5;
    }
    pos.setY(i, y);
  }
  g.computeVertexNormals();
  const nrm = g.attributes.normal, colors = new Float32Array(pos.count * 3), k = noise3(seed + 303);
  const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), steep = 1 - nrm.getY(i);
    const v = k(x * 0.03, y * 0.03, z * 0.03);
    let c: Vec3 = mix([0.13, 0.22, 0.06], [0.04, 0.09, 0.03], smoothstep(-0.3, 0.4, v) * smoothstep(-2, 30, y));
    c = mix(c, [0.42, 0.38, 0.28], smoothstep(WATER + 2.2, WATER + 0.4, y));
    c = mix(c, [0.2, 0.18, 0.16], Math.max(smoothstep(0.3, 0.55, steep), smoothstep(60, 90, y)));
    c = mix(c, [0.86, 0.89, 0.93], smoothstep(88 + v * 18, 100 + v * 18, y) * smoothstep(0.6, 0.38, steep));
    colors.set(c, i * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

function cloudTexture(seed: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const img = g.createImageData(512, 512), n = noise3(seed + 404);
  for (let j = 0; j < 512; j++) {
    for (let i = 0; i < 512; i++) {
      // Sample a torus so the texture tiles seamlessly.
      const a = (i / 512) * Math.PI * 2, b = (j / 512) * Math.PI * 2;
      const v = fbm3(n, Math.cos(a) * 1.6, Math.sin(a) * 1.6 + Math.cos(b) * 1.6, Math.sin(b) * 1.6, 6);
      const o = (j * 512 + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
      img.data[o + 3] = smoothstep(0.05, 0.5, v) * 220;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(5, 5);
  return t;
}

function TerrainScene({ctx}: {ctx: WorldContext}) {
  const {spec, t, framing} = ctx;
  const s = sun(ctx.mood);
  const dir = sunDirection(s);
  const l = land(spec.seed);
  const geo = useMemo(() => ({
    near: terrainGeometry(l, spec.seed, 1000, 440, -120, false),
    far: terrainGeometry(l, spec.seed, 7000, 180, -120, true),
  }), [l, spec.seed]);
  const material = useMemo(() => new MeshStandardMaterial({vertexColors: true, roughness: 0.94, metalness: 0, envMapIntensity: 0.32}), []);
  const clouds = useMemo(() => cloudTexture(spec.seed), [spec.seed]);
  clouds.offset.set(t * 0.004, t * 0.0016);

  const light = useMemo(() => {
    const d = new DirectionalLight();
    d.castShadow = true;
    d.shadow.mapSize.set(2048, 2048);
    Object.assign(d.shadow.camera, {left: -320, right: 320, top: 320, bottom: -320, near: 1, far: 1600});
    d.shadow.bias = -0.0004;
    d.shadow.normalBias = 0.6;
    return d;
  }, []);
  const center = framing.target;
  light.position.set(center[0] + dir[0] * 700, Math.max(40, dir[1] * 700), center[2] + dir[2] * 700);
  light.target.position.set(center[0], 0, center[2]);
  light.color.set(s.color);
  light.intensity = s.intensity;

  const skyProps = {distance: 4500, sunPosition: dir, turbidity: s.turbidity, rayleigh: s.rayleigh, mieCoefficient: 0.005, mieDirectionalG: 0.86};
  const r = subjectRadius(spec.subject);
  const hero: Vec3 = [l.riverX(-60), WATER + 16 + r * 4, -60];

  return <>
    <fogExp2 attach="fog" args={[s.fog, ctx.mood === 'noon' ? 0.00045 : 0.0006]} />
    <Sky {...skyProps} />
    <Environment resolution={256} frames={1}><Sky {...skyProps} /></Environment>
    {ctx.mood === 'night' && <Stars seed={spec.seed} />}
    <hemisphereLight args={[s.fog, '#2a2418', ctx.mood === 'night' ? 0.12 : 0.22]} />
    <primitive object={light} />
    <primitive object={light.target} />
    <mesh geometry={geo.near} material={material} receiveShadow castShadow />
    <mesh geometry={geo.far} material={material} receiveShadow />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER, -120]}>
      <planeGeometry args={[7000, 7000]} />
      <MeshReflectorMaterial blur={[80, 30]} resolution={512} mixBlur={0.6} mixStrength={1.6} roughness={0.35} mirror={0.85}
        depthScale={0.2} minDepthThreshold={0.8} maxDepthThreshold={1.2} color="#0d2a33" metalness={0.3} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 330, -120]}>
      <planeGeometry args={[9000, 9000]} />
      <meshBasicMaterial map={clouds} transparent depthWrite={false} opacity={ctx.mood === 'noon' ? 0.85 : 0.7}
        color={new Color(s.color).lerp(new Color('#ffffff'), 0.45).multiplyScalar(ctx.mood === 'night' ? 0.15 : 1.1)} />
    </mesh>
    {spec.subject.kind !== 'none' && <group position={hero} scale={5}>
      <Subject spec={spec.subject} accent={ctx.accent} seconds={t} />
    </group>}
  </>;
}

/** Mountains, a river valley and a real sky: drone flights at golden hour, dawn, noon, dusk or night. */
export const terrain: WorldDef = {
  defaultMood: 'golden',
  framing: (spec) => {
    const l = land(spec.seed);
    const hero = spec.subject.kind !== 'none';
    const r = subjectRadius(spec.subject);
    const target: Vec3 = hero ? [l.riverX(-60), WATER + 16 + r * 4, -60] : [l.riverX(-140), 30, -140];
    return {
      target, radius: hero ? 5 * (3 + r * 3.2) : 190, height: hero ? 6 : 70, azimuth: 0, near: 0.5, far: 5200,
      travel: (u) => {
        const z = 220 - u * 430, ahead = z - 90;
        const y = WATER + 30 + 8 * Math.sin(u * Math.PI);
        return {position: [l.riverX(z), y, z], target: [l.riverX(ahead), y - 14, ahead]};
      },
      floor: (x, z) => l.height(x, z) + 6,
    };
  },
  lens: (_, mood) => ({bloom: 0.5, bloomThreshold: 1, dof: 0, focusRange: 100, tone: 'aces', exposure: sun(mood).exposure, chromatic: 0.3, vignette: 0.4}),
  particles: () => 'none',
  render: (ctx) => <TerrainScene ctx={ctx} />,
};

