# Worlds, moods and recipes

Every world has a default mood, framing, lens (bloom, depth of field, tone mapping) and particle type. Override them per shot.

## studio: product and title stage
An endless glossy floor with blurred reflections and contact shadows, softbox and strip-light reflections, coloured rim lights, light shafts and drifting dust.
- **Moods:** `night` (default, dark premium), `neon` (magenta/cyan rims), `golden` (warm key), `dusk`, `dawn`, `noon` (bright white cyclorama, no shafts).
- **Subjects:** `device` (with the user's real screenshot), `text` (chrome, gold or glass logo type), `shape`, `model`.
- **Moves:** `orbit` (1–1.5) shows the object turning in light, `push-in` makes a reveal, `crane-down` makes a landing, `reveal` goes from low and close to wide.
- Devices use neutral tone mapping so screenshot colours stay true.

## space: planets, moons and orbits
A procedural planet lit by a single sun, with a Milky Way sky, stars, and a visible sun with glow when it is in frame.
- `earth`: continents, oceans with sun glint, drifting clouds, an atmosphere that hugs the limb, and city lights only on the night side.
- `moon`: craters and maria, with a sharp terminator.
- Also `mars`, `gas-giant` (bands and a storm; `rings`), `ice`, and `lava` (glowing cracks).
- `moon: true` adds an orbiting moon, and `orbitPath: true` draws its dashed orbit. `orbitTurns` sets how far it travels during the shot.
- `sunAngle: [a, b]` sweeps the light. Phase sequence: `[178, -178]` runs new → full → new. Crescent: 130–160. Half: 90. Gibbous: 30–60.
- **Moves:** `push-in` with lens 40–50 for a hero planet; `orbit` to show the lit half moving; `crane-down` or `orbit` with `distance` about 0.7 for the Earth–Moon system; `pull-out` for the reveal.

## city: towers, traffic and wet streets
A four-lane avenue between lit towers in three facade styles (office grid, residential, glass curtain wall, lit floor by floor). It has traffic with headlights and tail lights, streetlights with pools of light, neon signs (some flickering), aviation lights blinking on the tallest roofs, a reflective wet road and haze.
- **Moods:** `night` (default), `neon` (purple haze plus rain), `dusk` (orange horizon, half-lit windows), `dawn`, `golden` and `noon` (daytime: no window lights, sunlit facades).
- **Moves:** `fly-through` (a drone flight down the avenue; 1.2–1.6 for speed), `crane-up` (rising over the rooftops), `orbit` and `reveal` around downtown.
- **Lens:** 24–28 mm for scale. Add `"particles": "rain"` for a noir look.

## terrain: mountains, river and sky
Alpine ridges carved by a river valley, coloured by height and slope (meadow, forest, rock, snow), with reflective water, drifting cloud cover, a physically based sky that also lights the scene, and long shadows.
- **Moods:** `golden` (default, warm side light), `dawn` (pink), `dusk` (red, low sun), `noon` (high sun, blue haze), `night` (moonlight and stars).
- **Moves:** `fly-through` (a drone run along the river; 1.4–1.6), `crane-up` or `reveal` for an establishing vista, `orbit` for a slow panorama.
- Use it for travel, nature, "journey" metaphors, calm intros and outros.

## abstract: motion-graphics space
Chrome spheres, ceramic cubes in accent colours and iridescent rings spiralling on a slowly turning helix, against a gradient backdrop with deep bokeh.
- **Moods:** `night` (default), `neon`, `golden`, `noon` (light pastel).
- **Moves:** `spiral` (the signature move), `fly-through` (through the tunnel of shapes), `orbit`.
- Best for hooks, intros, logo stings and "concept" beats. Give it a `text` subject for a title.

## Recipes

**App promo, 9:16, ~20 s, no voiceover.**
1. hook: abstract + text (product name, chrome) + spiral, 75 f
2. problem: city night + fly-through, headline, whip, 105 f
3. product: studio + device (real screenshot) + orbit, flash, 120 f
4. benefit: terrain golden + fly-through or space earth + push-in, zoom, 105 f
5. end card: studio golden + text (name, gold) + push-in, subhead = call to action, flash, 105 f

Then run `npm run soundtrack -- --props ... --write` (auto picks `tech`).

**Science explainer, 16:9, 30–60 s, narrated.**
One shot per narration line, in `space` (or `abstract` for concepts). Set `titlePosition: "lower-third"`, a `caption` per shot, and transitions of fade, blur or zoom. Use `look.grade: "cool"`. The soundtrack picks `ambient` and ducks under the voice.

**Brand film or trailer, 16:9.**
Turn on `look.letterbox` and use `grade: "teal-orange"`. Mix terrain golden fly-throughs, city dusk crane-ups and a studio logo. Use slow `cinematic` easing and `--style epic`.

**Story, 9:16, emotional.**
Use text cards with the `aurora` backdrop between city night or terrain dawn shots, with blur and fade transitions, `grade: "warm"` and `--style ambient`.

## Avoiding weak shots
- If the subject is too small in portrait, lower `camera.distance` (0.7–0.85) or raise `lens`.
- If a title is hard to read, move it to `top` or `bottom`, pick a calmer mood, or lower `bloom`.
- If a shot looks static, raise `camera.intensity`, use `orbit`, `spiral` or `fly-through`, or raise `speed`.
- If it is too dark, raise `exposure` (1.2–1.5) or use the `noon` or `golden` mood.
- Don't cut between two shots with the same move and world. Vary at least one of the two.
