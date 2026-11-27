import {
  ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RGBAFormat,
  RepeatWrapping, SRGBColorSpace, UnsignedByteType,
} from 'three';
import {clamp, fbm3, lerp, noise3, ridged3, rng, smoothstep, type Vec3} from './math';
import type {planets} from './vocab';

export type PlanetKind = typeof planets[number];

/** `surface`: R = height (bump), G = roughness. */
export type PlanetMaps = {color: DataTexture; surface: DataTexture; lights?: DataTexture; clouds?: DataTexture};

function texture(data: Uint8Array, w: number, h: number, srgb: boolean): DataTexture {
  const t = new DataTexture(data, w, h, RGBAFormat, UnsignedByteType);
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = ClampToEdgeWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/**
 * Visits every texel with the unit-sphere direction three's SphereGeometry maps to it, so the noise below is
 * seamless at the date line and pinches correctly at the poles.
 */
function eachTexel(w: number, h: number, fn: (i: number, x: number, y: number, z: number) => void) {
  for (let j = 0; j < h; j++) {
    const theta = (1 - (j + 0.5) / h) * Math.PI;
    const st = Math.sin(theta), y = Math.cos(theta);
    for (let i = 0; i < w; i++) {
      const phi = ((i + 0.5) / w) * Math.PI * 2;
      fn(j * w + i, -Math.cos(phi) * st, y, Math.sin(phi) * st);
    }
  }
}

/** Adds impact craters (bowl, raised rim, central peak on big ones) by stamping only the texels each one covers. */
function stampCraters(height: Float32Array, albedo: Float32Array, w: number, h: number, seed: number, count: number, avoid?: (x: number, y: number, z: number) => number) {
  const random = rng(seed);
  for (let k = 0; k < count; k++) {
    const u = random() * 2 - 1, a = random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const cx = s * Math.cos(a), cy = u, cz = s * Math.sin(a);
    const rho = Math.min(0.15, 0.0048 * Math.pow(1 / (random() + 0.014), 0.62));
    if (avoid && random() < avoid(cx, cy, cz)) continue;
    const reach = rho * 1.9;
    const thetaC = Math.acos(cy);
    const phiC = ((Math.atan2(cz, -cx) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const j0 = Math.max(0, Math.floor((1 - (thetaC + reach) / Math.PI) * h)), j1 = Math.min(h - 1, Math.ceil((1 - (thetaC - reach) / Math.PI) * h));
    const depth = rho * 0.55, rim = depth * 0.3, peak = rho > 0.045 ? depth * 0.4 : 0;
    const fresh = random() < 0.18 ? 0.07 : 0;
    for (let j = j0; j <= j1; j++) {
      const theta = (1 - (j + 0.5) / h) * Math.PI;
      const st = Math.sin(theta), y = Math.cos(theta);
      let i0 = 0, i1 = w - 1;
      if (st > Math.sin(reach) + 1e-3) {
        const dphi = Math.asin(Math.min(1, Math.sin(reach) / st));
        i0 = Math.floor(((phiC - dphi) / (Math.PI * 2)) * w);
        i1 = Math.ceil(((phiC + dphi) / (Math.PI * 2)) * w);
      }
      for (let ii = i0; ii <= i1; ii++) {
        const i = ((ii % w) + w) % w;
        const phi = ((i + 0.5) / w) * Math.PI * 2;
        const x = -Math.cos(phi) * st, z = Math.sin(phi) * st;
        const d = Math.acos(Math.min(1, x * cx + y * cy + z * cz));
        const r = d / rho;
        if (r > 1.9) continue;
        const idx = j * w + i;
        if (r < 1) {
          height[idx] += -depth * (1 - r * r) + rim * Math.pow(r, 6) + peak * Math.exp(-(r * r) / 0.02);
          albedo[idx] += -0.03 + fresh * 0.6;
        } else {
          const t = (r - 1) / 0.3;
          height[idx] += rim * Math.exp(-t * t);
          albedo[idx] += fresh * Math.exp(-t * t * 0.5);
        }
      }
    }
  }
}

function pack(w: number, h: number, colorAt: (i: number) => Vec3, heightArr: Float32Array, roughAt: (i: number) => number) {
  let lo = Infinity, hi = -Infinity;
  for (const v of heightArr) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const color = new Uint8Array(w * h * 4), surface = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const c = colorAt(i);
    color[i * 4] = clamp(c[0]) * 255;
    color[i * 4 + 1] = clamp(c[1]) * 255;
    color[i * 4 + 2] = clamp(c[2]) * 255;
    color[i * 4 + 3] = 255;
    surface[i * 4] = ((heightArr[i] - lo) / (hi - lo || 1)) * 255;
    surface[i * 4 + 1] = clamp(roughAt(i)) * 255;
    surface[i * 4 + 3] = 255;
  }
  return {color: texture(color, w, h, true), surface: texture(surface, w, h, false)};
}

const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function moon(seed: number, w: number, h: number): PlanetMaps {
  const n = noise3(seed), n2 = noise3(seed + 17);
  const height = new Float32Array(w * h), albedo = new Float32Array(w * h);
  eachTexel(w, h, (i, x, y, z) => {
    const m = smoothstep(0.06, 0.28, fbm3(n, x * 1.1 + 3.1, y * 1.1, z * 1.1, 4));
    const d1 = fbm3(n2, x * 6, y * 6, z * 6, 4), d2 = n2(x * 40, y * 40, z * 40);
    height[i] = d1 * 0.045 + d2 * 0.008 - m * 0.03;
    albedo[i] = 0.68 + d1 * 0.08 + d2 * 0.03 - m * 0.3;
  });
  stampCraters(height, albedo, w, h, seed * 13 + 5, Math.round(w * 1.1), (x, y, z) => smoothstep(0.1, 0.3, fbm3(n, x * 1.1 + 3.1, y * 1.1, z * 1.1, 4)) * 0.65);
  return pack(w, h, (i) => [albedo[i], albedo[i] * 0.975, albedo[i] * 0.94], height, () => 0.96);
}

function mars(seed: number, w: number, h: number): PlanetMaps {
  const n = noise3(seed), n2 = noise3(seed + 5);
  const height = new Float32Array(w * h), albedo = new Float32Array(w * h), tone = new Float32Array(w * h), lat = new Float32Array(w * h);
  eachTexel(w, h, (i, x, y, z) => {
    const e = fbm3(n, x * 1.6, y * 1.6, z * 1.6, 6);
    height[i] = e * 0.08 + ridged3(n2, x * 3, y * 3, z * 3, 4) * 0.03;
    tone[i] = smoothstep(-0.2, 0.35, fbm3(n2, x * 2.2 + 7, y * 2.2, z * 2.2, 5));
    albedo[i] = 0;
    lat[i] = Math.abs(y) + n(x * 8, y * 8, z * 8) * 0.03;
  });
  stampCraters(height, albedo, w, h, seed * 3 + 1, Math.round(w * 0.45));
  const dark: Vec3 = [0.3, 0.14, 0.08], rust: Vec3 = [0.66, 0.33, 0.17], dust: Vec3 = [0.8, 0.55, 0.36];
  return pack(w, h, (i) => {
    let c = mix3(dark, mix3(rust, dust, tone[i]), smoothstep(-0.4, 0.4, tone[i] * 1.4 - 0.3));
    c = c.map((v) => v + albedo[i] * 0.5) as Vec3;
    return mix3(c, [0.95, 0.94, 0.92], smoothstep(0.88, 0.92, lat[i]));
  }, height, () => 0.92);
}

function earth(seed: number, w: number, h: number): PlanetMaps {
  const n = noise3(seed), wn = noise3(seed + 3), cn = noise3(seed + 7), ln = noise3(seed + 11);
  const height = new Float32Array(w * h);
  const color = new Uint8Array(w * h * 4), lights = new Uint8Array(w * h * 4), surface = new Uint8Array(w * h * 4);
  const sea = 0.035;
  const deepC: Vec3 = [0.015, 0.05, 0.14], shallowC: Vec3 = [0.05, 0.25, 0.36];
  const desert: Vec3 = [0.78, 0.63, 0.42], savanna: Vec3 = [0.58, 0.53, 0.3], grass: Vec3 = [0.28, 0.42, 0.16];
  const forest: Vec3 = [0.11, 0.25, 0.09], tundra: Vec3 = [0.4, 0.38, 0.32], rock: Vec3 = [0.38, 0.34, 0.3], snow: Vec3 = [0.93, 0.95, 0.98];
  eachTexel(w, h, (i, x, y, z) => {
    const q = fbm3(wn, x * 1.4, y * 1.4, z * 1.4, 3) * 0.3;
    const e = fbm3(n, x * 1.2 + q, y * 1.2 - q * 0.6, z * 1.2 + q * 0.8, 7);
    const lat = Math.abs(y);
    let c: Vec3, rough: number, glow = 0;
    if (e < sea) {
      c = mix3(shallowC, deepC, smoothstep(0, 0.1, sea - e));
      rough = 0.42;
      height[i] = 0;
    } else {
      const elev = e - sea;
      const moist = fbm3(cn, x * 2.4, y * 2.4, z * 2.4, 4) + (1 - lat) * 0.08;
      const temp = 1 - Math.pow(lat, 1.35) * 1.3 - elev * 1.1 + cn(x * 5, y * 5, z * 5) * 0.08;
      c = mix3(grass, forest, smoothstep(0.02, 0.2, moist));
      c = mix3(c, savanna, smoothstep(0.05, -0.08, moist) * smoothstep(0.4, 0.6, temp));
      c = mix3(c, desert, smoothstep(-0.06, -0.2, moist) * smoothstep(0.5, 0.7, temp));
      c = mix3(c, tundra, smoothstep(0.38, 0.22, temp));
      c = mix3(c, rock, smoothstep(0.12, 0.25, elev));
      c = mix3(c, snow, smoothstep(0.08, -0.02, temp));
      rough = 0.88;
      height[i] = elev;
      const city = smoothstep(0.38, 0.75, ln(x * 60, y * 60, z * 60) * 0.55 + ln(x * 13, y * 13, z * 13) * 0.45);
      glow = city * smoothstep(0.25, 0.45, temp) * smoothstep(0.98, 0.7, temp) * smoothstep(-0.25, -0.05, moist) * smoothstep(0.12, 0.02, elev);
    }
    const ice = smoothstep(0.86, 0.9, lat + n(x * 9, y * 9, z * 9) * 0.04);
    c = mix3(c, snow, ice);
    color.set([c[0] * 255, c[1] * 255, c[2] * 255, 255], i * 4);
    lights.set([255 * glow, 190 * glow, 110 * glow, 255], i * 4);
    surface.set([0, lerp(rough, 0.6, ice) * 255, 0, 255], i * 4);
  });
  let hi = 0;
  for (const v of height) hi = Math.max(hi, v);
  for (let i = 0; i < w * h; i++) surface[i * 4] = (height[i] / (hi || 1)) * 255;

  const cw = w / 2, ch = h / 2, clouds = new Uint8Array(cw * ch * 4), k = noise3(seed + 23);
  eachTexel(cw, ch, (i, x, y, z) => {
    const q = fbm3(k, x * 2.5, y * 2.5, z * 2.5, 2) * 0.6;
    const band = 0.1 * Math.cos(y * 7.5);
    const wisps = fbm3(k, x * 3.2 + q, y * 4.8 + q, z * 3.2 - q, 6) + band;
    const v = smoothstep(0.1, 0.55, wisps) * (0.55 + 0.45 * smoothstep(0.2, 0.6, wisps));
    clouds.set([255, 255, 255, v * 235], i * 4);
  });
  return {color: texture(color, w, h, true), surface: texture(surface, w, h, false), lights: texture(lights, w, h, true), clouds: texture(clouds, cw, ch, true)};
}

function gasGiant(seed: number, w: number, h: number): PlanetMaps {
  const n = noise3(seed);
  const palette: Vec3[] = [[0.92, 0.85, 0.72], [0.78, 0.6, 0.43], [0.62, 0.38, 0.25], [0.95, 0.92, 0.86], [0.7, 0.52, 0.38]];
  const height = new Float32Array(w * h);
  const cols: Vec3[] = [];
  eachTexel(w, h, (i, x, y, z) => {
    let b = y * 7 + fbm3(n, x * 1.5, y * 9, z * 1.5, 5) * 0.9;
    const sx = x - 0.62, sy = y + 0.32, sz = z - 0.72;
    const storm = Math.exp(-(sx * sx * 9 + sy * sy * 60 + sz * sz * 9));
    b += storm * Math.sin(Math.atan2(sz, sx) * 2) * 1.2;
    const t = ((b % palette.length) + palette.length) % palette.length;
    const a = Math.floor(t), f = t - a;
    let c = mix3(palette[a], palette[(a + 1) % palette.length], smoothstep(0, 1, f));
    c = mix3(c, [0.75, 0.3, 0.18], storm * 0.8);
    cols[i] = c;
    height[i] = 0;
  });
  return pack(w, h, (i) => cols[i], height, () => 0.95);
}

function ice(seed: number, w: number, h: number): PlanetMaps {
  const n = noise3(seed), n2 = noise3(seed + 9);
  const height = new Float32Array(w * h), crack = new Float32Array(w * h), tint = new Float32Array(w * h);
  eachTexel(w, h, (i, x, y, z) => {
    crack[i] = smoothstep(0.78, 0.95, ridged3(n, x * 3.5, y * 3.5, z * 3.5, 5));
    tint[i] = fbm3(n2, x * 2, y * 2, z * 2, 4);
    height[i] = -crack[i] * 0.04 + tint[i] * 0.02;
  });
  return pack(w, h, (i) => mix3(mix3([0.86, 0.93, 0.98], [0.7, 0.84, 0.95], smoothstep(-0.3, 0.4, tint[i])), [0.45, 0.32, 0.26], crack[i] * 0.85), height, () => 0.4);
}

function lava(seed: number, w: number, h: number): PlanetMaps {
  const n = noise3(seed), n2 = noise3(seed + 4);
  const height = new Float32Array(w * h), crack = new Float32Array(w * h), tone = new Float32Array(w * h);
  eachTexel(w, h, (i, x, y, z) => {
    crack[i] = smoothstep(0.8, 0.96, ridged3(n, x * 2.8, y * 2.8, z * 2.8, 5));
    tone[i] = fbm3(n2, x * 3, y * 3, z * 3, 5);
    height[i] = tone[i] * 0.05 - crack[i] * 0.05;
  });
  const maps = pack(w, h, (i) => mix3([0.07, 0.055, 0.05], [0.16, 0.12, 0.1], smoothstep(-0.3, 0.4, tone[i])), height, () => 0.8);
  const glow = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) glow.set([255 * crack[i], 95 * crack[i], 20 * crack[i], 255], i * 4);
  return {...maps, lights: texture(glow, w, h, true)};
}

const makers: Record<PlanetKind, (seed: number, w: number, h: number) => PlanetMaps> = {earth, moon, mars, 'gas-giant': gasGiant, ice, lava};
const cache = new Map<string, PlanetMaps>();

/** Procedural planet textures, generated once per render process and reused by every shot. */
export function planetMaps(kind: PlanetKind, seed: number, detail: 'hero' | 'small'): PlanetMaps {
  const key = `${kind}:${seed}:${detail}`;
  let maps = cache.get(key);
  if (!maps) {
    const w = detail === 'hero' && (kind === 'earth' || kind === 'moon') ? 2048 : 1024;
    cache.set(key, maps = makers[kind](seed, w, w / 2));
  }
  return maps;
}

/** Milky Way band, dust lanes, faint nebulae and a dense field of tiny stars, as an equirectangular sky. */
export function starrySky(seed: number, tint: string): DataTexture {
  const key = `sky:${seed}:${tint}`;
  const hit = cache.get(key);
  if (hit) return hit.color;
  const w = 2048, h = 1024, data = new Uint8Array(w * h * 4);
  const n = noise3(seed + 41), random = rng(seed + 43);
  const tc = parseInt(tint.slice(1), 16), tr = (tc >> 16 & 255) / 255, tg = (tc >> 8 & 255) / 255, tb = (tc & 255) / 255;
  const g: Vec3 = [0.32, 0.86, 0.4], gl = Math.hypot(...g);
  for (let j = 0; j < h; j++) {
    const lat = ((j + 0.5) / h - 0.5) * Math.PI, cl = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const phi = ((i + 0.5) / w - 0.5) * Math.PI * 2;
      const x = Math.cos(phi) * cl, z = Math.sin(phi) * cl;
      const dg = (x * g[0] + y * g[1] + z * g[2]) / gl;
      const band = Math.exp(-(dg * dg) / 0.02);
      const clouds = fbm3(n, x * 3, y * 3, z * 3, 5);
      const lanes = smoothstep(0.05, 0.4, fbm3(n, x * 7 + 4, y * 7, z * 7, 4));
      const core = Math.exp(-Math.max(0, 1 - (x * 0.8 + z * 0.6)) * 3);
      const glow = band * (0.35 + 0.65 * smoothstep(-0.3, 0.5, clouds)) * (1 - lanes * 0.75) * (0.5 + core);
      const neb = smoothstep(0.25, 0.7, fbm3(n, x * 1.6 - 9, y * 1.6, z * 1.6, 5)) * 0.35;
      const o = (j * w + i) * 4;
      data[o] = clamp(glow * 0.36 + neb * tr * 0.5 + 0.004) * 255;
      data[o + 1] = clamp(glow * 0.33 + neb * tg * 0.45 + 0.006) * 255;
      data[o + 2] = clamp(glow * 0.4 + neb * tb * 0.6 + 0.014) * 255;
      data[o + 3] = 255;
    }
  }
  for (let k = 0; k < 26000; k++) {
    const i = Math.floor(random() * w), j = Math.floor(random() * h), o = (j * w + i) * 4;
    const b = Math.pow(random(), 3) * 130 + 14;
    data[o] = Math.min(255, data[o] + b);
    data[o + 1] = Math.min(255, data[o + 1] + b * 0.97);
    data[o + 2] = Math.min(255, data[o + 2] + b * (0.9 + random() * 0.2));
  }
  const t = texture(data, w, h, true);
  t.flipY = false;
  cache.set(key, {color: t, surface: t});
  return t;
}
