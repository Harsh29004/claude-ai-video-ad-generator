import type {ReactNode} from 'react';
import type {CinematicSpec} from '../project';
import type {Framing, Pose} from './camera';
import type {ParticleKind} from './Particles';
import type {Lens} from './PostFX';
import type {moods} from './vocab';

export type Mood = Exclude<typeof moods[number], 'auto'>;

export type WorldContext = {
  spec: CinematicSpec;
  mood: Mood;
  accent: string;
  framing: Framing;
  pose: Pose;
  /** Animation time in seconds (video time × the shot's speed). */
  t: number;
  /** 0 → 1 across the shot. */
  progress: number;
};

export type WorldDef = {
  defaultMood: Mood;
  framing: (spec: CinematicSpec, mood: Mood) => Framing;
  lens: (spec: CinematicSpec, mood: Mood) => Lens;
  particles: (spec: CinematicSpec, mood: Mood) => ParticleKind;
  render: (ctx: WorldContext) => ReactNode;
};
