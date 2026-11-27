---
name: cinematic-3d-video
description: Makes cinematic, realistic, fully moving 3D videos from a prompt with a free local renderer (Remotion + three.js). Shots include planets lit by a real sun, night cities with traffic and wet reflections, golden-hour drone flights over mountains, glossy product shots of phones and 3D titles, and motion-graphics worlds. Every shot has a moving camera, physically based lighting, bloom and depth of field. Videos come with transitions, animated titles, captions, voiceover and a generated score with sound effects, and are checked for frozen or silent output. Use it whenever the user wants a video, 3D animation, animated explainer, promo, product or app video, Instagram reel, YouTube Short or TikTok, intro, title sequence, trailer, story video or "realistic 3D" video. That includes casual asks like "make a video about X", "3D video for my app", "turn this script into a video", "make it cinematic, not static" or "explain this topic with animation".
license: MIT
compatibility: Needs a shell, Node.js 22+, ffmpeg and ffprobe on PATH, and about 1 GB free for dependencies. Rendering uses headless Chrome with WebGL; any machine with a GPU or integrated graphics works. Optional internet for neural voiceover.
metadata:
  author: Harsh29004
  version: "2.0.0"
  repository: https://github.com/Harsh29004/claude-ai-video-ad-generator
---

# Cinematic 3D Video

A storyboard (JSON) becomes a rendered MP4. The engine draws every frame in real 3D: a moving camera, worlds with physically based lighting, a film pipeline (bloom, depth of field, tone mapping, grain), transitions, kinetic titles, captions, voiceover, and a generated score with sound effects. You write the storyboard. The engine does the rendering.

In this file, `<engine>` means the engine's repository folder: the one whose `package.json` has `"name": "universal-video-generator"`. Read the references when you need them:
- `references/storyboard.md`: every field, default and limit (read it before writing your first storyboard)
- `references/worlds.md`: what each world looks like, its moods, the best camera moves, and recipes by genre
- `references/audio.md`: voiceover options, the soundtrack generator, mixing and ducking

## Rules

These rules exist because "a video" that doesn't move, or has no sound, is what users reject.

1. **Every shot moves.** Each cinematic shot has a camera move, and subjects animate by themselves. Use at most one pure text card, and keep it under 3 s. Never deliver a slideshow of stills.
2. **Every video has sound.** Narrated videos get a voiceover plus a music bed, ducked under the voice. Videos without narration get music and SFX. The `check` step fails silent output.
3. **No placeholders.** Never ship grey cards, "PLACEHOLDER" text, or fake UI drawn into a device screen. Use the user's real screenshot (`subject.screen`). Without one, the engine shows a plain lit wallpaper.
4. **Be honest about realism.** The worlds are procedural 3D. They look cinematic, but they are not camera footage and they contain no humans. If the user needs real-looking people, say so. Then either use clips they provide or generate them with an AI video model, and drop them in as `video` scenes (see "People and live action" below). Never pass a 3D render off as filmed footage.
5. **Review before you render, check after.** First look at the contact sheet. After the render, run the quality gate. Fix and re-render until it passes.

## Workflow

### 0. Engine
Find `<engine>`: the current folder, or a folder one or two levels down, whose `package.json` has the name above. Only if there is none, clone it:
```bash
git clone https://github.com/Harsh29004/claude-ai-video-ad-generator video-engine && cd video-engine
```
Then run `npm ci` (once). Check that `ffmpeg -version` works. Run every later command from `<engine>`.

### 1. Brief → beats (one message, at most)
Settle these, asking only what you can't infer: **topic or product**, **audience and language**, **platform**, **length**, and **narration yes/no**. If the user is in a hurry, use these defaults and state them:
- Reels/Shorts/TikTok: 1080×1920. YouTube/web: 1920×1080. 30 fps.
- 15–30 s for promos and 30–60 s for explainers, with one idea per shot and shots of 2.5–5 s (75–150 frames).
- Narration in the language the audience speaks, with captions in the same language (or romanised, e.g. Hinglish).

Write the beats: a **hook** (the strongest moving image in the first 1.5 s), then **2–6 body shots**, then a **closer** (title, call to action or takeaway).

### 2. Shots
For each beat pick a world, a subject, a camera move and a transition (`references/worlds.md` has recipes):

| Beat type | Good choice |
|---|---|
| Hook / title | `abstract` + `text` subject + `spiral`; or `city` + `fly-through` |
| Product or app | `studio` + `device` with `screen` (real screenshot) + `orbit` or `push-in` |
| Science / space | `space` + `planet` (+ `moon`, `orbitPath`, animated `sunAngle`) |
| Place / travel / mood | `terrain` + `fly-through` (golden, dawn, dusk, night) |
| Tech / urban / energy | `city` + `fly-through` or `crane-up`, mood `neon` or `night` |
| Logo / end card | `studio` + `text` subject (chrome, gold, glass) + `push-in` |

Vary the moves from shot to shot, and alternate wide and close lenses (24–28 mm for scale, 40–60 mm for products). Choose transitions by energy: `whip` and `flash` for energy, `zoom` to dive in, `fade` and `blur` for calm.

### 3. Storyboard
Write `<engine>/projects/<slug>.json` (start from `examples/cinematic-reel.json` or `examples/moon-phases-3d.json`). Keep headlines to 6 words or fewer. Use `titlePosition: "lower-third"` when narration runs, and add a `caption` for every narrated shot. Then validate:
```bash
npm run validate -- projects/<slug>.json
```

### 4. Voice and music
- Narration: write one line per shot. Make the audio files (see `references/audio.md`), put them in `public/<slug>/`, and attach each as `"voiceover": {"src": "<slug>/vo-1.mp3"}`. Scenes stretch automatically to fit their line.
- Score and SFX, generated offline and royalty-free:
```bash
npm run soundtrack -- --props projects/<slug>.json --write
```
This writes music and SFX (whooshes on every transition, a riser into the final shot, impacts) to `public/assets/` and adds both to the storyboard. Pass `--style ambient|epic|tech|warm` to override the automatic choice. If the user gives you a music file, add it as `{"src": "...", "role": "music"}` instead.

### 5. Review the sheet
```bash
npm run review -- --props projects/<slug>.json
```
Open `out/<slug>-sheet.png`. It shows the start, middle and end of each shot. Check that titles are readable against the background, that subjects are well framed in this aspect ratio, and that nothing is black or empty. Fix the storyboard (move, `distance`, `lens`, `titlePosition`, `mood`) and review again.

### 6. Render and check
```bash
npx remotion render src/index.ts UniversalVideo out/<slug>.mp4 --props=projects/<slug>.json --concurrency=4
npm run check -- out/<slug>.mp4
```
`check` exits with code 3 when any stretch is frozen for more than 1.5 s or the audio is missing or silent. It also warns about lighting: stretches too dark to read on a phone (raise that shot's `exposure` to 1.2–1.5 or use a brighter `mood`) and near-white flash frames. To fix a frozen stretch, raise `camera.intensity` for that shot, switch to a stronger move, or shorten the shot. It also reports loudness; aim for about −14 LUFS for social. A 1080p video renders at roughly 3–5× real time on integrated graphics. Lower `--concurrency` if the GPU runs out of memory.

### 7. Deliver
Give the MP4 path, its length and resolution, a one-line summary of each shot, and how the audio was made. If you used a synthetic voice, say so. Offer the storyboard file for edits, since a change and re-render is cheap.

## People and live action
The 3D worlds contain no humans. When a video needs real-looking people (testimonials, UGC-style ads, actors), take one of these routes:
- The user supplies clips: put them in `public/assets/` and use `{"type": "video", "src": "assets/clip.mp4", "motion": "zoom-in"}` scenes between 3D shots.
- Generate the clips with an AI video model the user has access to (Veo, Kling, Sora, Runway) from shot prompts you write. Drop them in the same way. The engine adds transitions, titles, captions, voice and music around them.
- Never fake people with 3D shapes or stills, and label synthetic people as AI-generated wherever the platform requires it.

## Going beyond the presets
When the presets can't express a shot, extend the engine. Add a world under `src/cinematic/worlds/`, register it in `src/cinematic/vocab.ts` and `CinematicScene.tsx`, and reuse `Subject`, `Particles`, `PostFX` and `cameraPose`. Rules:
- Animate only from the frame or time passed in. Never animate inside `useFrame`.
- Generate randomness with `rng(seed)`.
- Load textures and models through `useImageTexture` and `useGltf` (they hold the frame until loaded). Never use React Suspense loaders.

To use a `.glb` model, set `subject: {"kind": "model", "src": "assets/model.glb"}`. CC0 sources include Poly Haven and Kenney. Avoid Draco-compressed files unless the decoders are bundled locally.

Run `npm run typecheck` and `npm test` after engine changes.
