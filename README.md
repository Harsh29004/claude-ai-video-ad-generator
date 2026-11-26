# Universal Video Generator

A TypeScript + Remotion engine for turning structured storyboards into videos. Use the same timeline for explainers, stories, tutorials, motion graphics, 3D showcases, and ads.

## Quick start

Requires Node.js 22+. Run the commands from the repository root:

```bash
npm ci
npm run studio
```

Open the `UniversalVideo` composition. Its default storyboard is the 2D/3D space explainer. To preview a different storyboard or export either demo:

```bash
npm run studio -- --props=./examples/vertical-story.json
npm run render -- out/space-explainer.mp4
npm run render -- out/vertical-story.mp4 --props=./examples/vertical-story.json
npm run typecheck
npm test
```

## Create a video

1. Copy `examples/space-explainer.json`. Edit `project.title`, `width`, `height`, `fps`, and `scenes`. Duration comes from the sum of each scene's `durationInFrames` (90 frames at 30 fps is 3 seconds).
2. Give each scene a unique `id` and choose its `type`:

   | Type | Scene options |
   | --- | --- |
   | `text` | `headline`, optional `body` and `background`; animated entrance |
   | `three` | `geometry`: `orb`, `ring`, or `knot`; `material`: `metal` or `ceramic`; optional color, headline, and rotation speed |
   | `image` | `src` and optional `fit`: `cover` or `contain` |
   | `video` | `src`, optional `fit`, and `volume` from 0 to 1 |

3. Put media in `public/assets/` and reference it as `assets/my-clip.mp4`. Use optional `caption` on scenes and `project.audio` tracks with `src`, `startFrame`, optional `durationInFrames`, and `volume`. Size video scene lengths to fit your source footage.
4. Use Unicode text and set `project.direction` to `auto`, `ltr`, or `rtl`. For repeatable results, install fonts covering the required scripts on every render machine; fonts are not bundled.
5. Render with `npm run render -- out/my-video.mp4 --props=./path/to/storyboard.json`.

The storyboard contract and validation are in `src/project.ts`. Add future scene types there and in `src/UniversalVideo.tsx`. The 3D implementation in `src/ThreeScene.tsx` uses Three.js meshes, physically based materials and lighting, with animation driven by the Remotion frame. These are procedural scenes, not photorealistic asset generation. Custom 3D model import and prompt-to-storyboard/footage generation are not part of this first pass. Remotion dependencies are covered by their own license; review it before deploying a commercial rendering service.
