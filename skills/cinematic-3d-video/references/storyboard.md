# Storyboard reference

The source of truth is `<engine>/src/project.ts`, a zod schema. Unknown fields are rejected, so a typo fails `npm run validate` instead of being silently ignored. Paths are relative to `<engine>/public/`.

## Project

```json
{"project": {
  "version": 1, "title": "Shown as a kicker on text cards", "width": 1080, "height": 1920, "fps": 30,
  "background": "#05060b", "accent": "#5fd4ff", "direction": "auto",
  "look": {"grain": 0.35, "vignette": 0.3, "letterbox": false, "grade": "none"},
  "scenes": [ ... ],
  "audio": [{"src": "assets/x-music.mp3", "role": "music", "volume": 0.9}],
  "duckMusic": 0.3
}}
```

| Field | Values | Notes |
|---|---|---|
| `width`, `height` | even, 64–3840 | 1080×1920 vertical, 1920×1080 wide, 1080×1080 square |
| `fps` | 1–60 | Use 30. Frames = seconds × fps |
| `accent` | hex | Tints lights, glows, titles and particles |
| `direction` | `auto`, `ltr`, `rtl` | For Arabic or Hebrew titles |
| `look.grain` | 0–1 | Animated film grain over everything |
| `look.vignette` | 0–1 | Darkened edges |
| `look.letterbox` | bool | 2.39:1 bars, for a trailer feel |
| `look.grade` | `none`, `teal-orange`, `warm`, `cool`, `mono`, `vivid` | Colour grade over the whole frame |
| `audio[].role` | `music` (ducked under voice), `voice`, `sfx` | |
| `audio[].startFrame`, `durationInFrames`, `volume`, `loop` | | `loop` for music shorter than the video |
| `duckMusic` | 0–1 | Music volume multiplier while anyone speaks |

## Fields every scene has

| Field | Notes |
|---|---|
| `id` | lowercase-kebab, unique |
| `durationInFrames` | before transition overlap. A voiceover can lengthen it automatically |
| `transition` | `{"type": "fade"|"flash"|"zoom"|"whip"|"blur"|"slide"|"wipe"|"cut", "durationInFrames": 15, "direction": "left"|"right"|"up"|"down"}`: how this scene **enters**. Must be shorter than both scenes it joins. Overlaps shorten the total |
| `voiceover` | `{"src": "slug/vo-1.mp3", "delayInFrames": 8, "volume": 1}`: plays from the scene start. Its length is measured automatically |
| `caption` | subtitle box at the bottom, fades in and out |

## `cinematic` (the 3D shot)

```json
{"id": "hero", "type": "cinematic", "durationInFrames": 120,
 "world": "studio", "mood": "auto",
 "subject": {"kind": "device", "device": "phone", "screen": "assets/app-home.png"},
 "camera": {"move": "orbit", "intensity": 1, "shake": 0.15, "lens": 35, "ease": "smooth", "distance": 1, "height": 0, "angle": 0},
 "particles": "auto", "bloom": 1, "focus": true, "exposure": 1, "speed": 1, "seed": 7, "color": "#ff8a3d",
 "headline": "Plan less. Live more.", "subhead": "Optional second line", "titlePosition": "lower-third"}
```

| Field | Values / range | Default |
|---|---|---|
| `world` | `studio`, `space`, `city`, `terrain`, `abstract` | `studio` |
| `mood` | `auto`, `noon`, `golden`, `dusk`, `night`, `dawn`, `neon` | the world's own default |
| `camera.move` | `push-in`, `pull-out`, `orbit`, `crane-up`, `crane-down`, `fly-by`, `truck-left`, `truck-right`, `fly-through`, `reveal`, `spiral`, `drift`, `static` | `push-in` |
| `camera.intensity` | 0–3 (how far it travels) | 1 |
| `camera.shake` | 0–1 (handheld) | 0.15 |
| `camera.lens` | 12–200 mm full-frame equivalent; fitted to the short side, so it frames alike in 9:16 and 16:9 | 35 |
| `camera.ease` | `linear`, `smooth`, `cinematic` (slow in, slow out) | `smooth` |
| `camera.distance` | 0.2–10 × the world's framing | 1 |
| `camera.height` | −2…4, in framing-distance units | 0 |
| `camera.angle` | degrees around the subject | 0 |
| `particles` | `auto`, `none`, `dust`, `sparks`, `embers`, `snow`, `rain`, `bokeh`, `fireflies` | `auto` (per world) |
| `bloom` | 0–4 × the world's default glow | 1 |
| `focus` | depth of field on or off | true |
| `exposure` | 0.2–3 | 1 |
| `speed` | 0–5 × subject animation speed (orbits, spins, traffic, clouds) | 1 |
| `seed` | changes the procedural layout (city blocks, terrain, star field, planet surface) | 7 |
| `color` | overrides `accent` for this shot | |
| `titlePosition` | `center`, `top`, `bottom`, `lower-third` | `center` |

### Subjects (`subject.kind`)

| kind | Fields | Notes |
|---|---|---|
| `none` | | The world alone (city, terrain and space look complete without a subject) |
| `shape` | `shape`: `orb`, `ring`, `knot`, `crystal`, `capsule`, `cube`; `material`; `color` | Spins and floats |
| `text` | `text` (≤ 32 chars, Latin script); `material`; `color` | Extruded, bevelled 3D type. For other scripts use `headline` instead |
| `device` | `device`: `phone`, `tablet`, `laptop`; `screen` (image path); `color` (body) | The screenshot is cropped to fill the screen |
| `model` | `src` (.glb/.gltf); `scale`; `spin`; `animation` | Auto-fitted; the first animation clip plays, locked to the frame |
| `planet` | `planet`: `earth`, `moon`, `mars`, `gas-giant`, `ice`, `lava`; `moon` (companion); `rings`; `orbitPath`; `sunAngle` [start, end]; `orbitTurns`; `spin` | Best in `space`. `sunAngle` 0° = sun behind camera (full), 90° = half lit, 180° = backlit (thin crescent). Animate it to sweep phases |

Materials: `chrome`, `gold`, `glass` (transmission with dispersion), `ceramic`, `iridescent`, `matte`, `emissive` (glows), `carbon`.

A subject in `city` or `terrain` floats as a giant hero object above the scene.

## `text`
`{"type": "text", "headline": "...", "body": "...", "background": "#hex", "backdrop": "aurora"|"grid"|"solid"}`: a kinetic title card with moving light fields and drifting motes. Use it sparingly; a cinematic shot with a `headline` is usually better.

## `image`, `video`
`{"type": "image", "src": "assets/x.jpg", "fit": "cover"|"contain", "motion": "zoom-in"|"zoom-out"|"pan-left"|"pan-right"|"pan-up"|"pan-down"|"none"}`. Images default to `zoom-in` (Ken Burns). With `contain`, the empty space is filled with a blurred copy of the image. `video` also takes `volume` (0 mutes) and defaults to `motion: "none"`.

## `three` (legacy)
The original single-object scene (`geometry`, `material: metal|ceramic`, `rotationSeconds`) is still accepted, and renders as a studio `cinematic` shot.

## Timing math
- `durationOf` = sum of scene durations − sum of transition durations.
- Scene *i* starts at the previous start + the previous duration − its own transition.
- Run `npm run validate -- file.json` to print every scene's start time.
