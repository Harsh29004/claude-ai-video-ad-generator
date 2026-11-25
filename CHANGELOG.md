# Changelog

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
