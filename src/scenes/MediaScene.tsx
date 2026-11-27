import {Video} from '@remotion/media';
import type {CSSProperties} from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import type {Scene} from '../project';

type MediaSpec = Extract<Scene, {type: 'image' | 'video'}>;

/** Ken Burns: a slow zoom or pan across the shot so stills and locked-off clips keep moving. */
function motionTransform(motion: MediaSpec['motion'], p: number): string {
  const e = Easing.inOut(Easing.sin)(p);
  switch (motion) {
    case 'zoom-in': return `scale(${1.02 + 0.14 * e})`;
    case 'zoom-out': return `scale(${1.16 - 0.14 * e})`;
    case 'pan-left': return `scale(1.14) translateX(${4 - 8 * e}%)`;
    case 'pan-right': return `scale(1.14) translateX(${-4 + 8 * e}%)`;
    case 'pan-up': return `scale(1.14) translateY(${4 - 8 * e}%)`;
    case 'pan-down': return `scale(1.14) translateY(${-4 + 8 * e}%)`;
    default: return 'none';
  }
}

export function MediaScene({scene}: {scene: MediaSpec}) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, Math.max(1, scene.durationInFrames - 1)], [0, 1], {extrapolateRight: 'clamp'});
  const transform = motionTransform(scene.motion, p);
  const src = staticFile(scene.src);
  const fill: CSSProperties = {width: '100%', height: '100%', objectFit: 'cover'};
  const main: CSSProperties = {width: '100%', height: '100%', objectFit: scene.fit};

  // With `contain`, fill the empty bands with a blurred, darkened copy rather than flat bars.
  const backdrop = scene.fit === 'contain' && <AbsoluteFill style={{transform: 'scale(1.2)', filter: 'blur(40px) brightness(0.55) saturate(1.2)'}}>
    {scene.type === 'image' ? <Img src={src} style={fill} /> : <Video src={src} style={fill} muted />}
  </AbsoluteFill>;

  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    {backdrop}
    <AbsoluteFill style={{transform}}>
      {scene.type === 'image'
        ? <Img src={src} style={main} />
        : <Video src={src} style={main} volume={scene.volume} muted={scene.volume === 0} />}
    </AbsoluteFill>
  </AbsoluteFill>;
}
