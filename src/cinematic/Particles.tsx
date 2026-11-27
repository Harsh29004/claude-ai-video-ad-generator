import {useMemo} from 'react';
import {AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial, Vector3} from 'three';
import {rng, type Vec3} from './math';
import type {particleKinds} from './vocab';

export type ParticleKind = Exclude<typeof particleKinds[number], 'auto'>;

type Recipe = {
  count: number; size: number; colors: [string, string]; velocity: Vec3; wander: number;
  twinkle: number; intensity: number; opacity: number; streak?: boolean; disc?: boolean;
};

const recipes: Record<Exclude<ParticleKind, 'none'>, Recipe> = {
  dust: {count: 520, size: 0.014, colors: ['#fff1dc', '#d6e6ff'], velocity: [0.01, 0.025, 0], wander: 0.22, twinkle: 0.35, intensity: 1.3, opacity: 0.42},
  sparks: {count: 450, size: 0.03, colors: ['#ffc46b', '#ff6a1f'], velocity: [0.05, 0.9, 0], wander: 0.35, twinkle: 0.85, intensity: 7, opacity: 0.9},
  embers: {count: 260, size: 0.05, colors: ['#ffb057', '#ff4d1a'], velocity: [0.12, 0.42, 0], wander: 0.5, twinkle: 0.7, intensity: 4.5, opacity: 0.85},
  snow: {count: 1800, size: 0.045, colors: ['#ffffff', '#dce9ff'], velocity: [0.06, -0.55, 0], wander: 0.35, twinkle: 0, intensity: 1.15, opacity: 0.85},
  rain: {count: 2800, size: 0.11, colors: ['#bcd3f2', '#8fb0dc'], velocity: [0.35, -9, 0], wander: 0, twinkle: 0, intensity: 1.3, opacity: 0.32, streak: true},
  bokeh: {count: 70, size: 0.5, colors: ['#ffd9a8', '#9fd8ff'], velocity: [0.05, 0.03, 0], wander: 0.45, twinkle: 0.2, intensity: 1.3, opacity: 0.16, disc: true},
  fireflies: {count: 160, size: 0.06, colors: ['#e2ff86', '#ffe48a'], velocity: [0, 0.03, 0], wander: 1.1, twinkle: 1, intensity: 6, opacity: 0.95},
};

const vertexShader = /* glsl */ `
uniform float uTime, uSize, uScale, uWander, uTwinkle;
uniform vec3 uBox, uVel;
attribute vec4 aRand;
varying float vAlpha;
varying float vMix;
void main() {
  vec3 h = uBox * 0.5;
  float ph = aRand.w * 6.2831853;
  vec3 p = (aRand.xyz - 0.5) * uBox;
  p += uVel * uTime * (0.6 + 0.8 * fract(aRand.w * 7.31));
  p += uWander * vec3(sin(uTime * 0.41 + ph * 3.1), sin(uTime * 0.29 + ph * 1.7) * 0.6, cos(uTime * 0.37 + ph * 2.3));
  p = mod(p + h, uBox) - h;
  vec3 e = 1.0 - smoothstep(0.72, 1.0, abs(p) / h);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = uSize * (0.45 + 1.1 * fract(aRand.w * 13.7));
  gl_PointSize = clamp(s * uScale / max(-mv.z, 0.05), 1.0, 220.0);
  float tw = mix(1.0, 0.45 + 0.55 * sin(uTime * (1.5 + 5.0 * aRand.x) + ph * 7.0), uTwinkle);
  vAlpha = e.x * e.y * e.z * max(tw, 0.0) * smoothstep(0.15, 1.2, -mv.z);
  vMix = fract(aRand.y * 31.7);
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uColorA, uColorB;
uniform float uOpacity, uStreak, uDisc;
varying float vAlpha;
varying float vMix;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (uStreak > 0.5) c.x *= 7.0;
  float d = length(c) * 2.0;
  float a = uDisc > 0.5 ? smoothstep(1.0, 0.86, d) * (0.75 + 0.25 * d) : pow(max(0.0, 1.0 - d), 2.2);
  if (a <= 0.001) discard;
  gl_FragColor = vec4(mix(uColorA, uColorB, vMix), a * vAlpha * uOpacity);
}`;

/**
 * GPU particles in a fixed box. Motion comes only from `seconds` (frame-driven), so any frame can be rendered on
 * its own. Particles wrap around the box and fade at its edges, so the wrap is never visible.
 */
export function Particles({kind, seed, seconds, center, box, pixelsPerUnit, density = 1}: {
  kind: ParticleKind; seed: number; seconds: number; center: Vec3; box: Vec3; pixelsPerUnit: number; density?: number;
}) {
  const recipe = kind === 'none' ? null : recipes[kind];
  const scale = Math.max(box[0], box[1], box[2]) / 10;

  const geometry = useMemo(() => {
    if (!recipe) return null;
    const count = Math.round(recipe.count * density);
    const random = rng(seed * 31 + count);
    const rand = new Float32Array(count * 4);
    for (let i = 0; i < rand.length; i++) rand[i] = random();
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aRand', new BufferAttribute(rand, 4));
    return g;
  }, [recipe, seed, density]);

  const material = useMemo(() => {
    if (!recipe) return null;
    const color = (hex: string) => new Color(hex).multiplyScalar(recipe.intensity);
    return new ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: {
        uTime: {value: 0}, uSize: {value: recipe.size * scale}, uScale: {value: pixelsPerUnit},
        uWander: {value: recipe.wander * scale}, uTwinkle: {value: recipe.twinkle},
        uBox: {value: new Vector3(...box)}, uVel: {value: new Vector3(...recipe.velocity).multiplyScalar(scale)},
        uColorA: {value: color(recipe.colors[0])}, uColorB: {value: color(recipe.colors[1])},
        uOpacity: {value: recipe.opacity}, uStreak: {value: recipe.streak ? 1 : 0}, uDisc: {value: recipe.disc ? 1 : 0},
      },
    });
    // Depend on the box's numbers, not the array, so callers can pass a fresh literal every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe, scale, pixelsPerUnit, box[0], box[1], box[2]]);

  if (!geometry || !material) return null;
  material.uniforms.uTime.value = seconds;
  return <points geometry={geometry} material={material} position={center} frustumCulled={false} renderOrder={10} />;
}
