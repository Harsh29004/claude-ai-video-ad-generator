import {clamp, deg, easings, lerp, noise2, type Vec3} from './math';
import type {cameraMoves} from './vocab';

export type CameraMove = typeof cameraMoves[number];

export type CameraSpec = {
  move: CameraMove;
  /** 0 = barely moves, 1 = normal, 2+ = aggressive. */
  intensity: number;
  /** Handheld shake, 0 = locked tripod, 1 = run-and-gun. */
  shake: number;
  /** Full-frame equivalent focal length in mm. */
  lens: number;
  ease: keyof typeof easings;
  /** Multiplies the world's default framing distance. */
  distance: number;
  /** Raises (or lowers, if negative) the camera, in units of the framing distance. */
  height: number;
  /** Rotates the starting viewpoint around the subject, in degrees. */
  angle: number;
};

export type Framing = {
  target: Vec3;
  /** Horizontal distance from camera to target. */
  radius: number;
  /** Camera height above the target. */
  height: number;
  /** Degrees; 0 puts the camera on +z looking toward -z. */
  azimuth: number;
  near: number;
  far: number;
  /** Worlds with a route (a city avenue, a river valley) provide their own fly-through, t in [0, 1]. */
  travel?: (t: number) => {position: Vec3; target: Vec3};
  /** Ground height under (x, z) so the camera never sinks into the floor or terrain. */
  floor?: (x: number, z: number) => number;
};

export type Pose = {position: Vec3; target: Vec3; roll: number};

const add = (a: Vec3, b: Vec3, s = 1): Vec3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

/**
 * Where the camera is at `progress` (0 → 1 across the shot). Pure function of its inputs, so every frame
 * renders identically no matter which render process draws it.
 */
export function cameraPose(spec: CameraSpec, framing: Framing, progress: number, seconds: number, seed: number): Pose {
  const p = easings[spec.ease](progress);
  const I = spec.intensity;
  const R = framing.radius * spec.distance;
  const H = framing.height + spec.height * R;
  let az = framing.azimuth + spec.angle;
  let r = R, h = H, lateral = 0, targetLateral = 0;
  let target: Vec3 = [...framing.target];
  let position: Vec3 | null = null;

  switch (spec.move) {
    case 'push-in': r = R * lerp(1 + 0.32 * I, 1 - 0.22 * I, p); az += 6 * I * p; h = H * lerp(1.06, 0.94, p); break;
    case 'pull-out': r = R * lerp(1 - 0.22 * I, 1 + 0.42 * I, p); az -= 6 * I * p; h = H * lerp(0.94, 1.16, p); break;
    case 'orbit': az += 70 * I * (p - 0.5); break;
    case 'crane-up':
      h = H + R * I * lerp(-0.42, 0.68, p);
      r = R * lerp(1.04, 0.96, p);
      target = add(target, [0, R * 0.07 * I * lerp(-1, 1, p), 0]);
      break;
    case 'crane-down':
      h = H + R * I * lerp(0.68, -0.32, p);
      r = R * lerp(0.96, 1.04, p);
      target = add(target, [0, R * 0.07 * I * lerp(1, -1, p), 0]);
      break;
    case 'fly-by': lateral = R * I * lerp(-1.05, 1.05, p); r = R * 0.92; break;
    case 'truck-left': lateral = R * I * lerp(0.55, -0.55, p); targetLateral = lateral * 0.85; break;
    case 'truck-right': lateral = R * I * lerp(-0.55, 0.55, p); targetLateral = lateral * 0.85; break;
    case 'reveal':
      r = R * lerp(1 - 0.42 * I, 1 + 0.2 * I, p);
      h = H + R * I * lerp(-0.3, 0.3, p);
      az += 36 * I * (p - 0.5);
      break;
    case 'spiral': az += 150 * I * (p - 0.5); r = R * lerp(1 + 0.3 * I, 1 - 0.2 * I, p); h = H + R * I * lerp(0.35, -0.05, p); break;
    case 'drift': az += 5 * I * Math.sin(p * Math.PI); r = R * (1 - 0.05 * I * p); break;
    case 'static': break;
    case 'fly-through': {
      if (framing.travel) {
        // Intensity 1.5+ covers the whole route; lower values travel a shorter stretch of it.
        const route = framing.travel(clamp(p * Math.min(I, 1.5) / 1.5));
        position = route.position;
        target = route.target;
      } else {
        const a = deg(az);
        const back: Vec3 = [Math.sin(a), 0, Math.cos(a)];
        position = add(add(framing.target, back, R * lerp(1 + 0.8 * I, 0.45, p)), [0, H * lerp(1.15, 0.8, p), 0]);
        target = add(framing.target, back, -R * 0.6);
      }
      break;
    }
  }

  if (!position) {
    const a = deg(az);
    const right: Vec3 = [Math.cos(a), 0, -Math.sin(a)];
    position = add(add(target, [Math.sin(a) * r, h, Math.cos(a) * r]), right, lateral);
    target = add(target, right, targetLateral);
  }

  // Handheld feel: two octaves of smooth noise on position and aim, plus a little roll.
  const n = noise2(seed * 7 + 101);
  const amp = spec.shake * Math.max(R, 1) * 0.012;
  const t = seconds;
  position = add(position, [
    n(t * 0.35, 1.3) * amp + n(t * 2.3, 7.1) * amp * 0.18,
    n(t * 0.31, 3.7) * amp * 0.7 + n(t * 2.1, 9.4) * amp * 0.15,
    n(t * 0.27, 5.9) * amp * 0.5,
  ]);
  target = add(target, [n(t * 0.42, 11.2) * amp * 0.4, n(t * 0.38, 13.8) * amp * 0.4, 0]);
  const roll = n(t * 0.22, 17.5) * spec.shake * deg(0.9);

  if (framing.floor) {
    const ground = framing.floor(position[0], position[2]);
    position[1] = Math.max(position[1], ground + 0.35);
  }
  return {position, target, roll};
}
