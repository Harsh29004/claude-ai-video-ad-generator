# AGENTS.md

This repository contains a general-purpose **TypeScript + Remotion video engine**.

## General video projects
- Define storyboards with the contract in `src/project.ts`; see `examples/` for renderable examples.
- Use `npm run studio` to preview and `npm run render -- out/video.mp4 --props=./path/to/storyboard.json` to export.
- Keep animations frame-driven so previews can be scrubbed and renders are repeatable.
- Run `npm run typecheck` and `npm test` before submitting engine changes.

- Never commit `.env` or API keys.
