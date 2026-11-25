# Contributing

Thanks for helping improve the **AI Marketing Campaign & Video Ad Generator** skill!

## Ways to contribute
- **Model presets**: add a new fal.ai video model to `skills/marketing-campaign-video/references/video-production.md` (endpoint, input fields, strengths, price).
- **Prompt recipes**: realistic-human prompt patterns for new industries (fintech, edtech, D2C, B2B SaaS, local services).
- **Research sources**: better query patterns or sources for a market or language in `references/research-playbook.md`.
- **Scripts**: bug fixes or features in `scripts/generate_video.py` / `scripts/assemble_video.py` (standard library + ffmpeg only, please).
- **Example campaigns**: share a finished campaign folder (no secrets, no real people's likeness).

## Ground rules
1. Keep `SKILL.md` lean (under ~200 lines). Put detail in `references/`.
2. No API keys or `.env` files in commits.
3. Test script changes with `--dry-run` / `--check` and one real render if you can.
4. Keep the guardrails: sourced claims, fictional characters, AI-disclosure label.
5. Validate before opening a PR: `claude plugin validate .`

## Pull requests
Fork → branch (`feat/kling-v4-preset`) → commit → PR with a short description and, for video changes, a frame grab or clip.
