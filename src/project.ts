import {z} from 'zod';
import {
  cameraMoves, devices, directions, grades, materials, mediaMotions, moods, particleKinds, planets, shapes,
  textBackdrops, titlePositions, transitions, worlds,
} from './cinematic/vocab';

const color = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a six-digit hex color');
const text = z.string().trim().min(1);
const asset = z.string().refine((path) => path.split('/').every((part) =>
  !/^[ .]+$/.test(part) && /^[\p{L}\p{M}\p{N}_. -]+$/u.test(part)),
  'Use a relative path under public/, e.g. assets/clip.mp4');
const volume = z.number().min(0).max(1);
const frames = z.number().int().positive();

/** How this scene enters from the previous one. Transitions overlap the two scenes, so they shorten the video. */
const transition = z.strictObject({
  type: z.enum(transitions).default('fade'),
  durationInFrames: frames.default(15),
  direction: z.enum(directions).default('left'),
});

/** Narration that starts with the scene. The scene is lengthened automatically if the line would be cut off. */
const voiceover = z.strictObject({
  src: asset,
  delayInFrames: z.number().int().nonnegative().default(8),
  volume: volume.default(1),
  /** Measured from the file when omitted. */
  durationInFrames: frames.optional(),
});

const common = {
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  durationInFrames: frames,
  caption: text.optional(),
  transition: transition.optional(),
  voiceover: voiceover.optional(),
};

const titles = {
  headline: text.optional(),
  subhead: text.optional(),
  titlePosition: z.enum(titlePositions).default('center'),
};

const media = {
  src: asset,
  fit: z.enum(['contain', 'cover']).default('cover'),
};

const camera = z.strictObject({
  move: z.enum(cameraMoves).default('push-in'),
  intensity: z.number().min(0).max(3).default(1),
  shake: z.number().min(0).max(1).default(0.15),
  lens: z.number().min(12).max(200).default(35),
  ease: z.enum(['linear', 'smooth', 'cinematic']).default('smooth'),
  distance: z.number().min(0.2).max(10).default(1),
  height: z.number().min(-2).max(4).default(0),
  angle: z.number().min(-360).max(360).default(0),
});

const subject = z.discriminatedUnion('kind', [
  z.strictObject({kind: z.literal('none')}),
  z.strictObject({kind: z.literal('shape'), shape: z.enum(shapes).default('knot'), material: z.enum(materials).default('chrome'), color: color.optional()}),
  z.strictObject({kind: z.literal('text'), text: z.string().trim().min(1).max(32), material: z.enum(materials).default('chrome'), color: color.optional()}),
  z.strictObject({kind: z.literal('device'), device: z.enum(devices).default('phone'), screen: asset.optional(), color: color.optional()}),
  z.strictObject({
    kind: z.literal('model'), src: asset, scale: z.number().positive().max(100).default(1),
    spin: z.boolean().default(true), animation: z.boolean().default(true),
  }),
  z.strictObject({
    kind: z.literal('planet'), planet: z.enum(planets).default('earth'),
    moon: z.boolean().default(false), rings: z.boolean().default(false), orbitPath: z.boolean().default(false),
    /** Sun direction in degrees, start → end. 0 = sun behind the camera (fully lit), 180 = behind the planet. */
    sunAngle: z.tuple([z.number(), z.number()]).default([40, 40]),
    orbitTurns: z.number().min(-4).max(4).default(0.25),
    spin: z.number().min(-10).max(10).default(1),
  }),
]);

export const sceneSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...common, type: z.literal('text'), headline: text, body: text.optional(), background: color.optional(),
    backdrop: z.enum(textBackdrops).default('aurora'),
  }),
  z.strictObject({...common, ...media, type: z.literal('image'), motion: z.enum(mediaMotions).default('zoom-in')}),
  z.strictObject({...common, ...media, type: z.literal('video'), volume: volume.default(1), motion: z.enum(mediaMotions).default('none')}),
  z.strictObject({
    ...common, ...titles, type: z.literal('cinematic'),
    world: z.enum(worlds).default('studio'),
    mood: z.enum(moods).default('auto'),
    subject: subject.default({kind: 'none'}),
    camera: camera.prefault({}),
    particles: z.enum(particleKinds).default('auto'),
    bloom: z.number().min(0).max(4).default(1),
    focus: z.boolean().default(true),
    exposure: z.number().min(0.2).max(3).default(1),
    speed: z.number().min(0).max(5).default(1),
    seed: z.number().int().min(0).max(1_000_000).default(7),
    color: color.optional(),
  }),
  // The original single-object 3D scene. Still accepted; it now renders through the cinematic studio.
  z.strictObject({...common, type: z.literal('three'), geometry: z.enum(['orb', 'ring', 'knot']).default('knot'),
    material: z.enum(['metal', 'ceramic']).default('metal'), color: color.optional(),
    headline: text.optional(), rotationSeconds: z.number().min(0.5).max(60).default(5)}),
]);

const dimension = z.number().int().min(64).max(3840).multipleOf(2);

const look = z.strictObject({
  /** Animated film grain over the whole frame. */
  grain: z.number().min(0).max(1).default(0.35),
  vignette: z.number().min(0).max(1).default(0.3),
  /** 2.39:1 cinema bars. */
  letterbox: z.boolean().default(false),
  grade: z.enum(grades).default('none'),
});

export const projectSchema = z.strictObject({
  version: z.literal(1),
  title: text,
  direction: z.enum(['ltr', 'rtl', 'auto']).default('auto'),
  width: dimension,
  height: dimension,
  fps: z.number().int().min(1).max(60),
  background: color.default('#09101f'),
  accent: color.default('#81e6d9'),
  look: look.prefault({}),
  scenes: z.array(sceneSchema).min(1),
  audio: z.array(z.strictObject({
    src: asset,
    /** Music is ducked under voiceovers; voice and sfx are not. */
    role: z.enum(['music', 'voice', 'sfx']).default('music'),
    startFrame: z.number().int().nonnegative().default(0),
    durationInFrames: frames.optional(),
    volume: volume.default(1),
    loop: z.boolean().default(false),
  })).default([]),
  /** Music volume multiplier while someone is speaking. */
  duckMusic: volume.default(0.3),
}).superRefine((project, ctx) => {
  const ids = new Set<string>();
  project.scenes.forEach(({id}, index) => {
    if (ids.has(id)) ctx.addIssue({code: 'custom', path: ['scenes', index, 'id'], message: `Duplicate scene id: ${id}`});
    ids.add(id);
  });
  project.scenes.forEach((scene, index) => {
    const overlap = transitionFrames(scene, index);
    const previous = project.scenes[index - 1];
    if (overlap > 0 && (overlap >= scene.durationInFrames || overlap >= previous.durationInFrames)) {
      ctx.addIssue({code: 'custom', path: ['scenes', index, 'transition', 'durationInFrames'],
        message: 'A transition must be shorter than both scenes it joins'});
    }
  });
  const total = durationOf(project);
  if (!Number.isSafeInteger(total)) {
    ctx.addIssue({code: 'custom', path: ['scenes'], message: 'Total frame count exceeds safe integer range'});
  }
  project.audio.forEach((track, index) => {
    if (track.startFrame >= total) {
      ctx.addIssue({code: 'custom', path: ['audio', index, 'startFrame'], message: 'Audio must start before the video ends'});
    } else if (track.durationInFrames !== undefined && track.durationInFrames > total - track.startFrame) {
      ctx.addIssue({code: 'custom', path: ['audio', index, 'durationInFrames'], message: 'Audio sequence extends beyond the video'});
    }
  });
});

export const videoPropsSchema = z.strictObject({project: projectSchema});
export type VideoProps = z.input<typeof videoPropsSchema>;
export type Project = z.output<typeof projectSchema>;
export type Scene = Project['scenes'][number];
export type CinematicSpec = Extract<Scene, {type: 'cinematic'}>;

type TimedScene = {durationInFrames: number; transition?: {type: string; durationInFrames: number}};

/** Frames this scene overlaps the previous one by. */
export function transitionFrames(scene: TimedScene, index: number): number {
  if (index === 0 || !scene.transition || scene.transition.type === 'cut') return 0;
  return scene.transition.durationInFrames;
}

/** Start frame of every scene, accounting for transition overlaps. */
export function timeline<S extends TimedScene>(scenes: readonly S[]) {
  let from = 0;
  return scenes.map((scene, index) => {
    from -= transitionFrames(scene, index);
    const entry = {from, scene};
    from += scene.durationInFrames;
    return entry;
  });
}

/**
 * Fills in measured voiceover lengths (frames, keyed by scene id) and lengthens any scene that would cut its line
 * off. Shared by the composition (measures in the browser) and the soundtrack script (measures with ffprobe).
 */
export function applyVoiceDurations(project: Project, measured: Record<string, number>): Project {
  const tail = Math.round(project.fps * 0.35);
  return {...project, scenes: project.scenes.map((scene) => {
    if (!scene.voiceover) return scene;
    const frames = scene.voiceover.durationInFrames ?? measured[scene.id];
    if (frames === undefined) return scene;
    return {...scene, voiceover: {...scene.voiceover, durationInFrames: frames},
      durationInFrames: Math.max(scene.durationInFrames, scene.voiceover.delayInFrames + frames + tail)};
  })};
}

export function durationOf(project: {scenes: readonly TimedScene[]}): number {
  return project.scenes.reduce((sum, scene, index) => sum + scene.durationInFrames - transitionFrames(scene, index), 0);
}
