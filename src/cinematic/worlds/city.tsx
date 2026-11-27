import {Environment, Lightformer, MeshReflectorMaterial} from '@react-three/drei';
import {useLayoutEffect, useMemo} from 'react';
import {
  AdditiveBlending, BackSide, BoxGeometry, CanvasTexture, Color, InstancedBufferAttribute, InstancedMesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, PlaneGeometry, SRGBColorSpace, ShaderMaterial, SphereGeometry, type BufferGeometry, type Material,
} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {rng, type Vec3} from '../math';
import {Subject, subjectRadius} from '../subjects';
import type {Mood, WorldContext, WorldDef} from '../types';

type Palette = {zenith: string; horizon: string; fog: string; density: number; lit: number; day: boolean; sun: string; sunHeight: number; neon: string[]; concrete: string[]};

function palette(mood: Mood, accent: string): Palette {
  const night = {zenith: '#050a18', horizon: '#2a1f48', fog: '#1a1530', density: 0.0042, lit: 0.42, day: false, sun: '#8fa6ff', sunHeight: 0.6, neon: ['#ff2fb4', '#22d3ff', '#ffb000', accent], concrete: ['#0d1118', '#10151d', '#0b0e14', '#141821']};
  switch (mood) {
    case 'neon': return {...night, zenith: '#05010d', horizon: '#3a0f4a', fog: '#250a33', density: 0.005, lit: 0.36, neon: ['#ff2fb4', '#22d3ff', '#b84dff', accent]};
    case 'dusk': return {...night, zenith: '#141a3a', horizon: '#ff8a5c', fog: '#4a3048', density: 0.0035, lit: 0.26, sun: '#ff9a62', sunHeight: 0.08};
    case 'dawn': return {...night, zenith: '#2a3a66', horizon: '#ffb39c', fog: '#7d6d84', density: 0.003, lit: 0.1, sun: '#ffc2a0', sunHeight: 0.1};
    case 'golden': return {...night, zenith: '#4a78b8', horizon: '#ffd29a', fog: '#c9a582', density: 0.0026, lit: 0, day: true, sun: '#ffd09a', sunHeight: 0.22, concrete: ['#6c6f78', '#7d8490', '#5d6470', '#8a8478']};
    case 'noon': return {...night, zenith: '#3d7fd6', horizon: '#cfe3f5', fog: '#b4cadc', density: 0.0024, lit: 0, day: true, sun: '#ffffff', sunHeight: 0.9, concrete: ['#7b818c', '#8f97a3', '#6a7380', '#9a958c']};
    default: return night;
  }
}

const skyShader = (p: Palette) => new ShaderMaterial({
  side: BackSide, depthWrite: false, fog: false,
  uniforms: {uZenith: {value: new Color(p.zenith)}, uHorizon: {value: new Color(p.horizon)}},
  vertexShader: `varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 uZenith, uHorizon; varying vec3 vD;
    void main() { float h = max(vD.y, 0.0); vec3 c = mix(uHorizon, uZenith, pow(h, 0.45)); gl_FragColor = vec4(vD.y < 0.0 ? uHorizon * 0.7 : c, 1.0); }`,
});

type Lot = {x: number; z: number; w: number; d: number; h: number; side: number; col: number};

function layout(seed: number): Lot[] {
  const random = rng(seed + 3), lots: Lot[] = [];
  for (let row = 0; row < 44; row++) {
    if (row % 4 === 3) continue; // cross street
    const z = 50 - row * 16;
    for (const side of [-1, 1]) {
      for (let col = 0; col < 13; col++) {
        if (random() < 0.06 * col) continue;
        const x = side * (22 + col * 17);
        const downtown = Math.exp(-((z + 280) ** 2) / (2 * 110 ** 2)) * Math.exp(-(x * x) / (2 * 90 ** 2));
        const h = (8 + 46 * Math.pow(random(), 2.4)) * (col < 2 ? 1.35 : 1) * (1 - col * 0.03) + 170 * downtown * random();
        lots.push({x: x + (random() - 0.5) * 2, z: z + (random() - 0.5) * 2, w: 9 + random() * 4, d: 9 + random() * 4, h, side, col});
      }
    }
  }
  return lots;
}

function buildingMaterial(p: Palette): MeshStandardMaterial {
  const m = new MeshStandardMaterial({color: '#ffffff', roughness: p.day ? 0.4 : 0.55, metalness: p.day ? 0.55 : 0.4, envMapIntensity: p.day ? 1.1 : 0.8});
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uLit = {value: p.lit};
    shader.uniforms.uWindow = {value: p.day ? 0 : 2.2};
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSeed;\nvarying float vSeed;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 cityW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        vWPos = cityW.xyz;
        vWNrm = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);
        vSeed = aSeed;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uLit;
        uniform float uWindow;
        varying float vSeed;
        varying vec3 vWPos;
        varying vec3 vWNrm;
        float cityHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 nW = normalize(vWNrm);
          if (nW.y < 0.5) {
            // Three facade styles per building: office grid, small residential windows, glass curtain wall.
            float style = floor(fract(vSeed * 7.13) * 3.0);
            vec2 cellSize = style < 0.5 ? vec2(1.5, 3.3) : style < 1.5 ? vec2(2.8, 3.1) : vec2(1.25, 3.3);
            vec2 paneMin = style < 0.5 ? vec2(0.12, 0.22) : style < 1.5 ? vec2(0.3, 0.28) : vec2(0.05, 0.12);
            vec2 cell = abs(nW.x) > 0.5 ? vWPos.zy : vWPos.xy;
            vec2 g = cell / cellSize;
            vec2 id = floor(g);
            vec2 f = fract(g);
            float pane = step(paneMin.x, f.x) * step(f.x, 1.0 - paneMin.x) * step(paneMin.y, f.y) * step(f.y, 1.0 - paneMin.y) * step(4.0, vWPos.y);
            float density = uLit * (0.35 + 1.3 * cityHash(vec2(vSeed, 1.7)));
            // Curtain walls light up a whole floor at a time.
            float key = style > 1.5 ? cityHash(vec2(id.y, vSeed * 13.1)) : cityHash(id + vSeed * 91.7);
            float lit = step(1.0 - density, key);
            float tone = cityHash(id * 1.37 + vSeed);
            vec3 wc = tone < 0.6 ? vec3(1.0, 0.66, 0.36) : tone < 0.88 ? vec3(0.7, 0.82, 1.0) : vec3(0.45, 0.55, 1.0);
            float dim = 0.12 + 0.88 * pow(cityHash(id + 7.13), 1.6);
            float soft = 1.0 - 0.5 * length(f - 0.5);
            totalEmissiveRadiance += pane * lit * wc * dim * soft * uWindow;
            roughnessFactor = mix(roughnessFactor, 0.06, pane * 0.85);
            diffuseColor.rgb *= mix(1.0, 0.4, pane);
            float bay = fract(cell.x / 3.2);
            float shop = step(0.55, cityHash(vec2(vSeed, 3.3))) * step(0.6, vWPos.y) * step(vWPos.y, 3.0) * step(0.08, bay) * step(bay, 0.92);
            totalEmissiveRadiance += shop * mix(vec3(1.0, 0.55, 0.3), vec3(0.4, 0.8, 1.0), cityHash(vec2(vSeed, 9.1))) * uWindow * 0.12;
            diffuseColor.rgb *= 1.0 - shop * 0.6;
          }
        }`);
  };
  return m;
}

function useInstances(geometry: BufferGeometry, material: Material, count: number, place: (o: Object3D, i: number) => void, deps: unknown[]) {
  const mesh = useMemo(() => {
    const m = new InstancedMesh(geometry, material, count);
    m.frustumCulled = false;
    return m;
  }, [geometry, material, count]);
  useLayoutEffect(() => {
    const o = new Object3D();
    for (let i = 0; i < count; i++) {
      place(o, i);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh, ...deps]);
  return mesh;
}

function CityScene({ctx}: {ctx: WorldContext}) {
  const {spec, t, accent} = ctx;
  const p = palette(ctx.mood, accent);
  const lots = useMemo(() => layout(spec.seed), [spec.seed]);

  const towers = useMemo(() => {
    const g = new BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const random = rng(spec.seed + 9);
    g.setAttribute('aSeed', new InstancedBufferAttribute(new Float32Array(lots.map(() => random())), 1));
    const mesh = new InstancedMesh(g, buildingMaterial(p), lots.length);
    const o = new Object3D(), c = new Color();
    lots.forEach((lot, i) => {
      o.position.set(lot.x, 0, lot.z);
      o.scale.set(lot.w, lot.h, lot.d);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, c.set(p.concrete[i % p.concrete.length]));
    });
    return mesh;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lots, ctx.mood, accent]);

  // Street furniture along the avenue.
  const lampZ = useMemo(() => Array.from({length: 30}, (_, i) => 50 - i * 22), []);
  const parts = useMemo(() => ({
    pole: new BoxGeometry(0.16, 7, 0.16).translate(0, 3.5, 0), lamp: new SphereGeometry(0.24, 16, 8), dash: new PlaneGeometry(0.22, 3).rotateX(-Math.PI / 2),
    pool: new PlaneGeometry(10, 10).rotateX(-Math.PI / 2), light: new SphereGeometry(0.16, 12, 8), car: new RoundedBoxGeometry(1.9, 1.35, 4.4, 3, 0.35),
    poleMat: new MeshStandardMaterial({color: '#1a1c22', metalness: 0.7, roughness: 0.5}),
    lampMat: new MeshBasicMaterial({color: new Color(p.day ? '#dddddd' : '#ffd7a0').multiplyScalar(p.day ? 1 : 7)}),
    dashMat: new MeshStandardMaterial({color: '#d8dbe2', roughness: 0.6, emissive: '#ffffff', emissiveIntensity: p.day ? 0 : 0.15}),
    poolMat: new MeshBasicMaterial({map: poolTexture(), color: new Color('#ffc27a').multiplyScalar(0.32), transparent: true, depthWrite: false, blending: AdditiveBlending}),
    head: new MeshBasicMaterial({color: new Color(6, 6, 5.2)}), tail: new MeshBasicMaterial({color: new Color(6, 0.35, 0.22)}),
    carMat: new MeshStandardMaterial({color: '#ffffff', metalness: 0.7, roughness: 0.25}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ctx.mood]);

  const poles = useInstances(parts.pole, parts.poleMat, lampZ.length * 2, (o, i) => o.position.set(i % 2 ? 11.5 : -11.5, 0, lampZ[i >> 1]), [lampZ]);
  const lamps = useInstances(parts.lamp, parts.lampMat, lampZ.length * 2, (o, i) => o.position.set(i % 2 ? 10.4 : -10.4, 7, lampZ[i >> 1]), [lampZ]);
  const pools = useInstances(parts.pool, parts.poolMat, p.day ? 0 : lampZ.length * 2, (o, i) => o.position.set(i % 2 ? 8.6 : -8.6, 0.03, lampZ[i >> 1]), [lampZ]);
  const dashes = useInstances(parts.dash, parts.dashMat, 76, (o, i) => o.position.set(0, 0.02, 52 - i * 9), []);

  // Traffic: oncoming headlights on the left lane, tail lights going away on the right. Positions are a pure function of t.
  const cars = useMemo(() => {
    const random = rng(spec.seed + 21);
    return Array.from({length: 72}, (_, i) => ({lane: i % 2, inner: random() < 0.5, z0: random() * 680, v: 12 + random() * 7, color: ['#20242c', '#8a8f99', '#5a1218', '#14233f', '#d9dce2'][Math.floor(random() * 5)]}));
  }, [spec.seed]);
  const laneX = (c: typeof cars[number]) => (c.lane === 0 ? -1 : 1) * (c.inner ? 2.6 : 6.2);
  const carZ = (c: typeof cars[number]) => {
    const travel = c.lane === 0 ? c.z0 + c.v * t : c.z0 - c.v * t;
    return 60 - (((travel % 680) + 680) % 680);
  };
  const bodies = useInstances(parts.car, parts.carMat, cars.length, (o, i) => {
    o.position.set(laneX(cars[i]), 0.72, carZ(cars[i]));
  }, [t, cars]);
  const heads = useInstances(parts.light, parts.head, cars.length, (o, i) => {
    const c = cars[i];
    o.position.set(c.lane === 0 ? laneX(c) + (i % 4 < 2 ? -0.62 : 0.62) : 99999, 0.75, carZ(c) + 2.2);
    o.scale.set(1, 0.7, 2.2);
  }, [t, cars]);
  const tails = useInstances(parts.light, parts.tail, cars.length, (o, i) => {
    const c = cars[i];
    o.position.set(c.lane === 1 ? laneX(c) + (i % 4 < 2 ? -0.62 : 0.62) : 99999, 0.8, carZ(c) + 2.2);
    o.scale.set(1, 0.6, 1.6);
  }, [t, cars]);
  useLayoutEffect(() => {
    const c = new Color();
    cars.forEach((car, i) => bodies.setColorAt(i, c.set(car.color)));
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  }, [bodies, cars]);

  // Neon signs on the avenue-facing walls, plus red aviation lights blinking on the tallest roofs.
  const signs = useMemo(() => {
    const random = rng(spec.seed + 33);
    return lots.filter((l) => l.col === 0 && random() < 0.55).map((l) => ({
      x: l.x - l.side * (l.w / 2 + 0.25), z: l.z + (random() - 0.5) * l.d * 0.6, y: 5 + random() * 12, h: 2 + random() * 7,
      color: p.neon[Math.floor(random() * p.neon.length)], flicker: random() < 0.15, phase: random() * 10,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lots, ctx.mood, accent]);
  const tall = useMemo(() => lots.filter((l) => l.h > 70), [lots]);

  const sky = useMemo(() => skyShader(p), [p.zenith, p.horizon]);
  const sunDir: Vec3 = [-0.55, p.sunHeight, -0.7];
  const r = subjectRadius(spec.subject);

  return <>
    <color attach="background" args={[p.horizon]} />
    <fogExp2 attach="fog" args={[p.fog, p.density]} />
    <mesh material={sky} scale={1800}><sphereGeometry args={[1, 32, 16]} /></mesh>
    <Environment resolution={128} frames={1}>
      <mesh material={sky} scale={100}><sphereGeometry args={[1, 32, 16]} /></mesh>
      {!p.day && p.neon.slice(0, 3).map((c, i) => <Lightformer key={i} form="rect" color={c} intensity={1.4} position={[(i - 1) * 6, 3 + i, -8]} scale={[1, 6, 1]} />)}
      {p.day && <Lightformer form="circle" color={p.sun} intensity={8} position={[sunDir[0] * 20, sunDir[1] * 20 + 2, sunDir[2] * 20]} scale={4} />}
    </Environment>
    <hemisphereLight args={[p.horizon, '#05060a', p.day ? 1.3 : 0.75]} />
    <directionalLight position={[sunDir[0] * 100, Math.max(0.15, sunDir[1]) * 100, sunDir[2] * 100]} intensity={p.day ? 3 : 0.35} color={p.sun} />
    <primitive object={towers} />
    <primitive object={poles} />
    <primitive object={lamps} />
    <primitive object={pools} />
    <primitive object={dashes} />
    <primitive object={bodies} />
    <primitive object={heads} />
    <primitive object={tails} />
    {signs.map((s, i) => {
      const on = s.flicker ? (Math.sin(t * 23 + s.phase) + Math.sin(t * 7.3 + s.phase * 2) > -0.6 ? 1 : 0.15) : 1;
      return <mesh key={i} position={[s.x, s.y, s.z]}>
        <boxGeometry args={[0.18, s.h, 0.5]} />
        <meshBasicMaterial color={new Color(s.color).multiplyScalar((p.day ? 1.2 : 4.5) * on)} />
      </mesh>;
    })}
    {!p.day && tall.map((l, i) => <mesh key={i} position={[l.x, l.h + 0.5, l.z]}>
      <sphereGeometry args={[0.35, 10, 6]} />
      <meshBasicMaterial color={new Color(8, 0.4, 0.3).multiplyScalar(Math.sin(t * 3 + i) > 0.3 ? 1 : 0.04)} />
    </mesh>)}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -250]}>
      <planeGeometry args={[1400, 1400]} />
      <MeshReflectorMaterial blur={[260, 80]} resolution={512} mixBlur={1} mixStrength={p.day ? 2 : 14} roughness={p.day ? 0.9 : 0.62}
        depthScale={0.6} minDepthThreshold={0.6} maxDepthThreshold={1.4} color={p.day ? '#3b3e45' : '#06070a'} metalness={p.day ? 0.2 : 0.55} mirror={p.day ? 0.2 : 0.7} />
    </mesh>
    {spec.subject.kind !== 'none' && <group position={[0, 10 + r * 3, -50]} scale={4}>
      <Subject spec={spec.subject} accent={accent} seconds={t} />
    </group>}
  </>;
}

function poolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A city at night (or any time of day): lit towers, a wet reflective avenue, traffic, neon and haze. */
export const city: WorldDef = {
  defaultMood: 'night',
  framing: (spec) => {
    const r = subjectRadius(spec.subject);
    const hero = spec.subject.kind !== 'none';
    return {
      target: hero ? [0, 10 + r * 3, -50] : [0, 22, -170], radius: hero ? 4 * (3 + r * 3.2) : 125, height: hero ? 4 : 26, azimuth: 0, near: 0.1, far: 2600,
      travel: (u) => {
        const z = 46 - u * 250, sway = (k: number) => Math.sin(k * Math.PI * 1.2) * 2.5;
        return {position: [sway(u), 11 + 8 * u, z], target: [sway(u + 0.06), 9 + 7 * u, z - 60]};
      },
      floor: () => 0.8,
    };
  },
  lens: (_, mood) => ({bloom: mood === 'noon' || mood === 'golden' ? 0.45 : 1, bloomThreshold: 0.8, dof: 0.7, focusRange: 60, tone: 'aces', exposure: mood === 'noon' || mood === 'golden' ? 1 : 1.2, chromatic: 0.5, vignette: 0.42}),
  particles: (_, mood) => mood === 'neon' ? 'rain' : 'none',
  render: (ctx) => <CityScene ctx={ctx} />,
};
