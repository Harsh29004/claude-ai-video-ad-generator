# AGENTS.md

This repository contains an **Agent Skill** (open SKILL.md standard) for AI coding agents such as Codex, Claude Code, Gemini CLI, GitHub Copilot, Cursor, Windsurf, OpenCode, Cline and Roo.

## If a user asks you for a marketing campaign or a video ad
When the user wants a marketing campaign, ad campaign, launch campaign, ad copy, or a promo / UGC / explainer video ad with realistic people for a product, app or service:

1. Read `skills/marketing-campaign-video/SKILL.md` and follow it step by step.
2. Treat `skills/marketing-campaign-video/` as `<skill-dir>`. Scripts are in `<skill-dir>/scripts/` and references in `<skill-dir>/references/`.
3. Write the campaign output to `campaigns/<product-slug>-<date>/` (git-ignored).

## Working on this repository itself
- The skill lives in `skills/marketing-campaign-video/`. Keep `SKILL.md` under ~200 lines and put detail in `references/`.
- Scripts use only the Python standard library + ffmpeg. Test with `generate_video.py --dry-run` and `assemble_video.py --check`.
- `universal/SYSTEM_PROMPT.md` is the chat-app version. Keep it under 8,000 characters and in sync with SKILL.md.
- Never commit `.env` or API keys.
- Build release zips with `python tools/build_release.py` (output in `dist/`, git-ignored).
