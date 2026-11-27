# Universal Video Generator: cinematic 3D videos from a storyboard

Turn a JSON storyboard (or a prompt, through the included AI agent skill) into a **moving, realistic 3D video**. Every shot is rendered frame by frame with three.js inside Remotion:

- moving cameras
- physically based lighting and reflections
- a film pipeline (bloom, depth of field, tone mapping, grain)
- transitions and kinetic titles
- captions and voiceover
- a generated score with sound effects

Nothing is a static slide, and a quality gate fails any video that freezes or has no sound.

It works for explainers, product and app promos, Instagram Reels, YouTube Shorts, TikToks, title sequences, trailers and stories, in any aspect ratio and any language.

## What you get

| | |
|---|---|
| **5 procedural 3D worlds** | `studio` (glossy product stage), `space` (planets lit by a real sun), `city` (night towers, traffic, wet streets, neon), `terrain` (mountains, river, physical sky), `abstract` (motion-graphics forms with bokeh) |
| **Subjects** | phones, tablets and laptops showing your real screenshot · 3D extruded titles (chrome, gold, glass) · planets (Earth with clouds, atmosphere and night lights; the Moon with craters; Mars; a ringed gas giant; ice; lava) and an orbiting moon · glTF/GLB models with their animations · sculptural shapes |
| **13 camera moves** | push-in, pull-out, orbit, crane up/down, fly-by, truck left/right, drone fly-through, reveal, spiral, drift. Each has intensity, lens (mm), easing and handheld shake |
| **Moods** | noon, golden hour, dusk, dawn, night, neon, each with its own lighting, sky, fog and colour |
| **Film look** | HDR bloom, depth of field with real bokeh, ACES/AgX/Neutral tone mapping, chromatic aberration, vignette, animated grain, letterbox, colour grades |
| **Edit** | fade, flash, zoom, whip-pan, blur, slide and wipe transitions · word-by-word animated headlines · captions · Ken Burns on images and footage |
| **Audio** | per-shot voiceover (scenes stretch to fit the line) · music ducked under speech · an offline, royalty-free **soundtrack generator** (pads, bass, arpeggios, drums, whooshes on every cut, risers, impacts) |
| **Quality gates** | `validate` (schema plus missing files) · `review` (contact sheet of every shot) · `check` (fails frozen pictures or silent audio, reports loudness in LUFS) |

Everything is frame-driven and seeded, so renders are repeatable and can run in parallel.

## Quick start

Requires Node.js 22+ and ffmpeg on `PATH`.

```bash
npm ci
npm run studio                       # live preview in Remotion Studio
```

Render the included demos:

```bash
# 30 s 3D explainer with Hindi narration and Hinglish captions (1920×1080)
npx remotion render src/index.ts UniversalVideo out/moon-phases-3d.mp4 --props=examples/moon-phases-3d.json --concurrency=4

# 19 s vertical showcase reel of every world (1080×1920)
npx remotion render src/index.ts UniversalVideo out/cinematic-reel.mp4 --props=examples/cinematic-reel.json --concurrency=4

npm run check -- out/cinematic-reel.mp4
```

On integrated graphics, 1080p renders at roughly 3–5× real time. The original 2D version of the moon explainer is still available as its own composition: `npx remotion render src/index.ts MoonPhases out/moon-phases-hinglish.mp4`.

## Make your own video

1. **Write a storyboard** (`projects/my-video.json`):

```json
{"project": {
  "version": 1, "title": "My App", "width": 1080, "height": 1920, "fps": 30, "accent": "#5fd4ff",
  "look": {"grain": 0.3, "grade": "teal-orange"},
  "scenes": [
    {"id": "hook", "type": "cinematic", "durationInFrames": 90, "world": "abstract",
     "subject": {"kind": "text", "text": "MY APP", "material": "chrome"}, "camera": {"move": "spiral"}},
    {"id": "city", "type": "cinematic", "durationInFrames": 105, "world": "city", "mood": "neon",
     "transition": {"type": "whip", "durationInFrames": 12},
     "camera": {"move": "fly-through", "intensity": 1.4, "lens": 24}, "headline": "Your city never sleeps"},
    {"id": "product", "type": "cinematic", "durationInFrames": 120, "world": "studio",
     "transition": {"type": "flash", "durationInFrames": 12},
     "subject": {"kind": "device", "device": "phone", "screen": "assets/home.png"},
     "camera": {"move": "orbit", "lens": 50}, "headline": "Neither does your plan", "titlePosition": "lower-third",
     "voiceover": {"src": "my-video/vo-3.mp3"}}
  ]
}}
```

2. **Add a score and SFX:** `npm run soundtrack -- --props projects/my-video.json --write`
3. **Validate:** `npm run validate -- projects/my-video.json`
4. **Review a contact sheet:** `npm run review -- --props projects/my-video.json` (writes `out/my-video-sheet.png`)
5. **Render:** `npx remotion render src/index.ts UniversalVideo out/my-video.mp4 --props=projects/my-video.json --concurrency=4`
6. **Check:** `npm run check -- out/my-video.mp4`

Put media under `public/` and reference it relative to that folder (`assets/home.png`). Every field, default and limit is documented in [skills/cinematic-3d-video/references/storyboard.md](skills/cinematic-3d-video/references/storyboard.md). Worlds, moods and recipes by genre are in [worlds.md](skills/cinematic-3d-video/references/worlds.md). Voiceover options are in [audio.md](skills/cinematic-3d-video/references/audio.md).

## Use it from an AI agent

The [`cinematic-3d-video`](skills/cinematic-3d-video/SKILL.md) skill teaches an agent the full workflow: prompt → beats → storyboard → voice and score → review → render → quality gate. It follows the open Agent Skills (`SKILL.md`) format, so it works in Claude Code, OpenAI Codex, Gemini CLI, GitHub Copilot, Cursor and other compatible agents:

```bash
npx skills add Harsh29004/claude-ai-video-ad-generator
```

Then ask: *"Make a 20-second 3D reel for my app"*, or *"Explain black holes in a 45-second cinematic video with narration"*.

## How it works

- `src/project.ts` holds the zod storyboard schema, the timeline with transition overlaps, and voiceover fitting.
- `src/UniversalVideo.tsx` is the composition: a TransitionSeries of scenes, grade and film look, voiceovers, and music ducking.
- `src/cinematic/` is the 3D engine. It contains the camera rig (`camera.ts`), the post pipeline (`PostFX.tsx`), GPU particles, materials, subjects, procedural planet textures, and the five `worlds/`.
- `scripts/` holds the soundtrack synthesiser, contact-sheet review, the quality gate and the validator.

3D content is procedural: no downloads at render time, and every random value comes from a seed. Textures and models are loaded with `delayRender`, so no frame is captured half-loaded. The post-processing composer is built synchronously, so the first frame of every shot is graded too.

The worlds are stylised-realistic computer graphics, not camera footage, and they contain no people. For live action or real-looking people, drop clips (filmed, stock or AI-generated) in as `video` scenes. The engine adds motion, transitions, titles, captions, voice and music around them.

## Develop

```bash
npm run typecheck
npm test
```

Keep animation frame-driven (`useCurrentFrame`, never `useFrame` timers), take randomness from `rng(seed)`, and add tests for schema changes. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT for this repository. Remotion is source-available under its own license, which requires a company license for some commercial uses; review [remotion.dev/license](https://www.remotion.dev/license) before deploying a commercial rendering service. Font notice: [src/cinematic/fonts/NOTICE.md](src/cinematic/fonts/NOTICE.md).
