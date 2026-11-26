import {z} from 'zod';

const color = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a six-digit hex color');
const text = z.string().trim().min(1);
const asset = z.string().refine((path) => path.split('/').every((part) =>
  !/^[ .]+$/.test(part) && /^[\p{L}\p{M}\p{N}_. -]+$/u.test(part)),
  'Use a relative path under public/, e.g. assets/clip.mp4');
const volume = z.number().min(0).max(1);
const frames = z.number().int().positive();

const common = {
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  durationInFrames: frames,
  caption: text.optional(),
};

const media = {
  src: asset,
  fit: z.enum(['contain', 'cover']).default('cover'),
};

export const sceneSchema = z.discriminatedUnion('type', [
  z.strictObject({...common, type: z.literal('text'), headline: text, body: text.optional(), background: color.optional()}),
  z.strictObject({...common, ...media, type: z.literal('image')}),
  z.strictObject({...common, ...media, type: z.literal('video'), volume: volume.default(1)}),
  z.strictObject({...common, type: z.literal('three'), geometry: z.enum(['orb', 'ring', 'knot']).default('knot'),
    material: z.enum(['metal', 'ceramic']).default('metal'), color: color.optional(),
    headline: text.optional(), rotationSeconds: z.number().min(0.5).max(60).default(5)}),
]);

const dimension = z.number().int().min(64).max(3840).multipleOf(2);

export const projectSchema = z.strictObject({
  version: z.literal(1),
  title: text,
  direction: z.enum(['ltr', 'rtl', 'auto']).default('auto'),
  width: dimension,
  height: dimension,
  fps: z.number().int().min(1).max(60),
  background: color.default('#09101f'),
  accent: color.default('#81e6d9'),
  scenes: z.array(sceneSchema).min(1),
  audio: z.array(z.strictObject({
    src: asset,
    startFrame: z.number().int().nonnegative().default(0),
    durationInFrames: frames.optional(),
    volume: volume.default(1),
  })).default([]),
}).superRefine((project, ctx) => {
  const ids = new Set<string>();
  project.scenes.forEach(({id}, index) => {
    if (ids.has(id)) ctx.addIssue({code: 'custom', path: ['scenes', index, 'id'], message: `Duplicate scene id: ${id}`});
    ids.add(id);
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

export function durationOf(project: {scenes: readonly {durationInFrames: number}[]}): number {
  return project.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0);
}

export function timeline(scenes: Project['scenes']) {
  let from = 0;
  return scenes.map((scene) => {
    const entry = {from, scene};
    from += scene.durationInFrames;
    return entry;
  });
}