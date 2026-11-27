# Contributing

Thanks for helping improve the **Universal Video Generator**!

## Ways to contribute
- **Worlds and subjects:** new procedural 3D environments, subjects and materials in `src/cinematic/`.
- **Camera and edit:** new camera moves, transitions and title styles.
- **Audio:** soundtrack styles and sound design in `scripts/soundtrack.ts`.
- **Example storyboards:** show off a style, language or aspect ratio in `examples/`.

## Ground rules
1. Install dependencies with `npm ci` (Node.js 22+, ffmpeg on `PATH`).
2. Keep animations frame-driven and seeded: no `useFrame` timers, no `Math.random()`, no Suspense loaders (see `AGENTS.md`).
3. Run `npm run typecheck` and `npm test`. For visual changes, include a contact sheet (`npm run review -- --props examples/<file>.json`) and check a full render with `npm run check`.
4. Document new storyboard fields in `skills/cinematic-3d-video/references/storyboard.md`.
5. Do not commit API keys or `.env` files. Only add media you have permission to redistribute.

## Pull requests
Open a PR from a feature branch with a short description and, for visual changes, a frame grab or clip.
