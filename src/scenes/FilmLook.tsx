import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Project} from '../project';

type Look = Project['look'];

const gradeFilter: Record<Look['grade'], string> = {
  'none': 'none',
  'teal-orange': 'contrast(1.08) saturate(1.12)',
  'warm': 'sepia(0.14) saturate(1.1) contrast(1.04)',
  'cool': 'hue-rotate(-6deg) saturate(1.04) contrast(1.05)',
  'mono': 'grayscale(1) contrast(1.15)',
  'vivid': 'saturate(1.28) contrast(1.07)',
};

const gradeWash: Partial<Record<Look['grade'], CSSProperties>> = {
  'teal-orange': {background: 'radial-gradient(ellipse at 50% 55%, #ff9a4a33 0%, transparent 60%), linear-gradient(180deg, #00808022, #00606633)', mixBlendMode: 'soft-light'},
  'warm': {background: '#ffb06622', mixBlendMode: 'soft-light'},
  'cool': {background: '#4fa3ff22', mixBlendMode: 'soft-light'},
};

/** Applies the colour grade to everything inside it. */
export function Graded({look, children}: {look: Look; children: ReactNode}) {
  const wash = gradeWash[look.grade];
  return <AbsoluteFill style={{filter: gradeFilter[look.grade]}}>
    {children}
    {wash && <AbsoluteFill style={{...wash, pointerEvents: 'none'}} />}
  </AbsoluteFill>;
}

/** Grain that changes every frame, a lens vignette and optional 2.39:1 letterbox bars, over the whole video. */
export function FilmLook({look}: {look: Look}) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const bar = look.letterbox ? Math.max(0, (height - width / 2.39) / 2) : 0;
  return <>
    {look.vignette > 0 && <AbsoluteFill style={{pointerEvents: 'none',
      background: `radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,${(0.8 * look.vignette).toFixed(3)}) 100%)`}} />}
    {look.grain > 0 && <AbsoluteFill style={{opacity: look.grain * 0.3, mixBlendMode: 'overlay', pointerEvents: 'none'}}>
      <svg width={width} height={height} aria-hidden>
        <filter id="film-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency={0.82} numOctaves={2} seed={(frame * 7919) % 9973} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={width} height={height} filter="url(#film-grain)" />
      </svg>
    </AbsoluteFill>}
    {bar > 0 && <>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: bar, background: '#000'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: bar, background: '#000'}} />
    </>}
  </>;
}
