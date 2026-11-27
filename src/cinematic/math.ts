import {createNoise2D, createNoise3D, type NoiseFunction2D, type NoiseFunction3D} from 'simplex-noise';

export type Vec3 = [number, number, number];

/** Small, fast, seedable PRNG. Every random value in a scene must come from one of these so renders repeat exactly. */
export function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noise2Cache = new Map<number, NoiseFunction2D>();
const noise3Cache = new Map<number, NoiseFunction3D>();

export function noise2(seed: number): NoiseFunction2D {
  let fn = noise2Cache.get(seed);
  if (!fn) noise2Cache.set(seed, fn = createNoise2D(rng(seed)));
  return fn;
}

export function noise3(seed: number): NoiseFunction3D {
  let fn = noise3Cache.get(seed);
  if (!fn) noise3Cache.set(seed, fn = createNoise3D(rng(seed)));
  return fn;
}

/** Fractal noise in roughly [-1, 1]. */
export function fbm3(n: NoiseFunction3D, x: number, y: number, z: number, octaves: number, lacunarity = 2, gain = 0.5): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * n(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ridged fractal noise in [0, 1]: sharp crests, good for mountain ranges. */
export function ridged3(n: NoiseFunction3D, x: number, y: number, z: number, octaves: number): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0, prev = 1;
  for (let i = 0; i < octaves; i++) {
    let v = 1 - Math.abs(n(x * freq, y * freq, z * freq));
    v *= v;
    sum += v * amp * prev;
    prev = v;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const deg = (d: number) => d * Math.PI / 180;

export const easings = {
  linear: (t: number) => t,
  smooth: (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t)),
  cinematic: (t: number) => {
    const x = clamp(t);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  },
} as const;

export function hexToRgb(hex: string): Vec3 {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
}

export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(lerp(x, y, t) * 255).toString(16).padStart(2, '0');
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}

/** Vertical field of view (degrees) for a full-frame focal length, fitted to the short side so 9:16 and 16:9 frame alike. */
export function lensToFov(mm: number, width: number, height: number): number {
  const shortFov = 2 * Math.atan(24 / (2 * mm));
  if (height <= width) return shortFov * 180 / Math.PI;
  return 2 * Math.atan(Math.tan(shortFov / 2) * height / width) * 180 / Math.PI;
}
