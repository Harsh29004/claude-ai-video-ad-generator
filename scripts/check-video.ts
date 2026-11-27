/**
 * Quality gate for a rendered video. Fails (exit code 3) when the result is static or silent:
 *   - any stretch of picture frozen for longer than --max-freeze seconds (film grain is averaged out first)
 *   - no audio stream, or audio quieter than -40 LUFS overall
 * Also reports loudness and long silences.
 *
 *   npm run check -- out/launch-reel.mp4
 */
import {execFileSync, spawnSync} from 'node:child_process';
import {parseArgs} from 'node:util';

function ffmpegLog(args: string[]): string {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args, '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  return `${r.stdout}\n${r.stderr}`;
}

function main() {
  const {values, positionals} = parseArgs({allowPositionals: true, options: {'max-freeze': {type: 'string', default: '1.5'}}});
  const file = positionals[0];
  if (!file) throw new Error('Usage: npm run check -- path/to/video.mp4');
  const maxFreeze = Number(values['max-freeze']);

  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file]).toString());
  const duration = Number(probe.format.duration);
  const video = probe.streams.find((s: {codec_type: string}) => s.codec_type === 'video');
  const hasAudio = probe.streams.some((s: {codec_type: string}) => s.codec_type === 'audio');

  // Downscale with area averaging so per-frame grain cancels out and only real motion counts.
  const freezeLog = ffmpegLog(['-i', file, '-map', '0:v:0', '-vf', `scale=96:-2:flags=area,freezedetect=n=0.004:d=${Math.max(0.3, maxFreeze / 2)}`]);
  const freezes = [...freezeLog.matchAll(/freeze_duration: ([\d.]+)/g)].map((m) => Number(m[1]));
  const openFreeze = /freeze_start: ([\d.]+)/g;
  const starts = [...freezeLog.matchAll(openFreeze)].map((m) => Number(m[1]));
  if (starts.length > freezes.length) freezes.push(duration - starts[starts.length - 1]);
  const longest = freezes.length ? Math.max(...freezes) : 0;

  let lufs = -Infinity, silences: number[] = [];
  if (hasAudio) {
    const audioLog = ffmpegLog(['-i', file, '-map', '0:a:0', '-af', 'silencedetect=n=-45dB:d=2,ebur128=framelog=quiet']);
    const m = audioLog.match(/I:\s+(-?[\d.]+) LUFS/g);
    if (m) lufs = Number(m[m.length - 1].replace(/[^\d.-]/g, ''));
    silences = [...audioLog.matchAll(/silence_duration: ([\d.]+)/g)].map((x) => Number(x[1]));
  }

  // Lighting: average brightness (luma 0-255) of every frame.
  const lumaLog = ffmpegLog(['-i', file, '-map', '0:v:0', '-vf', 'scale=160:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG']);
  const luma = [...lumaLog.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  const fps = luma.length / duration || 30;
  const second = Math.max(1, Math.round(fps));
  const darkStretches: string[] = [];
  for (let i = 0; i + second * 2 <= luma.length; i += second) {
    const avg = luma.slice(i, i + second * 2).reduce((a, b) => a + b, 0) / (second * 2);
    if (avg < 14) darkStretches.push(`${(i / fps).toFixed(0)}s`);
  }
  const flashes = luma.flatMap((v, i) => i > 0 && v - luma[i - 1] > 70 && v > 200 ? [`${(i / fps).toFixed(1)}s`] : []);
  const meanLuma = luma.length ? luma.reduce((a, b) => a + b, 0) / luma.length : 0;

  const problems: string[] = [];
  if (longest > maxFreeze) problems.push(`picture is frozen for ${longest.toFixed(1)} s (limit ${maxFreeze} s): add camera or subject motion`);
  if (!hasAudio) problems.push('no audio track: add a voiceover and/or music');
  else if (lufs < -40) problems.push(`audio is effectively silent (${lufs} LUFS)`);
  const warnings: string[] = [];
  if (hasAudio && lufs > -40 && (lufs < -20 || lufs > -10)) warnings.push(`loudness ${lufs} LUFS; social platforms expect about -14`);
  if (silences.some((s) => s > 3)) warnings.push(`silent gaps of ${silences.filter((s) => s > 3).map((s) => s.toFixed(1)).join(', ')} s`);
  if (darkStretches.length) warnings.push(`too dark to read on a phone around ${darkStretches.join(', ')}: raise "exposure" or pick a brighter mood for those shots`);
  if (flashes.length) warnings.push(`near-white frame jumps at ${flashes.join(', ')}: harsh flash; shorten or soften that transition`);

  console.log(JSON.stringify({file, duration, resolution: video ? `${video.width}x${video.height}` : null, hasAudio, loudnessLufs: lufs,
    longestFreezeSeconds: longest, meanLuma: Math.round(meanLuma), problems, warnings}, null, 2));
  if (problems.length) {
    console.error(`FAIL: ${problems.join('; ')}`);
    process.exit(3);
  }
  console.log('PASS: moving picture and audible sound.');
}

main();
