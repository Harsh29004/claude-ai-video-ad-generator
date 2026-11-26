---
name: marketing-campaign-video
description: End-to-end marketing campaign builder. Researches a product, mines real and current user problems from the web (Reddit, app-store and G2 reviews, forums, news), maps each problem to how the product solves it, then turns the strongest angles into a campaign plan, ad copy and a realistic video ad with lifelike AI-generated human characters. The video part covers script, cast, shot prompts, clips generated through fal.ai (Veo 3.1 / Kling) and an ffmpeg-edited final cut with voiceover, ducked background music, captions, transitions, app screens, end card and AI disclosure. Use this skill whenever the user wants a marketing campaign, ad campaign, launch campaign, promo, explainer or UGC-style video ad, ad creatives, or a video with real-looking people for a product, app, SaaS or service. This includes casual asks like "make an ad for our app", "market this product", "create a promo video with people", or a product URL plus "do marketing for this".
compatibility: Any Agent Skills-compatible agent with web search and page fetch. Video rendering also needs a shell, Python 3.8+, ffmpeg/ffprobe on PATH, and a fal.ai API key (FAL_KEY). Without a shell or key the skill delivers a copy-paste prompt pack instead.
license: MIT
metadata:
  author: Harsh29004
  version: "1.2.0"
  repository: https://github.com/Harsh29004/claude-ai-video-ad-generator
---

# Marketing Campaign + Realistic Video Ad

Pipeline, one file per phase. Later phases read your notes instead of re-searching, and the user can stop or resume at any phase:

| Phase | Output | Purpose |
|---|---|---|
| 1 Product research | `01-product-brief.md` | What the product really does, with sources |
| 2 Live problem research | `02-problem-research.md` | What real people struggle with *right now*, with dates and sources |
| 3 Problem → solution map | `03-solution-map.md` | Which pains the product credibly solves, ranked |
| 4 Campaign plan | `04-campaign-plan.md` | Big idea, messaging, hooks, ad copy, channels, tests |
| 5 Video | `05-video/` | Script → cast → `shots.json` → clips → final cut |

In this file, `<skill-dir>` means the folder containing this SKILL.md. All paths are relative to it, which keeps the skill portable across agents (Claude Code, Codex, Gemini CLI, Copilot, Cursor and others). Use the absolute path when running scripts from the campaign folder. Read the references only when you reach the phase that needs them:
- `references/research-playbook.md`: query patterns, sources by product type, scoring (Phases 1–3)
- `references/video-production.md`: model choice, realistic-human prompt formula, `shots.json` format, review loop (Phase 5)
- `references/compliance.md`: claims, synthetic actors and disclosure rules (check before finalizing copy and video)

If the user asks for only part of this (e.g. "just the research", "just the video from this script"), do only that part. Read any existing phase files first and don't redo them.

## Efficiency rules

These matter because a campaign touches dozens of sources and paid video generation. Waste shows up as both time and money.

- **Parallelize.** Send all independent searches and page fetches in a single turn, not one after another.
- **Budget and stop at saturation.** Product research takes about 3–6 searches and 2–4 page reads. Problem research takes about 6–12 searches and up to 6 page reads. Stop early once three searches in a row surface no new problem theme.
- **Write as you go.** Put findings into the phase file right away. Never fetch the same page twice. Search snippets are often enough; fetch only pages that add evidence.
- **Prefer local truth.** If you're inside the product's own repo, read its README, docs, landing-page copy and store-listing metadata (e.g. `fastlane/metadata`) before searching the web. That is cheaper and more accurate.
- **Spend on video last and in steps.** Do a dry run with a cost estimate, then generate the hook shot only as a look check, then the rest. The generation script runs clips, voiceover and music jobs in parallel, caches finished files and resumes interrupted jobs, so never resubmit a finished job without `--force`.
- **Keep the ad tight.** 15–30 s means 3–5 generated shots plus a real app-screen shot plus an end card. Every extra shot costs money and dilutes the message.

## Phase 0: Intake (at most one message)

Get these from the arguments and the conversation: **product** (name, URL or repo), **target market** (country, language, audience), **platform and aspect ratio**, **length**, **render or prompt-pack only**, **brand assets** (logo, real app screenshots or screen recordings, brand colors).

Ask once, in one batched message, and only about what research can't settle. Usually that is the market, the platform, whether to spend on rendering, and asset files. If the product name is ambiguous (several products share it), confirm which one before researching. If the user wants speed or doesn't answer, use these defaults and state them:
- Instagram Reels / TikTok / YouTube Shorts, `9:16`, about 20–30 s
- Market and language inferred from the product site; dialogue in the language the audience actually speaks (e.g. Hinglish for urban India)
- Render a preview of the hook shot only, then ask before rendering the rest

Create `campaigns/<product-slug>-<YYYY-MM-DD>/` in the working directory, plus `05-video/assets/`. Ask the user to drop their logo and 1–3 real app screenshots into `assets/`. Real UI beats any AI-rendered screen (see Phase 5).

## Phase 1: Product research → `01-product-brief.md`

Find out what the product actually does. Sources: official site (home, features, pricing, FAQ, changelog), app-store listings (description, rating, "what's new", recent reviews), docs, press, top 2–3 competitors.

```markdown
# <Product>: Product Brief
**One-liner:** <what it does, for whom, in plain words>
**Category / competitors:** <category> · <competitor 1>, <competitor 2>
**Audience segments:** <segment>: <their job-to-be-done>  (2–4 lines)
## Features → benefits
| Feature | User benefit | Source |
## Proof points (only verifiable ones)
- <rating, user count, award, pricing fact>: <source URL>
## Differentiators vs competitors
## Brand voice & visual cues  (tone, colors, existing taglines)
## Unknowns / don't claim  (things you could not verify)
```

Every feature and proof point needs a source. The ad will make public claims, and an unsourced claim can be false advertising. Anything you can't verify goes under *Unknowns* and stays out of the copy.

## Phase 2: Live problem research → `02-problem-research.md`

Find what people struggle with **now**, in their own words. Use the query patterns and per-category sources in `references/research-playbook.md`. Look at Reddit and forums, competitor app-store or G2/Capterra reviews (1–3 star reviews are gold), Q&A sites, social posts, recent news, and seasonal or timely triggers. Prefer the last 90 days, accept up to 12 months, and label anything older.

```markdown
# Live Problem Research (<date>)
## Problem themes (ranked by evidence)
### P1 <problem in the user's words>
- Who: <segment> · Intensity: <1–5> · Mentions: <count of independent sources>
- Voice of customer: "<≤25-word snippet or paraphrase>" ([source](url), <date>)
- Current workaround & why it fails: <...>
## Timely hooks  (news, seasons, deadlines, trends that make a problem urgent this month)
## Sources  (url · date · type)
```

Treat posts as insight, not ad copy. Paraphrase them and never put real usernames or verbatim posts into an ad: those people didn't consent to being in your marketing.

## Phase 3: Problem → solution map → `03-solution-map.md`

```markdown
| # | Problem | Segment | Pain (1–5) | Frequency (1–5) | Feature that solves it | Fit (0–5) | Score | Proof |
```
Score = Pain × Frequency × Fit. **Fit is 0 if the product doesn't truly solve it.** Be honest: an ad that promises a fix the product can't deliver burns trust and money. Pick the **top 3 angles**. For each, write a one-line *before → after* ("Before: <pain moment>. After: <product moment>."). The top angle drives the video. The other two become hook or ad variants.

## Phase 4: Campaign plan → `04-campaign-plan.md`

```markdown
# <Product> Campaign: "<campaign name>"
## Big idea  (one sentence) · Positioning  (For <who> who <problem>, <product> is the <category> that <benefit>, unlike <alternative>)
## Messaging pillars  (3, each tied to a top angle + its proof)
## Hooks  (5 first-3-second hooks: question, pain-callout, pattern-interrupt, stat, POV)
## Ad copy
- Meta: 3× primary text (first 125 chars carry the message) + 3× headline (≤40 chars)
- TikTok/Reels caption ×3 · YouTube Shorts title ×2
- Google RSA: 5× headline (≤30 chars), 3× description (≤90 chars)
- LinkedIn (if B2B): 2× intro text + headline
## Channel & format plan  (platform, format, aspect, audience targeting, budget split %)
## Creative test plan  (what varies per variant: hook / angle / CTA; one variable at a time)
## KPIs  (hook rate/3-s views, CTR, CPI/CPA, conversion; target ranges as assumptions)
## Launch timeline  (week by week, 2–4 weeks)
```

Count characters for the length-limited fields. Platforms truncate or reject over-length text.

## Phase 5: Video → `05-video/`

Read `references/video-production.md` now. It has the prompt formula for realistic people, the voice and music setup, the model table and the full `shots.json` format. Run the commands below from the campaign folder.

**The deliverable is a real ad:** moving, realistic footage of people (AI-generated clips), a voice (lip-synced dialogue and/or a voiceover), background music under it, captions, transitions, the real app screens and an end card. An animatic, a slideshow of stills, placeholder cards or a silent cut is not a video ad, so never render or hand one off, not even as a "preview". If real clips can't be made yet, stop at the prompt pack and say plainly what's missing.

1. **Script & storyboard → `storyboard.md`.** Use the top angle and this structure: Hook (0–3 s, a person in the pain moment, moving) → Agitate (the failing workaround) → Reveal (the product moment) → Payoff (the after state, visible emotion) → End card (logo, CTA). For each beat give its timing, camera, setting, **who speaks** (on-camera dialogue that Veo lip-syncs, or a voiceover line), the words (about 2.5 words/sec, so ≤18 per 8-s shot), and ambient sound. Every ad also gets background music.
2. **Cast.** Write a *character bible*: 1–3 fictional people who match the target audience (age, ethnicity, region, clothing, hair, distinguishing details, voice or accent). Write the bible once and reuse it verbatim in every shot through `{{name}}` placeholders. That consistency is what keeps the same face across cuts.
3. **Shot list → `shots.json`.** Start from `<skill-dir>/scripts/shots.example.json`. Pace it like a social ad: 3–8 s per shot, the hook is moving footage of a person, and real screenshots (`image` shots) fill at most a third of the runtime and never open the ad. Don't let the video model render app UI or text; it garbles it. Keep the phone screen facing away from the camera, then cut to the real screenshot. **No placeholders:** if the user hasn't supplied screenshots, ask for them. If they can't, drop the `image` shot and carry the product moment in the live-action shot plus a caption. Add `vo` lines, a `voiceover` voice, `music` (an instrumental prompt sized to the ad length + 2 s, or `music.path`) and a `transition`.
4. **Choose the route.**
   - **Route A, automatic (`FAL_KEY` in env or `.env`):** dry run (free): `python "<skill-dir>/scripts/generate_video.py" 05-video/shots.json --dry-run`, and show the user the estimate. Look check: `... --only <hook-id>`, grab a frame (`ffmpeg -ss 2 -i clips/<hook-id>.mp4 -frames:v 1 frame.png`) and inspect the face, hands, lip-sync and artifacts. Once the user approves the spend, run without `--only`; this generates the clips, the voiceover lines and the music in parallel. Re-render a bad shot with `--only <id> --force` after editing its prompt or seed.
   - **Route B, bring your own clips (no key):** write `05-video/prompt-pack.md`. Per shot, give the fully expanded prompt, negative prompt, duration and aspect, where to generate it (Gemini app / Google Flow with Veo, Kling, Sora, Runway), and the exact filename to save as (`clips/<shot-id>.mp4`). Add the voiceover script (the user records it on a phone or makes it in any TTS tool, saved as `audio/vo-<shot-id>.mp3` or set as `vo_path`) and the music (a prompt for a music AI, or a royalty-free track such as the YouTube Audio Library, set as `music.path`). Then **stop and wait** for the files; don't assemble until they exist.
   - **Mixed:** user-made clips + a key for the voice and music only: `--only vo-<id>,music`.
5. **Assemble:** run `python "<skill-dir>/scripts/assemble_video.py" 05-video/shots.json --check` first. It refuses missing clips, missing music, a still hook and slideshow-like cuts. Then render without `--check`. The assembler crops and scales every shot, fades captions in, adds the AI label, crossfades shots, places each voiceover line on its shot, ducks the music under speech, normalizes loudness to −14 LUFS, and writes `final/<project>.mp4` + `.srt`. Then it runs a **quality gate** (loudness, silent gaps, motion per shot). Exit code 3 means QC failed: fix the cause and re-render. Never hand off a video that failed QC.
6. **Review before handoff:** look at 3 frame grabs of the final cut, confirm `QC PASSED`, and report the QC line (loudness, motion) to the user.

## Guardrails

Read `references/compliance.md` before finalizing. In short:
- **Characters are fictional.** Don't create the likeness, name or voice of a real person or celebrity. If the user supplies a photo of a real person (founder, actor) for image-to-video, ask them to confirm that person consented.
- **Dramatization, not fake testimonials.** Characters act out a scenario. Don't present them as real customers ("I've used it for 6 months and…" said as a real review). US FTC rules treat AI-generated fake testimonials as deceptive.
- **Disclose.** Keep the on-screen "AI-generated" disclosure label on (the default in `shots.json`). Several jurisdictions (e.g. New York, since June 2026) and the major ad platforms require labeling realistic synthetic people. The user can change the wording but should keep a label.
- **Claims trace to Phase 1.** No invented stats, ratings, user counts or competitor put-downs. Extra care for health, finance and kids' products.

## Handoff

Finish with a short summary: the top 3 angles with one line each, the campaign name and big idea, the video file path with its QC line (or the prompt-pack path and what the user must generate), the actual spend if rendered, and next steps (assets to swap in, which variant to test first). Link the phase files rather than pasting them.
