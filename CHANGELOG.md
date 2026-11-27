# Changelog

## [2.0.0] - 2026-11-27
### Added
- **Cinematic 3D shots** (`type: "cinematic"`): five procedural worlds, each with its own moods.
  - `studio`: glossy floor, softbox reflections, light shafts.
  - `space`: planets lit by a real sun, Milky Way, orbiting moon, sun-angle phase sweeps.
  - `city`: lit towers, traffic, neon, wet reflective avenue.
  - `terrain`: mountains, river, physical sky, clouds.
  - `abstract`: motion-graphics forms with bokeh.
- **Subjects:** phones, tablets and laptops showing your real screenshot; extruded 3D titles; glTF models with frame-locked animation; procedural planets (Earth, Moon, Mars, gas giant, ice, lava); sculptural shapes in 8 PBR materials.
- **Camera:** 13 moves with intensity, focal length, easing and handheld shake.
- **Film pipeline:** HDR bloom, depth of field, ACES/AgX/Neutral tone mapping, chromatic aberration, vignette, FXAA, plus GPU particles (dust, sparks, embers, snow, rain, bokeh, fireflies).
- **Edit:** fade, flash, zoom, whip, blur, slide and wipe transitions; word-by-word animated titles; captions; Ken Burns on images and footage; animated text cards; project-wide grain, vignette, letterbox and colour grades.
- **Audio:** per-scene voiceovers that stretch their scene to fit; music ducking; `npm run soundtrack`, an offline, royalty-free score and SFX generator.
- **Quality tools:** `npm run validate`, `npm run review` (contact sheet) and `npm run check` (fails frozen pictures or silent audio, reports LUFS).
- **The `cinematic-3d-video` Agent Skill** (`skills/`), which takes an agent from prompt to finished, checked MP4.
- **Examples:** `moon-phases-3d` (the moon explainer rebuilt in 3D with its Hindi narration) and `cinematic-reel` (a vertical showcase), each with a generated score.
- The general-purpose TypeScript and Remotion engine for validated storyboards (2D and 3D scenes, MP4 export) that this release builds on.

### Changed
- The original `three` scene now renders through the cinematic studio.
- The text, image and video scenes now always move.
- The existing examples now use transitions, 3D shots and soundtracks.

### Removed
- Retired the old marketing-campaign-video skill, its Python fal.ai pipeline, plugin, chat kit and release builder.

### Fixed
- 3D scenes rendered a single spinning object against a flat background with a locked camera, so videos looked static.
- Lighting:
  - The `flash` transition no longer cuts to a pure-white frame. It is now a soft light burst.
  - Planets get an earthshine fill, so their night sides keep their shape.
  - The studio has a lit backdrop, plus brighter key and fill lights.
  - Night cities are brighter.
  - Exposure is retuned per world.
  - `npm run check` now warns about stretches too dark to read on a phone, and about near-white flash frames.

## [1.2.0] - 2026-11-26
### Added
- **Voiceover:** per-shot `vo` lines generated with fal.ai TTS (default MiniMax Speech-02 HD with Hindi support; ElevenLabs as an alternative), or your own recording via `vo_path` / `voiceover.path`.
- **Background music:** generated instrumental music (default ElevenLabs Music, sized to the ad length) or your own track. It is ducked automatically under speech.
- **Pro edit:** xfade transitions, captions that fade in, a clip sound bed under the voiceover, and loudness normalized to -14 LUFS.
- **Quality gate:** after rendering, loudness, silent gaps and per-shot motion are measured. Silent or static output fails with exit code 3.
- **Route B (bring your own clips):** a prompt pack for the Gemini app / Flow / Kling / Sora / Runway, plus a voiceover script and music, then automatic editing.

### Fixed
- The skill could deliver an animatic of placeholder cards, or a silent slideshow, when clips weren't generated. Placeholders are now forbidden: `--check` refuses a still hook, slideshow-like cuts (stills > 35%), missing clips and missing music, and the quality gate rejects frozen "clips".

## [1.1.0] - 2026-11-25
### Added
- Universal support: the skill follows the open Agent Skills (SKILL.md) standard with no Claude-only variables, so it installs in Claude Code, OpenAI Codex, Gemini CLI, GitHub Copilot, Cursor, Windsurf, OpenCode, Cline, Roo and 70+ agents via `npx skills add Harsh29004/claude-ai-video-ad-generator`.
- `universal/SYSTEM_PROMPT.md`: a chat version for ChatGPT Custom GPTs, Gemini Gems, Claude Projects, Perplexity Spaces and any LLM API (under 8k characters).
- `chat-assistant-kit.zip` release download and `tools/build_release.py`.
- `AGENTS.md` so any coding agent working in a clone finds the skill.

## [1.0.0] - 2026-11-25
### Added
- `marketing-campaign-video` skill: product research → live problem research → problem/solution map → campaign plan → realistic AI video ad.
- `generate_video.py`: parallel, cached and resumable clip generation through the fal.ai queue API (Veo 3.1, Kling or any fal video endpoint), with dry-run cost estimates.
- `assemble_video.py`: ffmpeg assembly with captions, real app screenshots (blurred backdrop + zoom), end card, AI-disclosure label, music bed and SRT export.
- Claude Code plugin + marketplace manifests for one-command install.
- Research playbook, realistic-human video prompting guide, compliance checklist, and 3 eval cases.
