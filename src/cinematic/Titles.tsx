import type {CSSProperties} from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {titlePositions} from './vocab';

type Position = typeof titlePositions[number];

/**
 * Headline that builds word by word (rise + un-blur), with an optional subhead, then lifts away before the cut.
 * Plain HTML on top of the 3D, so every script and font the browser has works (Devanagari, Arabic, CJK...).
 */
export function Titles({headline, subhead, kicker, position, durationInFrames, accent}: {
  headline?: string; subhead?: string; kicker?: string; position: Position; durationInFrames: number; accent: string;
}) {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  if (!headline && !subhead) return null;
  const unit = Math.min(width, height);
  const words = headline ? headline.split(/\s+/) : [];
  const delay = Math.round(fps * 0.35);
  const leave = interpolate(frame, [durationInFrames - Math.round(fps * 0.45), durationInFrames - 2], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const portrait = height > width;
  const size = unit * (position === 'center' ? (portrait ? 0.1 : 0.088) : 0.07);

  const box: CSSProperties = {
    position: 'absolute', left: '7%', right: '7%', display: 'flex', flexDirection: 'column', gap: unit * 0.02,
    alignItems: position === 'lower-third' ? 'flex-start' : 'center', textAlign: position === 'lower-third' ? 'start' : 'center',
    ...(position === 'center' ? {top: 0, bottom: 0, justifyContent: 'center'} : {}),
    ...(position === 'top' ? {top: portrait ? '11%' : '9%'} : {}),
    ...(position === 'bottom' ? {bottom: portrait ? '17%' : '14%'} : {}),
    ...(position === 'lower-third' ? {bottom: portrait ? '19%' : '16%'} : {}),
    opacity: 1 - leave, transform: `translateY(${-leave * unit * 0.03}px)`, filter: `blur(${leave * 6}px)`,
  };

  const subStart = delay + words.length * 3 + 8;
  const sub = spring({frame: frame - subStart, fps, config: {damping: 200}, durationInFrames: 20});

  const kick = spring({frame: frame - Math.round(delay / 2), fps, config: {damping: 200}, durationInFrames: 18});

  return <div style={box}>
    {kicker && <div style={{color: accent, fontWeight: 700, fontSize: unit * 0.032, letterSpacing: '0.18em', textTransform: 'uppercase',
      opacity: kick, transform: `translateY(${(1 - kick) * unit * 0.02}px)`, overflowWrap: 'anywhere'}}>{kicker}</div>}
    {position === 'lower-third' && <div style={{width: unit * 0.08 * spring({frame: frame - delay + 4, fps, config: {damping: 200}}), height: unit * 0.006, background: accent, borderRadius: 99}} />}
    {headline && <div style={{fontSize: size, fontWeight: 800, lineHeight: 1.06, letterSpacing: '-0.02em', overflowWrap: 'anywhere',
      textShadow: '0 4px 28px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.5)'}}>
      {words.map((word, i) => {
        const t = spring({frame: frame - delay - i * 3, fps, config: {damping: 200}, durationInFrames: 22});
        return <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', opacity: t, transform: `translateY(${(1 - t) * 0.45}em)`, filter: `blur(${(1 - t) * 10}px)`}}>
          {word}{i < words.length - 1 ? ' ' : ''}
        </span>;
      })}
    </div>}
    {subhead && <div style={{fontSize: unit * 0.034, fontWeight: 500, lineHeight: 1.35, color: '#e8eef8', maxWidth: unit * 1.25,
      opacity: sub * 0.92, transform: `translateY(${(1 - sub) * unit * 0.015}px)`, textShadow: '0 2px 16px rgba(0,0,0,0.6)'}}>{subhead}</div>}
  </div>;
}
