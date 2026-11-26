# Contributing

Thanks for helping improve the **Universal Video Generator**!

## Ways to contribute
- **Scene types**: add reusable 2D or 3D scenes with a validated storyboard contract.
- **Timeline and rendering**: improve playback, media support, and exports.
- **Example storyboards**: demonstrate a video style, language, or aspect ratio in `examples/`.

## Ground rules
1. Install dependencies with `npm ci` (Node.js 22+).
2. Keep animations frame-driven, and add tests for storyboard validation changes.
3. Run `npm run typecheck` and `npm test`. For visual changes, check `npm run studio` and export a demo with `npm run render -- out/space-explainer.mp4`.
4. Do not commit API keys or `.env` files. Only share media you have permission to redistribute.

## Pull requests
Open a PR from a feature branch with a short description and, for visual changes, a frame grab or clip.
