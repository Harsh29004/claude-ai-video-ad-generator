import {Audio} from '@remotion/media';
import type {ReactNode} from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import narration from './moonNarration.json';

const fps = 30;
const beats = [
  {from: 0, seconds: 6, label: 'THE QUESTION'},
  {from: 6, seconds: 8, label: 'THE LIGHT'},
  {from: 14, seconds: 9, label: 'THE ORBIT'},
  {from: 23, seconds: 7, label: 'THE TAKEAWAY'},
] as const;

export const moonPhasesMetadata = {width: 1920, height: 1080, fps, durationInFrames: 30 * fps};

const gold = '#ffca83';
const ice = '#b4e7ff';
const phaseLabels = ['New', 'First quarter', 'Full', 'Third quarter'] as const;
const craters = Array.from({length: 150}, (_, i) => ({
  x: Math.cos(i * 2.39996) * Math.sqrt((i + 0.5) / 150) * 94,
  y: Math.sin(i * 2.39996) * Math.sqrt((i + 0.5) / 150) * 94,
  r: 1.2 + ((i * 71) % 139) / 22,
}));

function Moon({id, phase, size}: {id: string; phase: number; size: number}) {
  const fraction = phase % 1;
  const curve = Math.cos(2 * Math.PI * fraction);
  const lit = `M0 -100 A100 100 0 0 1 0 100 A${Math.abs(curve) * 100} 100 0 0 ${curve < 0 ? 1 : 0} 0 -100Z`;
  return <svg width={size} height={size} viewBox="-110 -110 220 220" aria-label="Moon illumination">
    <defs>
      <radialGradient id={`${id}-tone`} cx="35%" cy="28%" r="73%">
        <stop stopColor="#fff6e4" /><stop offset="0.78" stopColor="#b6b9b5" /><stop offset="1" stopColor="#6e7c89" />
      </radialGradient>
      <clipPath id={`${id}-lit`}><path d={lit} transform={fraction > 0.5 ? 'scale(-1 1)' : undefined} /></clipPath>
    </defs>
    <circle r="100" fill="#152239" stroke="#627d9a" strokeWidth="1.5" />
    {craters.map(({x, y, r}, i) => <circle key={i} cx={x} cy={y} r={r} fill={i % 3 ? '#0a1628' : '#29354f'} opacity=".36" />)}
    <g clipPath={`url(#${id}-lit)`}>
      <circle r="100" fill={`url(#${id}-tone)`} />
      <path d="M-65 -28Q-44 -76 -6 -64T16 -26T-23 5T-65 -28M18 30Q60 5 72 35T41 69T18 30" fill="#72818c" opacity=".35" />
      {craters.map(({x, y, r}, i) => <circle key={i} cx={x} cy={y} r={r} fill={i % 3 ? '#465665' : '#fff7e1'} opacity={i % 5 === 0 ? '.29' : '.15'} />)}
    </g>
  </svg>;
}

function Backdrop() {
  return <AbsoluteFill style={{background: 'radial-gradient(ellipse at 70% 44%, #162a49 0%, #0b152b 51%, #050913 100%)'}}>
    <svg width="100%" height="100%" viewBox="0 0 1920 1080" aria-hidden>
      {Array.from({length: 100}, (_, i) => <circle key={i} cx={(i * 193 + 51) % 1920} cy={(i * i * 73 + 19) % 1080} r={i % 8 === 0 ? 2.1 : 1} opacity={0.13 + (i % 6) * 0.085} fill={i % 3 === 0 ? ice : '#ffffff'} />)}
    </svg>
  </AbsoluteFill>;
}

function Orbit({phase}: {phase: number}) {
  const angle = phase * 2 * Math.PI;
  const x = 590 - Math.cos(angle) * 278;
  const y = 290 + Math.sin(angle) * 182;
  return <svg width="950" height="565" viewBox="0 0 1000 565" aria-label="Orbital diagram, not to scale">
    <defs>
      <radialGradient id="orbit-sun"><stop stopColor="#fff1b1" /><stop offset=".75" stopColor="#ffbf64" /><stop offset="1" stopColor="#da6a42" /></radialGradient>
      <linearGradient id="orbit-earth"><stop stopColor="#a9e9ff" /><stop offset=".48" stopColor="#3b87bf" /><stop offset="1" stopColor="#101e37" /></linearGradient>
      <clipPath id="orbit-globe"><circle cx="590" cy="290" r="48" /></clipPath>
      <marker id="ray-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill={gold} /></marker>
    </defs>
    <ellipse cx="590" cy="290" rx="278" ry="182" fill="none" stroke="#7790aa" strokeWidth="2" strokeDasharray="7 10" />
    {[182, 234, 346, 398].map((row) => <path key={row} d={`M165 ${row}H925`} stroke={gold} strokeWidth="2" opacity=".34" markerEnd="url(#ray-arrow)" />)}
    <circle cx="94" cy="290" r="64" fill="#f28b53" opacity=".2" />
    <circle cx="94" cy="290" r="51" fill="url(#orbit-sun)" />
    <circle cx="590" cy="290" r="48" fill="url(#orbit-earth)" />
    <path clipPath="url(#orbit-globe)" d="M543 273L555 253L573 253L586 267L571 277L567 310L553 300ZM574 316L590 307L605 320L598 336L586 342Z" fill="#83c99b" opacity=".75" />
    {[0, 0.25, 0.5, 0.75].map((p) => <circle key={p} cx={590 - Math.cos(p * Math.PI * 2) * 278} cy={290 + Math.sin(p * Math.PI * 2) * 182} r="6" fill="#8ba6bf" />)}
    <circle cx={x} cy={y} r="30" fill="#0e1b2e" stroke={ice} strokeWidth="2" />
    <path d={`M${x} ${y - 29}A29 29 0 0 0 ${x} ${y + 29}Z`} fill="#f6dfb8" />
    <g fill="#b4c7db" fontSize="21" fontWeight="650" textAnchor="middle">
      <text x="94" y="382">SUN</text><text x="590" y="365">EARTH</text>
    </g>
    <text x="964" y="546" fill="#a1b2c8" textAnchor="end" fontSize="18">Not to scale</text>
  </svg>;
}

function Kicker({children}: {children: ReactNode}) {
  return <div style={{color: gold, fontSize: 23, fontWeight: 700, letterSpacing: 4}}>{children}</div>;
}

function Scene({index}: {index: number}) {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [0, 14], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const heroPhase = interpolate(frame, [0, 149], [0.13, 0.49], {extrapolateRight: 'clamp'});
  const phase = index === 1 ? interpolate(frame, [0, 209], [0.18, 0.25], {extrapolateRight: 'clamp'}) :
    interpolate(frame, [0, 40, 90, 150, 210, 264], [0, 0, 0.25, 0.5, 0.75, 1], {extrapolateRight: 'clamp'});
  const phaseName = phase >= 0.93 || phase < 0.07 ? 'NEW MOON' : phase < 0.19 ? 'WAXING CRESCENT' : phase < 0.31 ? 'FIRST QUARTER' : phase < 0.43 ? 'WAXING GIBBOUS' : phase < 0.57 ? 'FULL MOON' : phase < 0.69 ? 'WANING GIBBOUS' : phase < 0.81 ? 'THIRD QUARTER' : 'WANING CRESCENT';
  const headline = {fontSize: 112, lineHeight: 0.99, fontWeight: 800, letterSpacing: -5};

  return <AbsoluteFill style={{opacity: appear, transform: `translateY(${(1 - appear) * 18}px)`}}>
    {index === 0 && <>
      <div style={{position: 'absolute', left: 132, top: 318, width: 1030}}>
        <Kicker>FIELD NOTES / 01</Kicker>
        <div style={{...headline, fontSize: 133, marginTop: 30}}>Same Moon.<br /><span style={{color: ice}}>Different shape?</span></div>
      </div>
      <div style={{position: 'absolute', top: 216, right: 102, filter: 'drop-shadow(0 0 45px #8fcfff45)'}}><Moon id="cover" size={600} phase={heroPhase} /></div>
    </>}
    {(index === 1 || index === 2) && <>
      <div style={{position: 'absolute', left: 118, top: 190, width: 690}}>
        <Kicker>{index === 1 ? '01 / SUNLIGHT' : '02 / PERSPECTIVE'}</Kicker>
        <div style={{...headline, fontSize: 83, marginTop: 27}}>{index === 1 ? <>Sunlight hits<br />half the Moon.</> : <>The view<br />keeps changing.</>}</div>
        <div style={{marginTop: 32, color: '#c3d4e8', fontSize: 33, lineHeight: 1.28, maxWidth: 560}}>{index === 1 ? 'The arrows show sunlight. The bright side faces the Sun.' : 'The orbit changes how much of that bright side we see from Earth.'}</div>
      </div>
      <div style={{position: 'absolute', right: 82, top: 187, borderRadius: 30, border: '1px solid #516e8b70', background: '#0b1428b0', padding: '14px 24px 8px'}}>
        <Orbit phase={phase} />
      </div>
      <div style={{position: 'absolute', left: 120, top: 647, display: 'flex', gap: 22, alignItems: 'center'}}>
        <Moon id="earth-view" phase={phase} size={148} />
        <div><div style={{color: '#a1b2c8', fontSize: 20, letterSpacing: 2}}>VIEW FROM EARTH</div><div style={{color: ice, fontSize: 28, fontWeight: 750, marginTop: 8}}>{phaseName}</div></div>
      </div>
    </>}
    {index === 3 && <div style={{position: 'absolute', left: 118, right: 118, top: 193, textAlign: 'center'}}>
      <Kicker>03 / THE TAKEAWAY</Kicker>
      <div style={{...headline, marginTop: 22}}>Same Moon. <span style={{color: ice}}>New angle.</span></div>
      <div style={{display: 'flex', justifyContent: 'center', gap: 90, marginTop: 67}}>
        {phaseLabels.map((label, i) => <div key={label} style={{width: 230}}><Moon id={`summary-${i}`} phase={i / 4} size={197} /><div style={{fontSize: 29, marginTop: 14, color: '#d1e2f5'}}>{label}</div></div>)}
      </div>
      <div style={{fontSize: 35, fontWeight: 650, marginTop: 53, color: gold}}>One phase cycle ≈ 29½ days</div>
    </div>}
  </AbsoluteFill>;
}

export function MoonPhases() {
  const frame = useCurrentFrame();
  const active = beats.reduce((current, beat, index) => frame >= beat.from * fps ? index : current, 0);
  const beat = beats[active];
  return <AbsoluteFill style={{fontFamily: '"Segoe UI", Arial, sans-serif', color: '#f3f7ff', background: '#050913'}}>
    <Backdrop />
    <div style={{position: 'absolute', top: 59, left: 118, right: 118, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #6b87a555', paddingBottom: 26, color: '#a7c1db', fontSize: 20, fontWeight: 700, letterSpacing: 3}}>
      <span>SPACE FIELD NOTES</span><span>0{active + 1} / 04 · {beat.label}</span>
    </div>
    {beats.map(({from, seconds}, index) => <Sequence key={from} from={from * fps} durationInFrames={seconds * fps} name={beats[index].label}>
      <Scene index={index} />
      <Audio src={staticFile(`moon-phases/voice-${index + 1}.mp3`)} />
    </Sequence>)}
    <div style={{position: 'absolute', left: 118, right: 118, bottom: 98, textAlign: 'center', fontSize: 32, fontWeight: 600}}>
      <span style={{display: 'inline-block', padding: '13px 22px', borderRadius: 12, background: '#080f1fee', border: '1px solid #829ebb66'}}>{narration[active].caption}</span>
    </div>
    <div style={{position: 'absolute', bottom: 55, left: 118, right: 118, height: 3, background: '#7994b64a'}}><div style={{height: '100%', width: `${(frame + 1) / moonPhasesMetadata.durationInFrames * 100}%`, background: gold}} /></div>
  </AbsoluteFill>;
}