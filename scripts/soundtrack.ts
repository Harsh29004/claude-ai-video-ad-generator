/**
 * Procedural score + sound design for a storyboard. Offline, deterministic, royalty-free.
 *
 *   npm run soundtrack -- --props examples/launch-reel.json --write
 *
 * Writes <name>-music and <name>-sfx (WAV, or MP3 with --mp3) into public/assets/ (or --dir) and, with --write,
 * adds them to the storyboard's `audio` list: music is ducked under voiceovers, sfx is not. Whooshes land on every
 * transition, a riser builds into the final scene, and impacts hit on titles.
 */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {basename, extname, join, relative, resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {applyVoiceDurations, durationOf, projectSchema, timeline, transitionFrames, type Project} from '../src/project';

const SR = 48000;

type Style = 'ambient' | 'epic' | 'tech' | 'warm';
const STYLES: Record<Style, {bpm: number; root: number; chords: number[][]; pad: number; arp: number; kick: number; hat: number; bright: number}> = {
  ambient: {bpm: 68, root: 50, chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-5, -1, 2, 7]], pad: 1, arp: 0.25, kick: 0, hat: 0, bright: 0.8},
  epic: {bpm: 76, root: 48, chords: [[0, 3, 7, 12], [-4, 0, 3, 8], [-9, -5, -2, 3], [-5, -1, 2, 7]], pad: 1, arp: 0, kick: 0.9, hat: 0, bright: 1},
  tech: {bpm: 112, root: 45, chords: [[0, 3, 7, 10], [-2, 2, 5, 9], [-4, 0, 3, 7], [-5, -2, 2, 5]], pad: 0.6, arp: 1, kick: 1, hat: 0.8, bright: 1.25},
  warm: {bpm: 92, root: 53, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]], pad: 0.8, arp: 0.7, kick: 0.55, hat: 0.35, bright: 1.1},
};

function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

class Bus {
  L: Float32Array;
  R: Float32Array;
  constructor(public n: number) {
    this.L = new Float32Array(n);
    this.R = new Float32Array(n);
  }
  add(i: number, v: number, pan = 0) {
    if (i < 0 || i >= this.n) return;
    this.L[i] += v * Math.cos((pan + 1) * Math.PI / 4);
    this.R[i] += v * Math.sin((pan + 1) * Math.PI / 4);
  }
}

/** Sustained chord pads: detuned saws through a slowly breathing low-pass, crossfaded chord to chord. */
function pads(bus: Bus, s: typeof STYLES[Style], level: number, random: () => number) {
  const bar = (60 / s.bpm) * 4 * SR;
  const fade = 1.4 * SR;
  for (let c = 0; c * bar < bus.n; c++) {
    const chord = s.chords[c % s.chords.length];
    const start = Math.floor(c * bar - fade / 2), end = Math.floor((c + 1) * bar + fade / 2);
    chord.forEach((step, v) => {
      const f = hz(s.root + step + (v === 0 ? 0 : 12));
      const pan = (v / (chord.length - 1)) * 1.2 - 0.6;
      const detune = [0, 0.0045, -0.0052];
      const phases = detune.map(() => random());
      let lp = 0;
      for (let i = Math.max(0, start); i < Math.min(bus.n, end); i++) {
        const t = i / SR;
        let x = 0;
        detune.forEach((d, k) => {
          phases[k] += (f * (1 + d)) / SR;
          phases[k] -= Math.floor(phases[k]);
          x += 2 * phases[k] - 1;
        });
        const cutoff = (700 + 650 * Math.sin(t * 0.21 + v) + 500 * s.bright) / SR;
        lp += (x / 3 - lp) * Math.min(1, cutoff * 2 * Math.PI);
        const env = Math.min(1, (i - start) / fade, (end - i) / fade);
        bus.add(i, lp * env * level * 0.16, pan);
      }
    });
    // Sub bass under each chord.
    const root = hz(s.root + chord[0] - 12);
    for (let i = Math.max(0, start); i < Math.min(bus.n, end); i++) {
      const env = Math.min(1, (i - start) / fade, (end - i) / fade);
      bus.add(i, Math.sin(2 * Math.PI * root * i / SR) * env * level * 0.2, 0);
    }
  }
}

/** Plucked arpeggio on 8th notes with a ping-pong echo. */
function arp(bus: Bus, s: typeof STYLES[Style], level: number) {
  if (level <= 0) return;
  const beat = (60 / s.bpm) * SR, step = beat / 2, bar = beat * 4;
  const dry = new Bus(bus.n);
  for (let k = 0; k * step < bus.n; k++) {
    const chord = s.chords[Math.floor((k * step) / bar) % s.chords.length];
    const order = [0, 1, 2, 3, 2, 1, 3, 2];
    const note = s.root + 12 + chord[order[k % order.length] % chord.length] + (k % 16 >= 8 ? 12 : 0);
    const f = hz(note), start = Math.floor(k * step), len = Math.floor(0.45 * SR);
    let lp = 0;
    for (let i = 0; i < len && start + i < bus.n; i++) {
      const tri = 2 * Math.abs(2 * ((f * i / SR) % 1) - 1) - 1;
      lp += (tri - lp) * 0.35;
      dry.add(start + i, lp * Math.exp(-i / (0.11 * SR)) * level * 0.12, k % 2 ? 0.35 : -0.35);
    }
  }
  const d = Math.floor(beat * 0.75);
  for (let i = 0; i < bus.n; i++) {
    const l = dry.L[i] + (i >= d ? dry.R[i - d] * 0.38 : 0);
    const r = dry.R[i] + (i >= d ? dry.L[i - d] * 0.38 : 0);
    dry.L[i] = l;
    dry.R[i] = r;
    bus.L[i] += l;
    bus.R[i] += r;
  }
}

function drums(bus: Bus, s: typeof STYLES[Style], random: () => number, from: number) {
  const beat = (60 / s.bpm) * SR;
  const every = s.kick >= 0.9 && s.bpm < 90 ? 2 : 1;
  for (let k = 0; k * beat < bus.n; k++) {
    const at = Math.floor(k * beat);
    if (at < from) continue;
    if (s.kick > 0 && k % every === 0) {
      let ph = 0;
      for (let i = 0; i < 0.45 * SR && at + i < bus.n; i++) {
        const f = 45 + 85 * Math.exp(-i / (0.035 * SR));
        ph += f / SR;
        bus.add(at + i, Math.sin(2 * Math.PI * ph) * Math.exp(-i / (0.16 * SR)) * s.kick * 0.5, 0);
      }
    }
    if (s.hat > 0) {
      const off = at + Math.floor(beat / 2);
      let prev = 0;
      for (let i = 0; i < 0.05 * SR && off + i < bus.n; i++) {
        const w = random() * 2 - 1, hp = w - prev;
        prev = w;
        bus.add(off + i, hp * Math.exp(-i / (0.012 * SR)) * s.hat * 0.09, 0.25);
      }
    }
  }
}

/** Freeverb-style room: 4 combs + 2 allpasses per side. */
function reverb(bus: Bus, wet: number) {
  const combs = [1557, 1617, 1491, 1422], alls = [556, 441];
  const side = (input: Float32Array, spread: number) => {
    const out = new Float32Array(input.length);
    for (const len of combs.map((c) => c + spread)) {
      const buf = new Float32Array(len);
      let idx = 0, store = 0;
      for (let i = 0; i < input.length; i++) {
        const y = buf[idx];
        store = y * 0.8 + store * 0.2;
        buf[idx] = input[i] * 0.03 + store * 0.84;
        idx = (idx + 1) % len;
        out[i] += y;
      }
    }
    for (const len of alls.map((a) => a + spread)) {
      const buf = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < out.length; i++) {
        const b = buf[idx];
        buf[idx] = out[i] + b * 0.5;
        out[i] = b - out[i];
        idx = (idx + 1) % len;
      }
    }
    return out;
  };
  const l = side(bus.L, 0), r = side(bus.R, 23);
  for (let i = 0; i < bus.n; i++) {
    bus.L[i] += l[i] * wet;
    bus.R[i] += r[i] * wet;
  }
}

/** Band-passed noise swept up then down around `at`, panned across: the classic transition whoosh. */
function whoosh(bus: Bus, at: number, len: number, level: number, random: () => number, dir: number) {
  const start = Math.floor(at - len * 0.6);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < len; i++) {
    const p = i / len;
    const f = 250 + 3800 * Math.sin(Math.PI * Math.min(1, p * 1.15)) ** 2;
    // RBJ band-pass (0 dB peak), direct form I, with the centre frequency swept per sample.
    const w0 = 2 * Math.PI * f / SR, q = 1.6, alpha = Math.sin(w0) / (2 * q), a0 = 1 + alpha;
    const x = random() * 2 - 1;
    const y = (alpha * x - alpha * x2 + 2 * Math.cos(w0) * y1 - (1 - alpha) * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    const env = Math.pow(Math.sin(Math.PI * p), 1.5) * (p < 0.6 ? p / 0.6 : 1);
    bus.add(start + i, y * env * level, dir * (p * 2 - 1) * 0.8);
  }
}

function riser(bus: Bus, end: number, seconds: number, level: number, random: () => number) {
  const len = Math.floor(seconds * SR), start = end - len;
  let ph = 0, lp = 0;
  for (let i = 0; i < len; i++) {
    const p = i / len, f = 180 * Math.pow(8, p);
    ph += f / SR;
    lp += ((random() * 2 - 1) - lp) * (0.02 + 0.5 * p);
    const v = (Math.sin(2 * Math.PI * ph) * 0.35 + lp * 0.8) * Math.pow(p, 2.2) * level;
    bus.add(start + i, v, Math.sin(p * 9) * 0.3);
  }
}

function impact(bus: Bus, at: number, level: number, random: () => number) {
  let ph = 0;
  for (let i = 0; i < 2.2 * SR; i++) {
    const f = 38 + 70 * Math.exp(-i / (0.05 * SR));
    ph += f / SR;
    const body = Math.sin(2 * Math.PI * ph) * Math.exp(-i / (0.55 * SR));
    const crack = (random() * 2 - 1) * Math.exp(-i / (0.02 * SR)) * 0.6;
    bus.add(at + i, (body + crack) * level, 0);
  }
}

function finish(bus: Bus, targetRms: number, fadeIn: number, fadeOut: number) {
  let sum = 0;
  for (let i = 0; i < bus.n; i++) sum += bus.L[i] ** 2 + bus.R[i] ** 2;
  const rms = Math.sqrt(sum / (bus.n * 2)) || 1;
  const gain = targetRms / rms;
  for (let i = 0; i < bus.n; i++) {
    const env = Math.min(1, i / fadeIn, (bus.n - i) / fadeOut);
    bus.L[i] = Math.tanh(bus.L[i] * gain * env * 1.1) / 1.1;
    bus.R[i] = Math.tanh(bus.R[i] * gain * env * 1.1) / 1.1;
  }
}

function wav(bus: Bus): Buffer {
  const data = Buffer.alloc(bus.n * 4);
  for (let i = 0; i < bus.n; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, bus.L[i])) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, bus.R[i])) * 32767), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

function pickStyle(project: Project): Style {
  const worlds = new Set(project.scenes.flatMap((s) => s.type === 'cinematic' ? [s.world] : []));
  if (worlds.has('city') || worlds.has('abstract')) return 'tech';
  if (worlds.has('terrain')) return 'epic';
  if (worlds.has('space')) return 'ambient';
  return 'warm';
}

function probeFrames(file: string, fps: number): number {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim();
  return Math.ceil(parseFloat(out) * fps);
}

function main() {
  const {values} = parseArgs({options: {
    props: {type: 'string'}, style: {type: 'string', default: 'auto'}, name: {type: 'string'}, dir: {type: 'string', default: 'public/assets'},
    seed: {type: 'string', default: '1'}, write: {type: 'boolean', default: false}, mp3: {type: 'boolean', default: false},
    music: {type: 'string'}, sfx: {type: 'string', default: '0.7'},
  }});
  if (!values.props) throw new Error('Usage: npm run soundtrack -- --props path/to/storyboard.json [--style ambient|epic|tech|warm] [--write] [--mp3]');
  const propsPath = resolve(values.props);
  const raw = JSON.parse(readFileSync(propsPath, 'utf8'));
  let project = projectSchema.parse(raw.project);
  const measured: Record<string, number> = {};
  for (const scene of project.scenes) {
    if (scene.voiceover && scene.voiceover.durationInFrames === undefined) {
      const file = join('public', scene.voiceover.src);
      if (existsSync(file)) measured[scene.id] = probeFrames(file, project.fps);
    }
  }
  project = applyVoiceDurations(project, measured);

  const style = (values.style === 'auto' ? pickStyle(project) : values.style) as Style;
  if (!STYLES[style]) throw new Error(`Unknown style ${style}`);
  const s = STYLES[style];
  const seconds = durationOf(project) / project.fps;
  const n = Math.ceil((seconds + 0.25) * SR);
  const random = rng(Number(values.seed));
  const frameToSample = (f: number) => Math.floor((f / project.fps) * SR);

  // Without narration the music carries the video, so it is mastered louder.
  const hasVoice = project.scenes.some((sc) => sc.voiceover) || project.audio.some((a) => a.role === 'voice');
  const music = new Bus(n);
  pads(music, s, s.pad, random);
  arp(music, s, s.arp);
  drums(music, s, random, Math.floor(SR * (60 / s.bpm) * 8));
  reverb(music, style === 'tech' ? 0.22 : 0.38);
  finish(music, hasVoice ? 0.11 : 0.2, SR * 1.2, SR * 2.2);

  const sfx = new Bus(n);
  const entries = timeline(project.scenes);
  entries.forEach(({from, scene}, index) => {
    if (index === 0) return;
    const overlap = transitionFrames(scene, index);
    const cut = frameToSample(from + overlap / 2);
    const len = Math.max(0.5, (overlap || 10) / project.fps + 0.35) * SR;
    whoosh(sfx, cut, Math.floor(len), 0.55, random, index % 2 ? 1 : -1);
  });
  const last = entries[entries.length - 1];
  if (entries.length > 1) {
    const at = frameToSample(last.from + transitionFrames(last.scene, entries.length - 1) / 2);
    riser(sfx, at, 1.6, 0.35, random);
    impact(sfx, at, 0.8, random);
  }
  impact(sfx, frameToSample(6), 0.5, random);
  reverb(sfx, 0.3);
  finish(sfx, 0.07, 64, SR * 0.8);

  const name = values.name ?? basename(propsPath, extname(propsPath));
  mkdirSync(values.dir, {recursive: true});
  const written: string[] = [];
  for (const [label, bus] of [['music', music], ['sfx', sfx]] as const) {
    const wavPath = join(values.dir, `${name}-${label}.wav`);
    writeFileSync(wavPath, wav(bus));
    let out = wavPath;
    if (values.mp3) {
      out = wavPath.replace(/\.wav$/, '.mp3');
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', '192k', out]);
    }
    written.push(out);
  }
  const srcs = written.map((p) => relative('public', p).split('\\').join('/'));
  console.log(`style: ${style}, ${seconds.toFixed(1)} s`);
  srcs.forEach((src) => console.log(`wrote public/${src}`));

  if (values.write) {
    const audio = (raw.project.audio ?? []).filter((a: {src: string}) => !srcs.includes(a.src));
    audio.push({src: srcs[0], role: 'music', volume: Number(values.music ?? (hasVoice ? 0.55 : 0.9))}, {src: srcs[1], role: 'sfx', volume: Number(values.sfx)});
    raw.project.audio = audio;
    writeFileSync(propsPath, `${JSON.stringify(raw, null, 2)}\n`);
    console.log(`added music + sfx to ${relative(process.cwd(), propsPath)}`);
  }
}

main();
