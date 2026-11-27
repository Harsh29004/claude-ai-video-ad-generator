/**
 * Validates storyboards against the schema and prints readable errors plus a timing summary.
 *
 *   npm run validate -- examples/cinematic-reel.json [more.json ...]
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {durationOf, timeline, videoPropsSchema} from '../src/project';

let failed = false;
for (const file of process.argv.slice(2)) {
  const result = videoPropsSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!result.success) {
    failed = true;
    console.error(`✗ ${file}`);
    for (const issue of result.error.issues) console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    continue;
  }
  const {project} = result.data;
  const missing = [
    ...project.scenes.flatMap((s) => [s.voiceover?.src, 'src' in s ? s.src : undefined,
      s.type === 'cinematic' && s.subject.kind === 'device' ? s.subject.screen : undefined,
      s.type === 'cinematic' && s.subject.kind === 'model' ? s.subject.src : undefined]),
    ...project.audio.map((a) => a.src),
  ].filter((src): src is string => !!src && !existsSync(join('public', src)));
  const total = durationOf(project);
  console.log(`✓ ${file}: ${project.width}×${project.height} @ ${project.fps} fps, ${(total / project.fps).toFixed(1)} s (before voiceover fitting), ${project.scenes.length} scenes`);
  for (const {from, scene} of timeline(project.scenes)) {
    const what = scene.type === 'cinematic' ? `${scene.world} · ${scene.subject.kind} · ${scene.camera.move}` : scene.type;
    console.log(`  ${(from / project.fps).toFixed(1).padStart(5)} s  ${scene.id.padEnd(18)} ${what}${scene.voiceover ? ' · voiceover' : ''}`);
  }
  const still = project.scenes.filter((s) => s.type === 'cinematic' && s.camera.move === 'static' && s.camera.shake === 0);
  if (still.length) console.warn(`  ! locked-off shots with no shake: ${still.map((s) => s.id).join(', ')}`);
  if (!project.audio.some((a) => a.role === 'music')) console.warn('  ! no music track: run npm run soundtrack -- --props <file> --write');
  if (missing.length) {
    failed = true;
    console.error(`  ✗ missing files under public/: ${missing.join(', ')}`);
  }
}
process.exit(failed ? 1 : 0);
