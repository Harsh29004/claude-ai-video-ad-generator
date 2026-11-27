import {useThree} from '@react-three/fiber';
import {useMemo} from 'react';
import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, EquirectangularReflectionMapping,
  FrontSide, LineDashedMaterial, LineLoop, MeshStandardMaterial, RingGeometry, SRGBColorSpace, ShaderMaterial, SphereGeometry,
  Vector3, type Camera, type Material,
} from 'three';
import type {CinematicSpec} from '../../project';
import {deg, easings, lerp, rng, type Vec3} from '../math';
import {planetMaps, starrySky, type PlanetKind} from '../planetTextures';
import {Subject, subjectRadius} from '../subjects';
import type {WorldContext, WorldDef} from '../types';

type PlanetSpec = Extract<CinematicSpec['subject'], {kind: 'planet'}>;

const atmosphereColor: Partial<Record<PlanetKind, string>> = {earth: '#5aa8ff', mars: '#e89a62', ice: '#a9e3ff', 'gas-giant': '#ffd7a0', lava: '#ff5a1f'};
const tilt: Record<PlanetKind, number> = {earth: 23.4, moon: 6.7, mars: 25, 'gas-giant': 3, ice: 12, lava: 8};

const atmosphereShader = {
  vertexShader: /* glsl */ `
    varying vec3 vN;
    varying vec3 vP;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vP = w.xyz;
      vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uSun;
    uniform float uPower;
    uniform float uStrength;
    uniform float uInner;
    varying vec3 vN;
    varying vec3 vP;
    void main() {
      vec3 v = normalize(cameraPosition - vP);
      vec3 n = normalize(vN);
      float day = smoothstep(-0.18, 0.5, dot(n, uSun));
      // Inner shell: fresnel haze over the disc. Outer (back-face) shell: brightest hugging the limb, fading outward.
      float rim = uInner > 0.5 ? pow(1.0 - max(dot(n, v), 0.0), uPower) : pow(smoothstep(0.0, 0.36, -dot(n, v)), uPower);
      gl_FragColor = vec4(uColor * rim * day * uStrength, 1.0);
    }`,
};

function atmosphere(color: string, sun: Vector3, inner: boolean): ShaderMaterial {
  return new ShaderMaterial({
    ...atmosphereShader, transparent: true, depthWrite: false, blending: AdditiveBlending, side: inner ? FrontSide : BackSide,
    uniforms: {uColor: {value: new Color(color)}, uSun: {value: sun}, uPower: {value: inner ? 3.4 : 2.2}, uStrength: {value: inner ? 1.25 : 1.6}, uInner: {value: inner ? 1 : 0}},
  });
}

/** Surface material; city lights (or lava glow) only show on the night side. */
function surface(kind: PlanetKind, seed: number, detail: 'hero' | 'small', sun: Vector3): Material {
  const maps = planetMaps(kind, seed, detail);
  // Bump strength is per screen pixel, so a small, distant body needs much less of it.
  const bump = (kind === 'moon' ? 3.2 : kind === 'earth' ? 1.4 : 2) * (detail === 'small' ? 0.3 : 1);
  const m = new MeshStandardMaterial({
    map: maps.color, bumpMap: maps.surface, bumpScale: bump,
    roughnessMap: maps.surface, roughness: 1, metalness: 0,
    emissiveMap: maps.lights ?? null, emissive: maps.lights ? '#ffffff' : '#000000', emissiveIntensity: kind === 'lava' ? 2.6 : 2.6,
  });
  if (maps.lights) {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uSunView = {value: new Vector3()};
      m.userData.shader = shader;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSunView;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance *= ${kind === 'lava' ? '1.0' : 'smoothstep(0.12, -0.28, dot(normal, uSunView))'};`);
    };
    m.userData.sun = sun;
  }
  return m;
}

/** Called by three right before the planet is drawn, with whichever camera is drawing it. */
function sunInView(material: Material, camera: Camera) {
  const shader = material.userData.shader as {uniforms: {uSunView: {value: Vector3}}} | undefined;
  const sun = material.userData.sun as Vector3 | undefined;
  if (shader && sun) shader.uniforms.uSunView.value.copy(sun).transformDirection(camera.matrixWorldInverse);
}

function Planet({spec, seed, sun, t, progress, radius = 1, detail = 'hero'}: {
  spec: PlanetSpec; seed: number; sun: Vector3; t: number; progress: number; radius?: number; detail?: 'hero' | 'small';
}) {
  const kind = spec.planet;
  const parts = useMemo(() => {
    const maps = planetMaps(kind, seed, detail);
    const air = atmosphereColor[kind];
    return {
      sphere: new SphereGeometry(1, 192, 96),
      surface: surface(kind, seed, detail, sun),
      clouds: maps.clouds ? new MeshStandardMaterial({map: maps.clouds, alphaMap: maps.clouds, transparent: true, depthWrite: false, roughness: 1, color: '#ffffff'}) : null,
      inner: air ? atmosphere(air, sun, true) : null,
      outer: air ? atmosphere(air, sun, false) : null,
    };
  }, [kind, seed, detail, sun]);

  const ringMaterial = useMemo(() => {
    if (!spec.rings) return null;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 4;
    const g = c.getContext('2d')!;
    const random = rng(seed + 61);
    for (let x = 0; x < 1024; x++) {
      const v = 0.35 + 0.65 * random();
      const gap = x > 610 && x < 650 ? 0.1 : 1;
      const edge = Math.min(1, x / 60, (1024 - x) / 90);
      g.fillStyle = `rgba(${Math.round(225 * v)}, ${Math.round(205 * v)}, ${Math.round(175 * v)}, ${(0.85 * v * gap * edge).toFixed(3)})`;
      g.fillRect(x, 0, 1, 4);
    }
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return new MeshStandardMaterial({map: tex, transparent: true, side: DoubleSide, roughness: 0.9, depthWrite: false});
  }, [spec.rings, seed]);

  const ringGeometry = useMemo(() => {
    const g = new RingGeometry(1.45, 2.45, 256, 1);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - 1.45) / 1.0, 0.5);
    return g;
  }, []);

  const spin = t * 0.06 * spec.spin;
  return <group scale={radius} rotation={[0, 0, deg(tilt[kind])]}>
    <mesh geometry={parts.sphere} material={parts.surface} rotation={[0, spin, 0]}
      onBeforeRender={(_r, _s, camera, _g, material) => sunInView(material, camera)} />
    {parts.clouds && <mesh geometry={parts.sphere} material={parts.clouds} scale={1.012} rotation={[0, spin * 1.35 + 0.4, 0]} />}
    {parts.inner && <mesh geometry={parts.sphere} material={parts.inner} scale={1.004} />}
    {parts.outer && <mesh geometry={parts.sphere} material={parts.outer} scale={1.07} />}
    {ringMaterial && <mesh geometry={ringGeometry} material={ringMaterial} rotation={[-Math.PI / 2 + 0.08, 0, 0]} />}
  </group>;
}

function OrbitPath({radius}: {radius: number}) {
  const line = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      pts.push(Math.cos(a) * radius, 0, -Math.sin(a) * radius);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    const l = new LineLoop(g, new LineDashedMaterial({color: '#9dbbe0', dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.45}));
    l.computeLineDistances();
    return l;
  }, [radius]);
  return <primitive object={line} />;
}

export function Stars({seed}: {seed: number}) {
  const {geometry, material} = useMemo(() => {
    const random = rng(seed + 77), count = 1700;
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = random() * 2 - 1, a = random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos.set([s * Math.cos(a) * 1500, u * 1500, s * Math.sin(a) * 1500], i * 3);
      const temp = random();
      const c = temp < 0.15 ? [1, 0.78, 0.6] : temp > 0.8 ? [0.7, 0.82, 1] : [1, 0.97, 0.92];
      const b = 0.3 + Math.pow(random(), 7) * 4;
      col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
      size[i] = 1 + Math.pow(random(), 5) * 2.2;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aColor', new BufferAttribute(col, 3));
    g.setAttribute('aSize', new BufferAttribute(size, 1));
    const m = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending,
      vertexShader: `attribute vec3 aColor; attribute float aSize; varying vec3 vC;
        void main() { vC = aColor; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize; }`,
      fragmentShader: `varying vec3 vC; void main() { float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vC, pow(max(0.0, 1.0 - d), 1.6)); }`,
    });
    return {geometry: g, material: m};
  }, [seed]);
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

function Sun({direction}: {direction: Vector3}) {
  const glow = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,248,235,1)');
    grad.addColorStop(0.1, 'rgba(255,232,200,0.5)');
    grad.addColorStop(0.35, 'rgba(255,205,150,0.08)');
    grad.addColorStop(1, 'rgba(255,190,130,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, []);
  const p = direction.clone().multiplyScalar(1100);
  return <group position={[p.x, p.y, p.z]}>
    <mesh>
      <sphereGeometry args={[16, 32, 16]} />
      <meshBasicMaterial color={new Color(14, 12.5, 10.5)} toneMapped={false} />
    </mesh>
    <sprite scale={[260, 260, 1]}>
      <spriteMaterial map={glow} blending={AdditiveBlending} depthWrite={false} transparent color={new Color(1.6, 1.5, 1.4)} />
    </sprite>
  </group>;
}

function SpaceScene({ctx}: {ctx: WorldContext}) {
  const {spec, framing, progress, t} = ctx;
  const subject = spec.subject;
  const sky = useMemo(() => {
    const tex = starrySky(spec.seed, ctx.accent);
    tex.mapping = EquirectangularReflectionMapping;
    return tex;
  }, [spec.seed, ctx.accent]);

  // Sun angle is measured from the camera's starting viewpoint: 0° lights the side we see, 180° backlights it.
  const angles = subject.kind === 'planet' ? subject.sunAngle : [40, 40];
  const sunAz = deg(framing.azimuth + spec.camera.angle + lerp(angles[0], angles[1], easings.smooth(progress)));
  const sun = useMemo(() => new Vector3(), []);
  sun.set(Math.sin(sunAz) * Math.cos(deg(6)), Math.sin(deg(6)), Math.cos(sunAz) * Math.cos(deg(6))).normalize();

  const moonOrbit = 2.6;
  const moonAngle = deg(framing.azimuth + spec.camera.angle + 55) + (subject.kind === 'planet' ? subject.orbitTurns : 0) * Math.PI * 2 * progress;
  const moonSpec: PlanetSpec = {kind: 'planet', planet: 'moon', moon: false, rings: false, orbitPath: false, sunAngle: [0, 0], orbitTurns: 0, spin: 0.2};
  const sunPos = sun.clone().multiplyScalar(60);
  const scene = useThree((s) => s.scene);
  scene.backgroundIntensity = 1.7;
  const camDir = deg(framing.azimuth + spec.camera.angle);
  const fill: Vec3 = [Math.sin(camDir) * 50, 18, Math.cos(camDir) * 50];

  return <>
    <primitive attach="background" object={sky} />
    {/* Earthshine: a faint cool fill from the camera side so night sides keep their shape against black space. */}
    <ambientLight intensity={0.045} color="#9fb3ff" />
    <directionalLight position={fill} intensity={0.2} color="#8ea8ff" />
    <directionalLight position={[sunPos.x, sunPos.y, sunPos.z]} intensity={4.4} color="#fff4e4" />
    <Stars seed={spec.seed} />
    <Sun direction={sun} />
    {subject.kind === 'planet' ? <>
      <Planet spec={subject} seed={spec.seed} sun={sun} t={t} progress={progress} />
      {subject.moon && <group rotation={[0, 0, deg(5)]}>
        {subject.orbitPath && <OrbitPath radius={moonOrbit} />}
        <group position={[Math.sin(moonAngle) * moonOrbit, 0, Math.cos(moonAngle) * moonOrbit]}>
          <Planet spec={moonSpec} seed={spec.seed + 1} sun={sun} t={t} progress={progress} radius={0.27} detail="small" />
        </group>
      </group>}
    </> : <Subject spec={subject} accent={ctx.accent} seconds={t} />}
  </>;
}

/** Deep space: a procedural planet (or any subject) lit by a real sun, with stars and the Milky Way behind. */
export const space: WorldDef = {
  defaultMood: 'night',
  framing: (spec) => {
    const s = spec.subject;
    const orbit = s.kind === 'planet' && s.moon;
    const radius = s.kind === 'planet' ? (orbit ? 7.4 : 3.6) : 3.2 + subjectRadius(s) * 2.4;
    return {target: [0, 0, 0] as Vec3, radius, height: orbit ? radius * 0.34 : radius * 0.1, azimuth: 0, near: 0.02, far: 4000};
  },
  lens: () => ({bloom: 0.9, bloomThreshold: 0.9, dof: 0, focusRange: 6, tone: 'aces', exposure: 1.3, chromatic: 0.45, vignette: 0.45}),
  particles: () => 'none',
  render: (ctx) => <SpaceScene ctx={ctx} />,
};
