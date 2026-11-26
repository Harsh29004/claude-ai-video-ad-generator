import {Audio, Video} from '@remotion/media';
import {AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CSSProperties} from 'react';
import {ThreeScene} from './ThreeScene';
import {timeline, videoPropsSchema, type Project, type Scene, type VideoProps} from './project';

const fontFamily = '"Segoe UI", "Noto Sans Devanagari", "Nirmala UI", "Noto Sans", Arial, sans-serif';

function TextScene({scene, project, unit}: {scene: Extract<Scene, {type: 'text'}>; project: Project; unit: number}) {
  const frame = useCurrentFrame();
  const entrance = interpolate(frame + 1, [0, Math.max(1, Math.min(scene.durationInFrames, project.fps * 0.55))], [0, 1], {
    extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  });
  return <AbsoluteFill style={{
    background: `radial-gradient(ellipse at 85% 15%, ${project.accent}27, transparent 58%), ${scene.background ?? project.background}`,
    padding: unit * 0.09, justifyContent: 'center', alignItems: 'center', textAlign: 'center',
  }}>
    <div style={{width: '100%', opacity: entrance, transform: `translateY(${(1 - entrance) * unit * 0.08}px)`}}>
      <div style={{color: project.accent, fontWeight: 650, fontSize: unit * 0.038, overflowWrap: 'anywhere'}}>{project.title}</div>
      <div style={{fontSize: unit * 0.125, fontWeight: 800, lineHeight: 1.13, marginTop: unit * 0.026, overflowWrap: 'anywhere'}}>{scene.headline}</div>
      {scene.body && <div style={{fontSize: unit * 0.047, lineHeight: 1.45, maxWidth: unit * 1.3, margin: `${unit * 0.048}px auto 0`, color: '#e3eaf6', overflowWrap: 'anywhere'}}>{scene.body}</div>}
    </div>
  </AbsoluteFill>;
}

function SceneView({scene, project}: {scene: Scene; project: Project}) {
  const {width, height} = useVideoConfig();
  const unit = Math.min(width, height);
  const mediaStyle: CSSProperties = {width: '100%', height: '100%', objectFit: scene.type === 'video' || scene.type === 'image' ? scene.fit : undefined};

  return <AbsoluteFill style={{overflow: 'hidden'}}>
    {scene.type === 'text' && <TextScene scene={scene} project={project} unit={unit} />}
    {scene.type === 'three' && <ThreeScene scene={scene} project={project} />}
    {scene.type === 'image' && <Img src={staticFile(scene.src)} style={mediaStyle} />}
    {scene.type === 'video' && <Video src={staticFile(scene.src)} style={mediaStyle} volume={scene.volume} muted={scene.volume === 0} />}
    {scene.caption && <div style={{position: 'absolute', bottom: unit * 0.055, left: '6%', right: '6%', display: 'flex', justifyContent: 'center'}}>
      <div style={{textAlign: 'center', background: '#090c15e8', borderRadius: unit * 0.018, padding: `${unit * 0.015}px ${unit * 0.035}px`, fontSize: unit * 0.038, lineHeight: 1.35, overflowWrap: 'anywhere'}}>{scene.caption}</div>
    </div>}
  </AbsoluteFill>;
}

export function UniversalVideo(props: VideoProps) {
  const {project} = videoPropsSchema.parse(props);
  const {durationInFrames} = useVideoConfig();

  return <AbsoluteFill dir={project.direction} style={{backgroundColor: project.background, color: 'white', fontFamily}}>
    {timeline(project.scenes).map(({from, scene}) => <Sequence key={scene.id} name={scene.id} from={from} durationInFrames={scene.durationInFrames}>
      <SceneView scene={scene} project={project} />
    </Sequence>)}
    {project.audio.map((track, index) => <Sequence key={index} name={track.src} layout="none" from={track.startFrame} durationInFrames={track.durationInFrames ?? durationInFrames - track.startFrame}>
      <Audio src={staticFile(track.src)} volume={track.volume} muted={track.volume === 0} />
    </Sequence>)}
  </AbsoluteFill>;
}