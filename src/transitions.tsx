import {linearTiming, type TransitionPresentation, type TransitionPresentationComponentProps, type TransitionTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {slide, type SlideDirection} from '@remotion/transitions/slide';
import {wipe, type WipeDirection} from '@remotion/transitions/wipe';
import type {CSSProperties} from 'react';
import {AbsoluteFill, Easing} from 'remotion';
import type {directions, transitions} from './cinematic/vocab';

type Kind = typeof transitions[number];
type Direction = typeof directions[number];
type Props = TransitionPresentationComponentProps<{direction: Direction}>;

const ease = Easing.inOut(Easing.cubic);

function Flash({children, presentationDirection, presentationProgress: p}: Props) {
  // A soft light burst, not a white frame: both shots over-expose a little toward the cut while a warm glow blooms
  // from the centre, and the incoming shot cross-dissolves in under it. Peak brightness stays well below white.
  const burst = Math.sin(Math.PI * p);
  const glow = <AbsoluteFill style={{mixBlendMode: 'screen', opacity: 0.38 * burst,
    background: 'radial-gradient(ellipse at 50% 50%, #fff4e2 0%, #ffd9a8aa 35%, #ffb47000 75%)'}} />;
  if (presentationDirection === 'exiting') {
    return <AbsoluteFill style={{filter: `brightness(${1 + 0.7 * burst})`}}>{children}{glow}</AbsoluteFill>;
  }
  const fadeIn = Math.min(1, Math.max(0, (p - 0.3) / 0.4));
  return <AbsoluteFill style={{opacity: fadeIn, filter: `brightness(${1 + 0.7 * burst})`}}>{children}{glow}</AbsoluteFill>;
}

function Zoom({children, presentationDirection, presentationProgress: p}: Props) {
  const style: CSSProperties = presentationDirection === 'exiting'
    ? {transform: `scale(${1 + 0.6 * p * p})`, filter: `blur(${14 * p}px)`, opacity: 1 - p}
    : {transform: `scale(${1.35 - 0.35 * Easing.out(Easing.cubic)(p)})`, filter: `blur(${14 * (1 - p)}px)`, opacity: p};
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
}

function Whip({children, presentationDirection, presentationProgress: p, passedProps}: Props) {
  // A fast camera whip-pan with directional blur.
  const sign = passedProps.direction === 'right' || passedProps.direction === 'down' ? -1 : 1;
  const vertical = passedProps.direction === 'up' || passedProps.direction === 'down';
  const offset = presentationDirection === 'exiting' ? -sign * 100 * ease(p) : sign * 100 * (1 - ease(p));
  const blur = 26 * Math.sin(Math.PI * p);
  return <AbsoluteFill style={{transform: vertical ? `translateY(${offset}%)` : `translateX(${offset}%)`, filter: `blur(${blur}px)`}}>{children}</AbsoluteFill>;
}

function Blur({children, presentationDirection, presentationProgress: p}: Props) {
  const amount = presentationDirection === 'exiting' ? p : 1 - p;
  return <AbsoluteFill style={{filter: `blur(${20 * amount}px)`, opacity: presentationDirection === 'exiting' ? 1 : p}}>{children}</AbsoluteFill>;
}

const custom = {flash: Flash, zoom: Zoom, whip: Whip, blur: Blur};

const slideFrom: Record<Direction, SlideDirection> = {left: 'from-right', right: 'from-left', up: 'from-bottom', down: 'from-top'};
const wipeFrom: Record<Direction, WipeDirection> = {left: 'from-right', right: 'from-left', up: 'from-bottom', down: 'from-top'};

export function presentationFor(type: Exclude<Kind, 'cut'>, direction: Direction): TransitionPresentation<Record<string, unknown>> {
  switch (type) {
    case 'fade': return fade() as TransitionPresentation<Record<string, unknown>>;
    case 'slide': return slide({direction: slideFrom[direction]}) as TransitionPresentation<Record<string, unknown>>;
    case 'wipe': return wipe({direction: wipeFrom[direction]}) as TransitionPresentation<Record<string, unknown>>;
    default: return {component: custom[type], props: {direction}} as unknown as TransitionPresentation<Record<string, unknown>>;
  }
}

export function timingFor(durationInFrames: number): TransitionTiming {
  return linearTiming({durationInFrames, easing: ease});
}
