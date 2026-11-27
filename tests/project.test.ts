import assert from 'node:assert/strict';
import test from 'node:test';
import moon from '../examples/moon-phases-3d.json';
import reel from '../examples/cinematic-reel.json';
import space from '../examples/space-explainer.json';
import story from '../examples/vertical-story.json';
import {applyVoiceDurations, durationOf, timeline, videoPropsSchema} from '../src/project';

test('every example storyboard validates', () => {
  for (const example of [space, story, moon, reel]) {
    const result = videoPropsSchema.safeParse(example);
    assert.equal(result.success, true, result.success ? '' : JSON.stringify(result.error.issues));
  }
});

test('transitions overlap scenes and shorten the timeline', () => {
  const {project} = videoPropsSchema.parse(space);
  assert.deepEqual(timeline(project.scenes).map(({from}) => from), [0, 60, 195]);
  assert.equal(durationOf(project), 75 + 150 + 75 - 15 - 15);
  const vertical = videoPropsSchema.parse(story).project;
  assert.deepEqual([vertical.width, vertical.height, durationOf(vertical)], [540, 960, 90 + 120 + 90 - 18 - 18]);
});

test('cinematic shots get camera, world and look defaults', () => {
  const {project} = videoPropsSchema.parse({project: {...space.project, scenes: [{id: 'shot', type: 'cinematic', durationInFrames: 60}]}});
  const shot = project.scenes[0];
  assert.equal(shot.type, 'cinematic');
  if (shot.type !== 'cinematic') return;
  assert.equal(shot.world, 'studio');
  assert.deepEqual(shot.subject, {kind: 'none'});
  assert.deepEqual(shot.camera, {move: 'push-in', intensity: 1, shake: 0.15, lens: 35, ease: 'smooth', distance: 1, height: 0, angle: 0});
  assert.deepEqual(project.look, {grain: 0.35, vignette: 0.3, letterbox: false, grade: 'none'});
});

test('media, legacy 3D and audio defaults are applied; Unicode file names are accepted', () => {
  const parsed = videoPropsSchema.parse({project: {...space.project, scenes: [
    {id: 'image', type: 'image', src: 'assets/चित्र 1.png', durationInFrames: 20},
    {id: 'video', type: 'video', src: 'assets/clip.mp4', durationInFrames: 20},
    {id: 'three', type: 'three', durationInFrames: 20},
  ], audio: [{src: 'assets/audio.wav'}]}}).project;
  assert.equal(parsed.direction, 'auto');
  const [image, video, three] = parsed.scenes;
  assert.deepEqual(image.type === 'image' && [image.fit, image.motion], ['cover', 'zoom-in']);
  assert.deepEqual(video.type === 'video' && [video.fit, video.motion], ['cover', 'none']);
  assert.equal(three.type === 'three' && three.geometry, 'knot');
  assert.deepEqual(parsed.audio[0], {src: 'assets/audio.wav', role: 'music', startFrame: 0, volume: 1, loop: false});
});

test('voiceovers lengthen scenes that would cut them off', () => {
  const {project} = videoPropsSchema.parse({project: {...space.project, scenes: [
    {id: 'a', type: 'cinematic', durationInFrames: 60, voiceover: {src: 'vo/a.mp3'}},
    {id: 'b', type: 'cinematic', durationInFrames: 200, voiceover: {src: 'vo/b.mp3'}},
  ]}});
  const fitted = applyVoiceDurations(project, {a: 90, b: 30});
  assert.equal(fitted.scenes[0].durationInFrames, 8 + 90 + 11);
  assert.equal(fitted.scenes[1].durationInFrames, 200);
  assert.equal(fitted.scenes[0].voiceover?.durationInFrames, 90);
});

test('invalid timing, transitions, duplicate IDs, dimensions and unknown fields are rejected', () => {
  const base = space.project;
  for (const project of [
    {...base, width: 999}, {...base, fps: 0}, {...base, scenes: []}, {...base, markting: true},
    {...base, scenes: [base.scenes[0], base.scenes[0]]},
    {...base, scenes: [{...base.scenes[0], durationInFrames: -1}]},
    {...base, scenes: [base.scenes[0], {...base.scenes[2], transition: {type: 'fade', durationInFrames: 80}}]},
    {...base, scenes: [{id: 'x', type: 'cinematic', durationInFrames: 30, world: 'moon'}]},
    {...base, scenes: [{id: 'x', type: 'cinematic', durationInFrames: 30, camera: {move: 'teleport'}}]},
    {...base, audio: [{src: 'assets/sound.wav', startFrame: 270}]},
    {...base, audio: [{src: 'assets/sound.wav', startFrame: 269, durationInFrames: 2}]},
  ]) assert.equal(videoPropsSchema.safeParse({project}).success, false, JSON.stringify(project).slice(0, 160));
});

test('asset paths cannot reference URLs or escape public/', () => {
  for (const src of ['../clip.mp4', '/clip.mp4', 'assets/../../clip.mp4', 'assets/%2e%2e/clip.mp4', 'C:\\clip.mp4', 'https://example.com/clip.mp4']) {
    const project = {...space.project, scenes: [{id: 'clip', type: 'video', durationInFrames: 20, src}]};
    assert.equal(videoPropsSchema.safeParse({project}).success, false, src);
  }
});
