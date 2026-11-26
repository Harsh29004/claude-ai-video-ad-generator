<div align="center">

<img src="docs/assets/banner.png" alt="AI agent skill: marketing campaign and video ad generator with realistic human characters, works with Claude, ChatGPT Codex, Gemini, Copilot and Cursor" width="100%">

# AI Marketing Campaign & Video Ad Generator: Agent Skill for Claude, Codex, Gemini, Copilot & Cursor

**Turn any product into a research-backed marketing campaign and a realistic AI video ad with human characters, from one prompt in the AI tool you already use.**

[![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b.svg)](LICENSE)
[![Agent Skills standard](https://img.shields.io/badge/Agent_Skills-SKILL.md_standard-8b5cf6.svg)](https://agentskills.io)
[![Works in 75+ agents](https://img.shields.io/badge/Works_in-75%2B_AI_agents-3b82f6.svg)](#-install)
[![Veo 3.1 | Kling](https://img.shields.io/badge/Video-Veo_3.1_%7C_Kling-ec4899.svg)](#-supported-video-models)
[![GitHub stars](https://img.shields.io/github/stars/Harsh29004/claude-ai-video-ad-generator?style=social)](https://github.com/Harsh29004/claude-ai-video-ad-generator/stargazers)

**Works with:** Claude Code · OpenAI Codex · Gemini CLI · GitHub Copilot · Cursor · Windsurf · OpenCode · Cline · Roo Code · Goose · Kiro · Qwen Code · ChatGPT · Gemini · Claude.ai · Perplexity · any LLM API

[Install](#-install) · [How it works](#-how-it-works) · [Examples](#-example-prompts) · [Video setup](#-render-the-video) · [FAQ](#-faq) · [Website](https://harsh29004.github.io/claude-ai-video-ad-generator/)

</div>

---

`marketing-campaign-video` is an open-source **AI agent skill** built on the open [Agent Skills (SKILL.md) standard](https://agentskills.io). It works like an AI marketing team: it researches what your product does, searches the web for **real problems people are posting about right now**, maps each problem to how your product solves it, writes the **campaign and ad copy**, and produces a **UGC-style AI video ad with lifelike human characters**. Formats cover Instagram Reels, TikTok, YouTube Shorts, YouTube pre-roll and LinkedIn.

It is not tied to one AI. Install it in **Claude Code, Codex, Gemini CLI, Copilot, Cursor and 75+ other agents**, or use the [chat version](universal/) in **ChatGPT, Gemini, Claude.ai or Perplexity**.

## ✨ What it does

| Step | What the skill does | Output |
|---|---|---|
| 1. Product research | Reads your site, app-store listing, docs and competitors | `01-product-brief.md` |
| 2. Live problem research | Mines Reddit, app-store and G2 reviews, forums and news for current pain points, with dates and links | `02-problem-research.md` |
| 3. Problem → solution map | Scores Pain × Frequency × Fit and picks the 3 strongest ad angles | `03-solution-map.md` |
| 4. Campaign plan | Big idea, positioning, hooks, Meta, TikTok, Google and LinkedIn ad copy within character limits, A/B tests, KPIs, timeline | `04-campaign-plan.md` |
| 5. AI video ad | Script, character bible, shot list → realistic clips with **Veo 3.1 / Kling** + **AI voiceover** + **background music** → final cut with transitions, captions, your real app screens, end card, then an automatic quality check | `05-video/final/*.mp4` |

## 🧠 How it works

```mermaid
flowchart LR
    A[Your product<br/>name · URL · repo] --> B[Product research<br/>sourced features]
    B --> C[Live problem research<br/>Reddit · reviews · news]
    C --> D[Problem → solution map<br/>Pain × Frequency × Fit]
    D --> E[Campaign plan<br/>hooks · ad copy · channels]
    E --> F[Storyboard +<br/>character bible]
    F --> G[fal.ai<br/>Veo 3.1 / Kling clips<br/>+ voiceover + music]
    G --> H[ffmpeg edit<br/>transitions · ducked music<br/>captions · end card · QC]
    H --> I[🎬 Final video ad]
```

### Why the videos look real
- **Character bible:** every character (age, region, wardrobe, voice) is written once and reused word for word in every shot, so the same face holds across cuts.
- **UGC realism prompting:** handheld smartphone framing, real light sources, lived-in details, natural skin texture, and **native lip-synced dialogue** in your audience's language (English, Hindi, Hinglish, Spanish…).
- **No fake UI:** AI models garble app screens, so the skill shows your **real screenshots** with a smooth zoom instead.
- **Look check first:** only the hook shot is rendered first, so you approve the character before paying for the rest.

## ⚡ Features

- 🌐 **Universal**: one open-standard skill for 75+ AI agents, plus a chat version for ChatGPT, Gemini and Claude.ai
- 🔍 **Real-time market research**: current, dated voice-of-customer pain points, not guesses
- 🎯 **Honest problem–solution fit scoring**: no promises your product can't keep
- ✍️ **Ready-to-run ad copy** for Meta, TikTok, YouTube, Google RSA and LinkedIn, length-checked
- 🎬 **Realistic AI video ads** with human characters and lip-synced dialogue (Veo 3.1, Kling)
- 🎙️ **Voiceover + background music**: AI voiceover in Hindi, English and more (MiniMax, ElevenLabs), generated instrumental music that dips automatically under speech, mixed to -14 LUFS
- ✅ **Quality gate**: never ships a slideshow, placeholder or silent cut. Every render is checked for real motion, loudness and silent gaps
- 🌏 **Any market and language**: dialogue and captions in your audience's own language
- 💸 **Cost control**: dry-run cost estimate, cached clips, resumable jobs, so you never pay twice
- 📱 **All formats**: 9:16 Reels, TikTok and Shorts, 16:9 YouTube and LinkedIn, 1:1 and 4:5 feed
- 🛡️ **Compliance built in**: sourced claims, fictional characters, an AI-disclosure label
- 🧩 **Zero-dependency scripts**: Python standard library + ffmpeg only

## 🚀 Install

### Option 1: Any AI coding agent, one command (recommended)

Uses the open-source [`skills` CLI](https://github.com/vercel-labs/skills), which detects your installed agents (Claude Code, Codex, Gemini CLI, GitHub Copilot, Cursor, Windsurf, OpenCode, Cline, Roo, Goose, Kiro and 70+ more):

```bash
npx skills add Harsh29004/claude-ai-video-ad-generator
```

Install globally (all projects) or for one specific agent:

```bash
npx skills add Harsh29004/claude-ai-video-ad-generator -g            # all projects
npx skills add Harsh29004/claude-ai-video-ad-generator -a codex      # just Codex
npx skills add Harsh29004/claude-ai-video-ad-generator -a gemini-cli # just Gemini CLI
```

<sub>Needs Node.js 22+. Agent ids include `claude-code`, `codex`, `gemini-cli`, `github-copilot`, `cursor`, `windsurf`, `opencode`, `cline`, `roo`, `goose`, `kiro-cli`, `qwen-code`.</sub>

### Option 2: Claude Code plugin

```text
/plugin marketplace add Harsh29004/claude-ai-video-ad-generator
/plugin install marketing-campaign-video@harsh29004-skills
```

### Option 3: Copy the folder manually

```bash
git clone https://github.com/Harsh29004/claude-ai-video-ad-generator.git
```

Copy `skills/marketing-campaign-video/` into your agent's skills folder:

| Agent | Project folder | Global folder |
|---|---|---|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| OpenAI Codex | `.agents/skills/` | `~/.agents/skills/` |
| Gemini CLI | `.agents/skills/` | `~/.gemini/skills/` |
| GitHub Copilot | `.agents/skills/` | `~/.copilot/skills/` |
| Cursor | `.agents/skills/` | `~/.cursor/skills/` |
| Windsurf | `.windsurf/skills/` | `~/.codeium/windsurf/skills/` |
| OpenCode | `.agents/skills/` | `~/.config/opencode/skills/` |
| Cline | `.agents/skills/` | `~/.agents/skills/` |
| Roo Code | `.roo/skills/` | `~/.roo/skills/` |
| Goose | `.goose/skills/` | `~/.config/goose/skills/` |

<sub>Paths per the `skills` CLI agent table (Nov 2026). Check your agent's docs if it moved.</sub>

<details>
<summary>Windows (PowerShell) example for Claude Code</summary>

```powershell
git clone https://github.com/Harsh29004/claude-ai-video-ad-generator.git
Copy-Item -Recurse claude-ai-video-ad-generator\skills\marketing-campaign-video "$HOME\.claude\skills\"
```
</details>

### Option 4: ChatGPT, Gemini, Claude.ai, Perplexity (chat apps)

Download **`chat-assistant-kit.zip`** from [Releases](https://github.com/Harsh29004/claude-ai-video-ad-generator/releases/latest). Paste `SYSTEM_PROMPT.md` as the instructions of a **Custom GPT**, **Gemini Gem**, **Claude Project** or **Perplexity Space**, and upload the knowledge files. Step-by-step: [universal/README.md](universal/README.md).

On Claude.ai you can also upload `marketing-campaign-video.zip` in Skills settings to get the full skill.

## 💬 Example prompts

Just describe what you want. The skill triggers on its own in any agent:

```text
Make a full marketing campaign and a Reels video ad for FitPulse, our Android app that builds
20-minute home workouts from the equipment you have. Target: working people 22–35 in Indian metros.
```

```text
Build a launch campaign for our invoicing SaaS for freelancers in the US/UK. LinkedIn + YouTube
pre-roll, 16:9, 30 seconds. Make the ad feel like a real person at their desk.
```

```text
bhai meri app ke liye ek marketing campaign aur real logon wala video ad bana do, Instagram Reels ke liye
```

## 📁 What you get

```text
campaigns/fitpulse-2026-11-25/
├── 01-product-brief.md        # features, proof points, competitors (all sourced)
├── 02-problem-research.md     # live pain points with links + dates
├── 03-solution-map.md         # scored problem → feature map, top 3 angles
├── 04-campaign-plan.md        # big idea, hooks, ad copy, channels, tests, KPIs
└── 05-video/
    ├── storyboard.md          # beats, dialogue, camera, timing
    ├── shots.json             # character bible + shot prompts
    ├── prompt-pack.md         # copy-paste prompts (when you have no API key)
    ├── clips/                 # generated clips
    └── final/fitpulse-reels-v1.mp4 + .srt
```

## 🎬 Render the video

Works in any agent that can run terminal commands.

1. Install **Python 3.8+** and **[ffmpeg](https://ffmpeg.org/download.html)**.
2. Get a **fal.ai API key** (fal.ai → Dashboard → Keys) and add it to a `.env` file in your project:
   ```text
   FAL_KEY=your-key-here
   ```
3. Put your **logo** and **1–3 real app screenshots** in `05-video/assets/`.

The agent runs these for you, but you can also run them yourself (`<skill-dir>` = where the skill is installed):

```bash
# Free: validate the shot list and see the cost estimate
python <skill-dir>/scripts/generate_video.py 05-video/shots.json --dry-run

# Look check: render only the hook shot first
python <skill-dir>/scripts/generate_video.py 05-video/shots.json --only s01-hook

# Render everything: clips + voiceover + music (cached files are skipped, interrupted jobs resume)
python <skill-dir>/scripts/generate_video.py 05-video/shots.json

# Edit: transitions, voiceover, ducked music, captions, app screens, end card, AI label → MP4 + SRT + QC
python <skill-dir>/scripts/assemble_video.py 05-video/shots.json
```

**No API key? Bring your own clips.** The skill writes a `prompt-pack.md` with exact prompts for the Gemini app / Google Flow (Veo), Kling, Sora or Runway, plus a voiceover script and a music prompt. Save the clips as `05-video/clips/<shot-id>.mp4`, add your recorded voiceover and a royalty-free track, and the assembler does the full edit. In chat apps, follow the same pack in CapCut or Premiere.

### 🎥 Supported video models

| Model (fal.ai endpoint) | Best for | Approx. cost* |
|---|---|---|
| `fal-ai/veo3.1` (default) | Most realistic people, native lip-synced dialogue, 4–8 s shots, up to 4K | ~$0.40/s → ~$8 for a 20 s ad |
| `fal-ai/kling-video/v3/pro/text-to-video` | Longer 3–15 s shots, multi-shot, 1:1 | see fal.ai |
| `fal-ai/kling-video/v3/pro/image-to-video` | Keeping one face consistent from a reference image | see fal.ai |
| Any other fal.ai video endpoint | Set `model` and its `input` in `shots.json` | see fal.ai |
| `fal-ai/minimax/speech-02-hd` (voiceover) | Natural voiceover, Hindi + English + more, emotion control | see fal.ai |
| `fal-ai/elevenlabs/music` (music) | Instrumental background music cut to the exact ad length | see fal.ai |

<sub>*Snapshot from Nov 2026. Check current pricing on fal.ai. The dry run always shows the estimate before you spend anything.</sub>

## 🛡️ Responsible AI

- Characters are **fictional**. Never use a real person's or celebrity's likeness without consent.
- Characters **act out a scenario**; they are never presented as real customers giving fake testimonials (US FTC 16 CFR Part 465).
- An **"AI-generated dramatization"** label is on by default (New York's synthetic-performer disclosure law and platform AI-content labels).
- Every product claim traces to a **source** found in research.

## ❓ FAQ

<details>
<summary><b>What is an Agent Skill?</b></summary>

An Agent Skill is a folder with a `SKILL.md` file (instructions) plus optional scripts and references, following the open [Agent Skills standard](https://agentskills.io). Agents such as Claude Code, Codex, Gemini CLI, GitHub Copilot and Cursor load it automatically when a task needs it. This one teaches the agent a full marketing workflow, from research to finished video ad.
</details>

<details>
<summary><b>Does it work with ChatGPT, Gemini or Copilot, or only Claude?</b></summary>

All of them. Coding agents (Codex, Gemini CLI, Copilot, Cursor, Claude Code and 70+ more) install the skill with `npx skills add Harsh29004/claude-ai-video-ad-generator`. Chat apps (ChatGPT, Gemini, Claude.ai, Perplexity) use the [chat version](universal/) as custom instructions.
</details>

<details>
<summary><b>How do I generate an AI video ad with real-looking people?</b></summary>

Install the skill, add a fal.ai key, and ask your agent: "make a video ad for &lt;your product&gt;". It writes the script and character bible, generates clips with Veo 3.1 or Kling, and assembles the final MP4 with captions and your real app screenshots.
</details>

<details>
<summary><b>Is it free?</b></summary>

The skill is free and open source (MIT). Research and campaign writing use your AI tool's plan. Video generation is paid per second by fal.ai (about $8 for a 20-second Veo 3.1 ad). Without a key you get a free prompt pack to use in any video tool.
</details>

<details>
<summary><b>Does it work for Instagram Reels, TikTok and YouTube Shorts?</b></summary>

Yes. The default is 9:16 vertical, 20–30 seconds, with captions. 16:9, 1:1 and 4:5 are supported too.
</details>

<details>
<summary><b>Can the characters speak Hindi, Hinglish or other languages?</b></summary>

Yes. Dialogue is written in your audience's language and Veo 3.1 lip-syncs it. Captions can use any script (set a font that covers it, e.g. Devanagari).
</details>

<details>
<summary><b>Which AI video model is best for realistic humans?</b></summary>

As of Nov 2026, Veo 3.1 gives the most realistic people with native dialogue. Kling v3 is great for longer shots and image-to-video face consistency. Both run through one fal.ai key.
</details>

## 🗺️ Roadmap

- [ ] MCP server so any MCP client can call the generate and assemble tools
- [ ] Auto-generate character reference stills for image-to-video consistency
- [ ] Voice-over mode with separate TTS track
- [ ] Multi-aspect export (9:16 + 16:9 + 1:1) in one run
- [ ] More skills: landing-page copy, email sequences, social calendar

Ideas welcome: [open an issue](https://github.com/Harsh29004/claude-ai-video-ad-generator/issues).

## 🤝 Contributing

PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Good first contributions: new model presets, prompt recipes for new industries, translations, example campaigns.

## ⭐ Support

If this skill saved you time or money, **star the repo**. It helps other marketers and builders find it.

[![Star History Chart](https://api.star-history.com/svg?repos=Harsh29004/claude-ai-video-ad-generator&type=Date)](https://star-history.com/#Harsh29004/claude-ai-video-ad-generator&Date)

## 👤 Author

Built by **[Harsh29004](https://github.com/Harsh29004)**. Follow on GitHub for more AI marketing skills.

## 📄 License

[MIT](LICENSE). Free to use, modify and share.

<sub>Not affiliated with Anthropic, OpenAI, Google, GitHub, Cursor, Kuaishou or fal.ai. All product names are trademarks of their respective owners.</sub>
