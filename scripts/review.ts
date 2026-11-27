/**
 * Contact sheet: renders the start, middle and end of every scene into one image to review before a full render.
 *
 *   npm run review -- --props examples/launch-reel.json            → out/launch-reel-sheet.png
 */
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, extname, join, resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {timeline, type Project} from '../src/project';

async function main() {
  const {values} = parseArgs({options: {
    props: {type: 'string'}, out: {type: 'string'}, composition: {type: 'string', default: 'UniversalVideo'},
    points: {type: 'string', default: '0.15,0.5,0.85'}, scale: {type: 'string', default: '0.5'},
  }});
  if (!values.props) throw new Error('Usage: npm run review -- --props path/to/storyboard.json [--out sheet.png]');
  const inputProps = JSON.parse(readFileSync(resolve(values.props), 'utf8'));
  const out = resolve(values.out ?? join('out', `${basename(values.props, extname(values.props))}-sheet.png`));
  const points = values.points.split(',').map(Number);

  console.log('Bundling…');
  const serveUrl = await bundle({entryPoint: resolve('src/index.ts')});
  const chromiumOptions = {gl: 'angle' as const};
  const browser = await openBrowser('chrome', {chromiumOptions});
  const composition = await selectComposition({serveUrl, id: values.composition, inputProps, puppeteerInstance: browser, chromiumOptions});
  const project = (composition.props as {project: Project}).project;
  const frames = timeline(project.scenes).flatMap(({from, scene}) =>
    points.map((p) => Math.min(composition.durationInFrames - 1, from + Math.round(p * (scene.durationInFrames - 1)))));

  const dir = mkdtempSync(join(tmpdir(), 'sheet-'));
  try {
    for (const [i, frame] of frames.entries()) {
      process.stdout.write(`\rframe ${i + 1}/${frames.length}`);
      await renderStill({composition, serveUrl, frame, inputProps, output: join(dir, `s-${String(i).padStart(3, '0')}.png`),
        scale: Number(values.scale), puppeteerInstance: browser, chromiumOptions});
    }
    process.stdout.write('\n');
    mkdirSync(resolve(out, '..'), {recursive: true});
    const cols = points.length, rows = Math.ceil(frames.length / cols);
    const w = composition.width >= composition.height ? 480 : 270;
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '1', '-i', join(dir, 's-%03d.png'),
      '-vf', `scale=${w}:-2,tile=${cols}x${rows}:padding=6:margin=6:color=0x111111`, '-frames:v', '1', out]);
    console.log(`Contact sheet (${rows} scenes × ${cols} moments): ${out}`);
  } finally {
    rmSync(dir, {recursive: true, force: true});
    await browser.close({silent: true});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
