#!/usr/bin/env python3
"""Build the release downloads into dist/ (run from anywhere):

  dist/marketing-campaign-video.zip  the full Agent Skill folder (Claude.ai upload, manual installs)
  dist/chat-assistant-kit.zip        SYSTEM_PROMPT.md + knowledge files for ChatGPT, Gemini and other chat apps
"""
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL = ROOT / "skills" / "marketing-campaign-video"
DIST = ROOT / "dist"
SKIP = {"__pycache__", ".work", ".env"}


def build_skill_zip():
    out = DIST / "marketing-campaign-video.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(SKILL.rglob("*")):
            if p.is_file() and not (set(p.parts) & SKIP) and p.suffix != ".pyc":
                z.write(p, p.relative_to(SKILL.parent).as_posix())
    return out


def build_chat_kit():
    out = DIST / "chat-assistant-kit.zip"
    files = {
        "SYSTEM_PROMPT.md": ROOT / "universal" / "SYSTEM_PROMPT.md",
        "HOW_TO_USE.md": ROOT / "universal" / "README.md",
        "knowledge/research-playbook.md": SKILL / "references" / "research-playbook.md",
        "knowledge/video-production.md": SKILL / "references" / "video-production.md",
        "knowledge/compliance.md": SKILL / "references" / "compliance.md",
        "knowledge/shots.example.json": SKILL / "scripts" / "shots.example.json",
    }
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for arc, src in files.items():
            z.write(src, f"chat-assistant-kit/{arc}")
    return out


if __name__ == "__main__":
    DIST.mkdir(exist_ok=True)
    for path in (build_skill_zip(), build_chat_kit()):
        with zipfile.ZipFile(path) as z:
            assert z.testzip() is None
            print(f"{path.relative_to(ROOT)}  {path.stat().st_size / 1024:.1f} KB  {len(z.namelist())} files")
