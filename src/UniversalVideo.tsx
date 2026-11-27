import {Audio} from '@remotion/media';
import {TransitionSeries} from '@remotion/transitions';
import type {ReactElement} from 'react';
import {AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {CinematicScene} from './cinematic/CinematicScene';
import {clamp, lerp} from './cinematic/math';
import {timeline, transitionFrames, videoPropsSchema, type CinematicSpec, type Project, type Scene, type VideoProps} from './project';
import {FilmLook, Graded} from './scenes/FilmLook';
import {MediaScene} from './scenes/MediaScene';
import {TextScene} from './scenes/TextScene';
import {presentationFor, timingFor} from './transitions';

const fontFamily = '"Segoe UI", "Noto Sans Devanagari", "Nirmala UI", "Noto Sans", Arial, sans-serif';

/** The original `three` scene (one spinning object) maps onto a cinematic studio shot. */
function fromLegacy(scene: Extract<Scene, {type: 'three'}>): CinematicSpec {
  return {
    id: scene.id, type: 'cinematic', durationInFrames: scene.durationInFrames, caption: scene.caption,
    transition: scene.transition, voiceover: scene.voiceover, headline: scene.headline, titlePosition: 'top',
    world: 'studio', mood: 'auto', subject: {kind: 'shape', shape: scene.geometry, material: scene.material === 'metal' ? 'chrome' : 'ceramic', color: scene.color},
    camera: {move: 'orbit', intensity: Math.min(2, 5 / scene.rotationSeconds), shake: 0.12, lens: 35, ease: 'smooth', distance: 1, height: 0, angle: 0},
    particles: 'auto', bloom: 1, focus: true, exposure: 1, speed: 1, seed: 7, color: scene.color,
  };
}

function Caption({text, durationInFrames}: {text: string; durationInFrames: number}) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const unit = Math.min(width, height);
  const opacity = interpolate(frame, [4, 12, durationInFrames - 8, durationInFrames - 2], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <div style={{position: 'absolute', bottom: unit * (height > width ? 0.12 : 0.06), left: '6%', right: '6%', display: 'flex', justifyContent: 'center', opacity}}>
    <div style={{textAlign: 'center', background: 'rgba(8, 10, 18, 0.72)', borderRadius: unit * 0.016, padding: `${unit * 0.014}px ${unit * 0.032}px`,
      fontSize: unit * 0.036, fontWeight: 600, lineHeight: 1.35, overflowWrap: 'anywhere', boxShadow: '0 8px 30px rgba(0,0,0,0.35)'}}>{text}</div>
  </div>;
}

function SceneView({scene, project}: {scene: Scene; project: Project}) {
  return <AbsoluteFill style={{overflow: 'hidden'}}>
    {scene.type === 'text' && <TextScene scene={scene} project={project} />}
    {scene.type === 'cinematic' && <CinematicScene scene={scene} project={project} />}
    {scene.type === 'three' && <CinematicScene scene={fromLegacy(scene)} project={project} />}
    {(scene.type === 'image' || scene.type === 'video') && <MediaScene scene={scene} />}
    {scene.caption && <Caption text={scene.caption} durationInFrames={scene.durationInFrames} />}
  </AbsoluteFill>;
}

type Span = {from: number; to: number};

/** Music volume multiplier at `frame`: dips under every voice span with short ramps either side. */
function duckAt(frame: number, spans: Span[], duck: number, ramp: number): number {
  let m = 1;
  for (const {from, to} of spans) {
    const k = clamp(Math.min((frame - (from - ramp)) / ramp, (to + ramp - frame) / ramp));
    m = Math.min(m, lerp(1, duck, k));
  }
  return m;
}

export function UniversalVideo(props: VideoProps) {
  const {project} = videoPropsSchema.parse(props);
  const {durationInFrames, fps} = useVideoConfig();
  const entries = timeline(project.scenes);

  const voices = entries.flatMap(({from, scene}) => scene.voiceover ? [{
    from: from + scene.voiceover.delayInFrames,
    duration: scene.voiceover.durationInFrames ?? scene.durationInFrames - scene.voiceover.delayInFrames,
    vo: scene.voiceover, id: scene.id,
  }] : []);
  const spans: Span[] = [
    ...voices.map(({from, duration}) => ({from, to: from + duration})),
    ...project.audio.filter((a) => a.role === 'voice').map((a) => ({from: a.startFrame, to: a.startFrame + (a.durationInFrames ?? durationInFrames - a.startFrame)})),
  ];

  const series: ReactElement[] = [];
  project.scenes.forEach((scene, index) => {
    if (transitionFrames(scene, index) > 0 && scene.transition) {
      series.push(<TransitionSeries.Transition key={`${scene.id}-in`}
        presentation={presentationFor(scene.transition.type as Exclude<typeof scene.transition.type, 'cut'>, scene.transition.direction)}
        timing={timingFor(scene.transition.durationInFrames)} />);
    }
    series.push(<TransitionSeries.Sequence key={scene.id} name={scene.id} durationInFrames={scene.durationInFrames}>
      <SceneView scene={scene} project={project} />
    </TransitionSeries.Sequence>);
  });

  return <AbsoluteFill dir={project.direction} style={{backgroundColor: project.background, color: 'white', fontFamily}}>
    <Graded look={project.look}>
      <TransitionSeries>{series}</TransitionSeries>
    </Graded>
    <FilmLook look={project.look} />
    {voices.map(({from, duration, vo, id}) => <Sequence key={`vo-${id}`} name={`voice: ${id}`} layout="none" from={from}
      durationInFrames={Math.max(1, Math.min(duration, durationInFrames - from))}>
      <Audio src={staticFile(vo.src)} volume={vo.volume} />
    </Sequence>)}
    {project.audio.map((track, index) => <Sequence key={index} name={`${track.role}: ${track.src}`} layout="none" from={track.startFrame}
      durationInFrames={track.durationInFrames ?? durationInFrames - track.startFrame}>
      <Audio src={staticFile(track.src)} loop={track.loop} muted={track.volume === 0}
        volume={(f) => track.volume * (track.role === 'music' ? duckAt(track.startFrame + f, spans, project.duckMusic, Math.round(fps * 0.3)) : 1)} />
    </Sequence>)}
  </AbsoluteFill>;
}
