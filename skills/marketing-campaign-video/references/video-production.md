# Video Production (Phase 5)

## Contents
1. Model choice
2. Ad structures
3. Character bible
4. Prompt formula for realistic people
5. Realism checklist
6. App screens and text
7. Dialogue and audio
8. `shots.json` reference
9. Review loop: artifact → fix
10. Prompt pack (no API key)
11. Other aspect ratios

---

## 1. Model choice (snapshot Nov 2026; verify on fal.ai/models, which changes fast)

All of these run through **fal.ai** with one `FAL_KEY` (fal.ai → Dashboard → Keys). The script is model-agnostic: `model` is any fal endpoint ID and `input` is passed through as-is, so a new model only needs its own input fields.

| Endpoint | Best for | Input notes |
|---|---|---|
| `fal-ai/veo3.1` (default) | Most realistic people, native **lip-synced dialogue** + ambience | `prompt` (req), `duration` `"4s"/"6s"/"8s"`, `aspect_ratio` `"16:9"/"9:16"`, `resolution` `"720p"/"1080p"/"4k"`, `generate_audio` (default true), `negative_prompt`, `seed`. About **$0.40/s** |
| `fal-ai/kling-video/v3/pro/text-to-video` | Longer single shots (3–15 s), built-in multi-shot, 1:1 support | `prompt` or `multi_prompt` [{prompt, duration}], `duration` `"3"`–`"15"`, `aspect_ratio` `16:9/9:16/1:1`, `generate_audio`, `negative_prompt`, `cfg_scale` |
| `fal-ai/kling-video/v3/pro/image-to-video` | Keeping one face across shots: animate a reference still | adds an image input. Check the endpoint page for its exact field name |
| `kling/v4/text-to-video` | Newest Kling | Schema not verified. Read its API page before use |

Notes:
- Google's Gemini-API Veo *preview* models were shut down on 2026-10-22 (the replacement there is Gemini Omni). Use fal's `fal-ai/veo3.1`, or Veo 3.1 GA on Google's enterprise platform, instead.
- For **character consistency**, the strongest route is: generate a character still first (any fal image model), get the user's OK on the face, then use image-to-video for every shot with that still. Local files can be passed as `"file:assets/riya.png"`; the script converts them to data URIs.
- Prices are estimates. The dry run prints the estimate; confirm on the model page before big batches.

## 2. Ad structures

**15 s (3 generated shots + app shot + end card)**
| t | Beat | Content |
|---|---|---|
| 0–4 | Hook | Character in the pain moment, one line of dialogue or a reaction |
| 4–8 | Reveal | Character turns to phone/laptop, relief begins (no UI rendered) |
| 8–11 | Product | Real app screenshot (`image` shot) with caption of the key benefit |
| 11–15 | Payoff + end card | Character's after state (2–3 s) → logo + CTA |

**30 s**: Hook (0–3) → Agitate: the failing workaround (3–9) → Reveal (9–13) → Product proof: 1–2 screenshots (13–19) → Payoff (19–26) → End card (26–30).

Formats that work for realistic people: **POV/UGC selfie** (character talks to camera, phone-shot look), **mini-drama** (two characters, the problem shows in their interaction), **day-in-the-life** (quick cuts of the before → after). For B2B, use an office or remote-work setting, a calm tone, and the cost of the problem made visible (late invoice, angry client email shown blurred).

## 3. Character bible

Write each character once (about 40–70 words) and reference it as `{{name}}` in every shot. Repeat the identity, never re-describe it differently: any variation in wording invites a different face.

```
"riya": "Riya, a 27-year-old Indian woman from Pune with a warm medium-brown complexion, shoulder-length wavy black hair tied in a loose low bun, thin gold nose stud, small mole above her left eyebrow, wearing a faded mustard cotton kurta over black leggings; expressive, slightly tired eyes; speaks Hinglish with a natural urban Indian accent"
```

Include: name, age, ethnicity and region matching the target market, skin tone, hair, 1–2 distinguishing marks, the same wardrobe across shots, energy and personality, voice and accent. Also keep **setting** and **look** entries in the bible (e.g. `"flat"`, `"look"`) so locations and grade stay consistent too.

Cast real-looking, everyday people, not models. Audiences scroll past glossy stock-ad faces; relatable imperfection is what reads as real.

## 4. Prompt formula for realistic people

```
[Shot & camera]. Character: {{character}}. Action: [ONE beat + emotion as behavior]. {{setting}} Dialogue: [Name says in <language>: "line"] Ambient audio: [...]. {{look}}
```
Labeled parts keep the expanded bible text grammatical and help the model separate who, what, where and sound. Bible entries for settings and style start with their own label ("Setting: ...", "Style: ...").

Example (hook, 6 s, 9:16):
```
Medium close-up, smartphone selfie framing, slight natural handheld shake. Character: {{riya}}. Action: she sits on the edge of her bed at dawn, one sneaker half laced, glances at the clock, then exhales and looks straight into the camera with a half-annoyed smile. {{flat}} Dialogue: Riya says in Hinglish: "Gym ka time? Seriously, kabhi milta hi nahi." Ambient audio: ceiling fan hum, distant traffic, a pressure-cooker whistle from a neighbour's kitchen. {{look}}
```

Rules that matter:
- **One action per shot.** Models fail at sequences ("she picks up X then walks to Y then..."). Split them into shots.
- **Camera language** sets the realism: "handheld", "smartphone selfie framing", "35mm documentary", "slow push-in", "over-the-shoulder".
- **Light**: name a real source ("soft morning window light from the left", "warm practical lamp", "fluorescent office light").
- **Lived-in details** sell reality: clutter, a chai cup, a sticky note, a crumpled bill.
- **Emotion as behavior**: "rubs her temple, exhales", not "she is stressed".
- The `look` bible entry is typically: "Style: shot on a smartphone, natural light, realistic skin texture with pores, subtle film grain, true-to-life colors, documentary UGC style, no background music."
- The `negative` bible entry is typically: "subtitles, captions, on-screen text, watermark, logos, distorted hands, extra fingers, warped face, plastic or airbrushed skin, cartoon, CGI look, uncanny eyes, background music".

## 5. Realism checklist (review every generated clip)

- Face stays the same identity across the shot and matches the bible
- Hands: 5 fingers, no melting while holding objects
- Lips sync with the dialogue; no extra mumbling after the line ends
- Eyes: natural blinks, no dead stare
- No garbled text, fake logos or watermarks in frame
- Physics: objects don't morph or pass through hands
- Wardrobe and setting match the previous shot

## 6. App screens and text

Video models garble UI and text, and a fake UI also misrepresents the product. So:
- In generated shots, show the device **from the side or back**, the screen's glow on the face, or a blurred screen. Add "phone screen facing away from camera" to the prompt.
- Show the real product through `image` shots (screenshots) or `clip` shots (screen recordings) supplied by the user. The assembler fits them over a blurred backdrop with a slow zoom.
- Captions, headline and CTA are added in assembly, never generated. For non-Latin captions (Devanagari, Arabic...), set `"font"` in `shots.json` to a font covering that script (e.g. `C:/Windows/Fonts/Nirmala.ttc`, Noto Sans Devanagari), or keep captions in Latin script (Hinglish).
- If no screenshots exist yet, use an `image` shot pointing at a placeholder (e.g. the logo) and tell the user to swap it.

## 7. Dialogue and audio

- About 2.5 words per second max: 4 s ≈ 8 words, 6 s ≈ 13, 8 s ≈ 18. Shorter lines lip-sync better.
- Format: `<Name> says in <language/accent>: "<line>"`. One speaker per shot is the most reliable.
- Write the dialogue in the audience's real language (Hindi, Hinglish, Spanish...). Captions carry the same line; translate them if the platform audience mixes languages.
- Ask for ambient sound only ("no background music") in generated shots. Music is mixed once in assembly, so cuts don't jump between clashing scores.
- Voice-over alternative: set `generate_audio: false`, record or generate the VO separately, and pass it as the `music` track with `volume: 1.0`.

## 8. `shots.json` reference

See `scripts/shots.example.json` for a complete file.

| Key | Meaning |
|---|---|
| `project` | Output file name stem |
| `output` | `{aspect_ratio: "9:16"\|"16:9"\|"1:1"\|"4:5", resolution: "720p"\|"1080p", fps: 30}` |
| `default_model` | fal endpoint for `generate` shots without their own `model` |
| `bible` | `{key: text}`. Any `{{key}}` in any string of a shot `input` is replaced (characters, settings, look, negative) |
| `input_defaults` | Merged under every `generate` shot's `input` (the shot's own fields win); `"use_defaults": false` on a shot skips it (e.g. a different model) |
| `price_per_second` | Optional override for the dry-run estimate |
| `captions` | `{enabled: true, position: 0.72}`, where position is the vertical center as a fraction of height |
| `disclosure` | `{text: "AI-generated dramatization", position: "top"\|"bottom"}`; set `text` to "" only if the user explicitly declines |
| `shots[]` | Ordered shots (below) |
| `end_card` | `{headline, cta, logo, duration, bg, fg}`; `logo` is a path relative to `shots.json` |
| `music` | `{path, volume}` (looped and faded out automatically) |
| `font` | Optional .ttf path; otherwise a system font is used |

Shot types:
- `generate`: `id`, `model?`, `input{...}`, `duration?` (planned seconds, else read from `input.duration`), `caption` or `captions[{text,start,end}]`, `trim?` `[start, end]` in seconds
- `image`: `id`, `path`, `duration`, `caption?`, `fit` `"contain"` (default) or `"cover"`, `motion` `"zoom"` (default) or `"none"`
- `clip`: `id`, `path` (existing video, e.g. a screen recording), `duration?`, `trim?`, `fit` (default `"cover"`), `caption?`

Generated clips land in `clips/<id>.mp4` beside `shots.json`. Use short, stable ids (`s01-hook`) because the cache and resume logic key on them.

## 9. Review loop: artifact → fix

| Problem | Fix |
|---|---|
| Different face between shots | Make sure the identical `{{name}}` bible is used; move to image-to-video with an approved character still |
| Garbled phone UI | Turn the device away from camera; use an `image` shot for the screen |
| Burned-in subtitles or text | Add "subtitles, captions, on-screen text" to the negative prompt; remove quoted signage from the prompt |
| Lip-sync off or extra speech | Shorten the line; one speaker; put the line at the end of the prompt |
| Too glossy or "AI-looking" | Add the smartphone/UGC look, imperfect skin and real light source; remove "cinematic, 8k, beautiful" |
| Model refuses or a safety block | Remove anything implying a real or famous person or minors, or violence; rephrase neutrally |
| Bad clip, good prompt | Change `seed` (or add one) and rerun `--only <id> --force` |

## 10. Prompt pack (no API key)

Write `05-video/prompt-pack.md`. Per shot: id · beat · duration · aspect · model suggestion · **final prompt with all placeholders expanded** · negative prompt · dialogue line · caption. Add a short "how to use" note: paste into Google Flow (Veo), Kling, Sora, Runway or similar; save each result as `05-video/clips/<id>.mp4`; then run the assembler.

## 11. Other aspect ratios

Generate natively per aspect rather than cropping (cropping 9:16 → 16:9 loses the face). For a second aspect, copy `shots.json` to `shots-16x9.json` with a new `project` name and a changed `aspect_ratio` in `output` and `input_defaults`. Reuse the same prompts. Note that the generator keys its clips by shot id in one `clips/` folder, so give the copy its own folder (e.g. `05-video-16x9/`) to avoid overwriting.
