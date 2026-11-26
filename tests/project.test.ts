import assert from 'node:assert/strict';
import test from 'node:test';
import space from '../examples/space-explainer.json';
import story from '../examples/vertical-story.json';
import {durationOf, timeline, videoPropsSchema} from '../src/project';

test('example projects validate and derive their own timeline and dimensions', () => {
  const {project} = videoPropsSchema.parse(space);
  assert.equal(durationOf(project), 240);
  assert.deepEqual(timeline(project.scenes).map(({from}) => from), [0, 60, 180]);
  const vertical = videoPropsSchema.parse(story).project;
  assert.deepEqual([vertical.width, vertical.height, durationOf(vertical)], [540, 960, 180]);
});

test('media and 3D defaults are applied; Unicode local file names are accepted', () => {
  const parsed = videoPropsSchema.parse({project: {...space.project, scenes: [
    {id: 'image', type: 'image', src: 'assets/चित्र 1.png', durationInFrames: 20},
    {id: 'video', type: 'video', src: 'assets/clip.mp4', durationInFrames: 20},
    {id: 'three', type: 'three', durationInFrames: 20},
  ], audio: [{src: 'assets/audio.wav'}]}}).project;
  assert.equal(parsed.direction, 'auto');
  assert.deepEqual(parsed.scenes.map((scene) => scene.type === 'three' ? scene.geometry : scene.type === 'text' ? null : scene.fit), ['cover', 'cover', 'knot']);
  assert.deepEqual(parsed.audio[0], {src: 'assets/audio.wav', startFrame: 0, volume: 1});
});

test('invalid timing, duplicate IDs, invalid dimensions and unknown fields are rejected', () => {
  const base = space.project;
  for (const project of [
    {...base, width: 999}, {...base, fps: 0}, {...base, scenes: []}, {...base, markting: true},
    {...base, scenes: [base.scenes[0], base.scenes[0]]},
    {...base, scenes: [{...base.scenes[0], durationInFrames: -1}]},
    {...base, audio: [{src: 'assets/sound.wav', startFrame: 240}]},
    {...base, audio: [{src: 'assets/sound.wav', startFrame: 239, durationInFrames: 2}]},
  ]) assert.equal(videoPropsSchema.safeParse({project}).success, false, JSON.stringify(project));
});

test('asset paths cannot reference URLs or escape public/', () => {
  for (const src of ['../clip.mp4', '/clip.mp4', 'assets/../../clip.mp4', 'assets/%2e%2e/clip.mp4', 'C:\\clip.mp4', 'https://example.com/clip.mp4']) {
    const project = {...space.project, scenes: [{id: 'clip', type: 'video', durationInFrames: 20, src}]};
    assert.equal(videoPropsSchema.safeParse({project}).success, false, src);
  }
});