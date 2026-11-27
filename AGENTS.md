# AGENTS.md

This repository is a **TypeScript + Remotion + three.js engine for cinematic 3D videos**. The agent workflow for making a video lives in [skills/cinematic-3d-video/SKILL.md](skills/cinematic-3d-video/SKILL.md). Read it when asked to make or edit a video.

## Making videos
- Storyboards are JSON validated by `src/project.ts`. Examples are in `examples/`; put new ones in `projects/` (git-ignored).
- `npm run validate -- file.json` → `npm run soundtrack -- --props file.json --write` → `npm run review -- --props file.json` → `npx remotion render src/index.ts UniversalVideo out/x.mp4 --props=file.json --concurrency=4` → `npm run check -- out/x.mp4`.
- Never deliver a video that fails `check` (frozen picture or silent audio).

## Changing the engine
- Keep animation frame-driven: compute everything from `useCurrentFrame()` (or the `t` and `progress` passed to worlds). Do not animate inside `useFrame`, and do not use React Suspense loaders. Load assets with `useImageTexture` and `useGltf` from `src/cinematic/assets.ts`.
- All randomness comes from `rng(seed)` or `noise2`/`noise3` in `src/cinematic/math.ts`.
- New storyboard vocabulary goes in `src/cinematic/vocab.ts` and the schema, and must be documented in `skills/cinematic-3d-video/references/`.
- Run `npm run typecheck` and `npm test` before submitting. For visual changes, attach a contact sheet from `npm run review`.
- Never commit `.env` files or API keys.
