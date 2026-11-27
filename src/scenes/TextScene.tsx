import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {rng} from '../cinematic/math';
import {Titles} from '../cinematic/Titles';
import type {Project, Scene} from '../project';

type TextSpec = Extract<Scene, {type: 'text'}>;

/** Slow-moving colour fields: large blurred light blobs drifting on Lissajous paths. */
function Aurora({t, accent, unit}: {t: number; accent: string; unit: number}) {
  const blobs = [[accent, 0.6, 0], ['#7b5cff', 0.5, 2.1], ['#ff6fae', 0.32, 4.2], [accent, 0.3, 5.3]] as const;
  return <AbsoluteFill style={{filter: `blur(${unit * 0.05}px)`}}>
    {blobs.map(([color, alpha, phase], i) => {
      const x = 50 + 32 * Math.sin(t * 0.23 + phase);
      const y = 50 + 26 * Math.cos(t * 0.19 + phase * 1.3);
      const s = 85 + 18 * Math.sin(t * 0.31 + phase);
      return <div key={i} style={{position: 'absolute', left: `${x - s / 2}%`, top: `${y - s / 2}%`, width: `${s}%`, height: `${s}%`,
        borderRadius: '50%', opacity: alpha, mixBlendMode: 'screen', background: `radial-gradient(circle, ${color} 0%, transparent 62%)`}} />;
    })}
  </AbsoluteFill>;
}

/** A glowing perspective floor grid that scrolls toward the viewer. */
function Grid({t, accent}: {t: number; accent: string}) {
  return <AbsoluteFill style={{perspective: 600, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: '-60%', right: '-60%', top: '52%', height: '120%', transformOrigin: '50% 0%', transform: 'rotateX(72deg)',
      backgroundImage: `linear-gradient(${accent}88 2px, transparent 2px), linear-gradient(90deg, ${accent}88 2px, transparent 2px)`,
      backgroundSize: '80px 80px', backgroundPosition: `0 ${(t * 60) % 80}px`,
      maskImage: 'linear-gradient(to bottom, transparent, black 30%)'}} />
    <div style={{position: 'absolute', left: 0, right: 0, top: '38%', height: '20%', background: `radial-gradient(ellipse at 50% 100%, ${accent}66, transparent 70%)`}} />
  </AbsoluteFill>;
}

/** Floating motes so even a pure-type card is never a still frame. */
function Motes({t, seed, unit}: {t: number; seed: number; unit: number}) {
  const random = rng(seed);
  return <AbsoluteFill>
    {Array.from({length: 42}, (_, i) => {
      const x = random() * 100, y0 = random() * 100, speed = 1.5 + random() * 4, size = unit * (0.002 + random() * 0.006), ph = random() * 6.28;
      const y = ((y0 - t * speed) % 100 + 100) % 100;
      return <div key={i} style={{position: 'absolute', left: `${x + Math.sin(t * 0.5 + ph) * 1.5}%`, top: `${y}%`, width: size, height: size,
        borderRadius: '50%', background: '#fff', opacity: 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.7 + ph))}} />;
    })}
  </AbsoluteFill>;
}

export function TextScene({scene, project}: {scene: TextSpec; project: Project}) {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const unit = Math.min(width, height);
  const t = frame / fps;
  const push = interpolate(frame, [0, scene.durationInFrames], [1, 1.07]);
  return <AbsoluteFill style={{background: scene.background ?? project.background, overflow: 'hidden'}}>
    {scene.backdrop === 'aurora' && <Aurora t={t} accent={project.accent} unit={unit} />}
    {scene.backdrop === 'grid' && <Grid t={t} accent={project.accent} />}
    {scene.backdrop !== 'solid' && <Motes t={t} seed={scene.id.length * 97 + 13} unit={unit} />}
    <AbsoluteFill style={{transform: `scale(${push})`}}>
      <Titles kicker={project.title} headline={scene.headline} subhead={scene.body} position="center"
        durationInFrames={scene.durationInFrames} accent={project.accent} />
    </AbsoluteFill>
  </AbsoluteFill>;
}
