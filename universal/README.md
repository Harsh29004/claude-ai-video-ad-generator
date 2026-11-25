# Use it in any AI chat app (ChatGPT, Gemini, Claude.ai, Perplexity, Copilot…)

Chat apps can't load skill folders, so this folder has a **chat version** of the skill:

| File | Use it as |
|---|---|
| [`SYSTEM_PROMPT.md`](SYSTEM_PROMPT.md) | The assistant's **instructions** (about 6.5k characters, under ChatGPT's 8k limit) |
| [`../skills/marketing-campaign-video/references/research-playbook.md`](../skills/marketing-campaign-video/references/research-playbook.md) | Knowledge file: query patterns and scoring |
| [`../skills/marketing-campaign-video/references/video-production.md`](../skills/marketing-campaign-video/references/video-production.md) | Knowledge file: realistic-human prompting, models |
| [`../skills/marketing-campaign-video/references/compliance.md`](../skills/marketing-campaign-video/references/compliance.md) | Knowledge file: claims and AI-disclosure checklist |
| [`../skills/marketing-campaign-video/scripts/shots.example.json`](../skills/marketing-campaign-video/scripts/shots.example.json) | Knowledge file: an example shot list |

Shortcut: download **`chat-assistant-kit.zip`** from the [latest release](https://github.com/Harsh29004/claude-ai-video-ad-generator/releases/latest). It contains all five files.

In chat apps the skill does the research, campaign and a **ready-to-paste video prompt pack**. To render the video automatically, use an agent with a terminal (see the main README).

## ChatGPT (Custom GPT)
1. ChatGPT → **Explore GPTs → Create → Configure**.
2. **Instructions:** paste the contents of `SYSTEM_PROMPT.md`.
3. **Knowledge:** upload the four knowledge files.
4. **Capabilities:** turn on **Web Search** (required for live research). Code Interpreter is optional.
5. Name it, e.g. "AI Campaign & Video Ad Generator", and save. You can also publish it to the GPT Store.

## Google Gemini (Gem)
1. Gemini → **Gems → New Gem**.
2. Paste `SYSTEM_PROMPT.md` into **Instructions** and add the knowledge files.
3. Save, then ask: *"Make a marketing campaign and Reels video ad for <your product>."*

## Claude.ai
- **Best:** upload `marketing-campaign-video.zip` (from Releases) in claude.ai's Skills settings. That's the full skill.
- **Or:** create a **Project**, paste `SYSTEM_PROMPT.md` as project instructions, and add the knowledge files.

## Perplexity (Spaces), Microsoft Copilot, Poe, Mistral Le Chat, DeepSeek and others
Any assistant that supports **custom instructions + file uploads + web search** works. Paste `SYSTEM_PROMPT.md` as the instructions and attach the knowledge files. If the app has no file uploads, the system prompt alone still runs the full workflow.

## API / your own app (OpenAI, Gemini, Claude, open-source models)
Send `SYSTEM_PROMPT.md` as the **system message** and give the model a web-search tool. For video, let your backend run `scripts/generate_video.py` (fal.ai) and `scripts/assemble_video.py` (ffmpeg) from the skill folder.
