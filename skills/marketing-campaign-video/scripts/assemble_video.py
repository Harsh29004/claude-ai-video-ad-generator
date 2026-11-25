#!/usr/bin/env python3
"""Assemble generated clips, real app screens and an end card into the final ad (ffmpeg).

Usage:
  python assemble_video.py SHOTS_JSON [--check] [--out final/name.mp4] [--no-captions] [--keep-work]

  --check        Print the edit plan and list missing files; renders nothing.
  --no-captions  Skip burned-in captions (an .srt is still written).

Per shot:
  generate -> clips/<id>.mp4 (from generate_video.py or dropped in by hand)
  image    -> a still (e.g. app screenshot) over a blurred backdrop with a slow zoom
  clip     -> an existing video (e.g. a screen recording)
Every segment is normalized to the same size/fps/codec, gets its caption and the AI
disclosure label, then all are joined losslessly. Writes final/<project>.mp4 and .srt.
Requires ffmpeg + ffprobe on PATH. Standard library only.
"""
import argparse
import json
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

SIZES = {
    ("9:16", "1080p"): (1080, 1920), ("9:16", "720p"): (720, 1280),
    ("16:9", "1080p"): (1920, 1080), ("16:9", "720p"): (1280, 720),
    ("1:1", "1080p"): (1080, 1080), ("1:1", "720p"): (720, 720),
    ("4:5", "1080p"): (1080, 1350), ("4:5", "720p"): (720, 900),
}
FONT_CANDIDATES = [
    "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]
ENC_V = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p"]
ENC_A = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]


def die(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


def run(cmd, cwd):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        die(f"ffmpeg failed:\n  {' '.join(map(str, cmd))}\n{r.stderr[-2500:]}")


def probe(path: Path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
                        "-of", "json", str(path)], capture_output=True, text=True)
    data = json.loads(r.stdout or "{}")
    dur = float(data.get("format", {}).get("duration") or 0)
    has_audio = any(s.get("codec_type") == "audio" for s in data.get("streams", []))
    return dur, has_audio


def planned_seconds(shot):
    if shot.get("duration"):
        return float(shot["duration"])
    d = str(shot.get("input", {}).get("duration", "")).lower().rstrip("s").strip()
    try:
        return float(d)
    except ValueError:
        return 0.0


def shot_source(shot, base: Path):
    t = shot.get("type", "generate")
    if t == "generate":
        return base / "clips" / f"{shot['id']}.mp4"
    return base / shot.get("path", "")


def shot_captions(shot, dur):
    if shot.get("captions"):
        return [(c["text"], float(c.get("start", 0.2)), float(c.get("end", dur - 0.1)))
                for c in shot["captions"] if c.get("text")]
    if shot.get("caption"):
        return [(shot["caption"], 0.2, max(0.4, dur - 0.1))]
    return []


class Overlay:
    """Builds drawtext filters. Text goes through files and the font is copied into the work
    dir under a plain name, so no path or text ever needs filtergraph escaping (Windows-safe)."""

    def __init__(self, work: Path, W: int, H: int, font_name: str):
        self.work, self.W, self.H, self.font, self.n = work, W, H, font_name, 0

    def text(self, content, size, anchor=("center", 0.5), color="white", box="black@0.55",
             enable=None, wrap=True):
        """One drawtext per line: recent ffmpeg drawtext renders '\\n' as a box glyph, and
        per-line boxes are the familiar social-caption look anyway. anchor = (center|top|bottom,
        fraction of frame height) for the whole text block."""
        per_line = max(12, int(self.W * 0.84 / (size * 0.55)))
        lines = (textwrap.wrap(content, per_line) if wrap else [content]) or [content]
        if len(lines) > 1:  # balance line lengths so no single orphan word hangs on the last line
            even = textwrap.wrap(content, -(-len(content) // len(lines)) + 4)
            if len(even) == len(lines):
                lines = even
        pad = max(4, int(size * 0.3))
        lh = int(size * 1.15) + 2 * pad + max(2, int(size * 0.12))
        block = len(lines) * lh
        kind, frac = anchor
        top = {"top": frac * self.H, "bottom": frac * self.H - block}.get(kind, frac * self.H - block / 2)
        filters = []
        for k, line in enumerate(lines):
            self.n += 1
            name = f"t{self.n:03d}.txt"
            with open(self.work / name, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(line)
            y0 = int(top + k * lh)
            f = (f"drawtext=fontfile={self.font}:textfile={name}:expansion=none:fontsize={size}"
                 f":fontcolor={color}:x=(w-text_w)/2:y={y0 + pad}")
            if box:
                f += f":box=1:boxcolor={box}:boxborderw={pad}"
            if enable:
                f += f":enable='{enable}'"
            filters.append(f)
        return ",".join(filters)


def disclosure_filter(ov: Overlay, disc: dict):
    text = (disc or {}).get("text", "")
    if not text:
        return []
    size = max(16, int(min(ov.W, ov.H) * 0.026))
    anchor = ("top", 0.03) if disc.get("position", "top") == "top" else ("bottom", 0.97)
    return [ov.text(text, size, anchor, color="white@0.9", box="black@0.35", wrap=False)]


def caption_filters(ov: Overlay, caps, pos):
    size = max(22, int(min(ov.W, ov.H) * 0.05))
    return [ov.text(t, size, ("center", pos), enable=f"between(t,{a:.2f},{b:.2f})") for t, a, b in caps]


def build_segment(i, shot, base, work, W, H, fps, ov, spec, with_caps):
    t = shot.get("type", "generate")
    src = shot_source(shot, base)
    out = work / f"seg_{i:02d}.mp4"

    # Work out the real segment length first, so caption timing matches what is rendered.
    if t == "image":
        dur, start, has_audio = float(shot.get("duration") or 3), 0.0, False
    else:
        clip_dur, has_audio = probe(src)
        trim = shot.get("trim") or [0, None]
        start = float(trim[0] or 0)
        end = float(trim[1]) if len(trim) > 1 and trim[1] else clip_dur
        plan = planned_seconds(shot)
        dur = min(end - start, plan) if plan else end - start
        dur = min(dur, clip_dur - start)
        if dur <= 0.1:
            die(f"shot {shot['id']}: nothing left after trim (clip is {clip_dur:.2f}s)")

    texts = []
    if with_caps and spec.get("captions", {}).get("enabled", True):
        pos = float(spec.get("captions", {}).get("position", 0.72))
        texts += caption_filters(ov, shot_captions(shot, dur), pos)
    texts += disclosure_filter(ov, spec.get("disclosure", {"text": "AI-generated dramatization"}))
    tail = ("," + ",".join(texts)) if texts else ""
    fw, fh = int(W * 0.86) // 2 * 2, int(H * 0.86) // 2 * 2

    def layout(fit):
        if fit == "cover":
            return f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1[base];"
        return (f"[0:v]split=2[a][b];[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
                f"gblur=sigma=40,eq=brightness=-0.10[bg];"
                f"[b]scale={fw}:{fh}:force_original_aspect_ratio=decrease:force_divisible_by=2[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[base];")

    if t == "image":
        zoom = shot.get("motion", "zoom") == "zoom"
        frames = int(round(dur * fps))
        motion = (f"[base]scale={W * 2}:{H * 2},zoompan=z='1+0.06*on/{max(frames, 1)}':d=1"
                  f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={fps}[m];" if zoom
                  else f"[base]fps={fps}[m];")
        fc = layout(shot.get("fit", "contain")) + motion + f"[m]format=yuv420p{tail}[v]"
        cmd = ["ffmpeg", "-y", "-loop", "1", "-framerate", str(fps), "-t", f"{dur}", "-i", str(src),
               "-f", "lavfi", "-t", f"{dur}", "-i", "anullsrc=r=48000:cl=stereo",
               "-filter_complex", fc, "-map", "[v]", "-map", "1:a"]
    else:
        vol = float(shot.get("volume", 1.0))
        fc = layout(shot.get("fit", "cover")) + f"[base]fps={fps},format=yuv420p{tail}[v]"
        cmd = ["ffmpeg", "-y", "-ss", f"{start}", "-t", f"{dur}", "-i", str(src)]
        if has_audio:
            fc += f";[0:a]aresample=48000,aformat=channel_layouts=stereo,volume={vol},apad[a]"
            amap = "[a]"
        else:
            cmd += ["-f", "lavfi", "-t", f"{dur}", "-i", "anullsrc=r=48000:cl=stereo"]
            amap = "1:a"
        cmd += ["-filter_complex", fc, "-map", "[v]", "-map", amap]
    cmd += ["-t", f"{dur}", "-r", str(fps), *ENC_V, *ENC_A, "-movflags", "+faststart", out.name]
    run(cmd, work)
    return out


def build_end_card(i, ec, base, work, W, H, fps, ov, spec):
    dur = float(ec.get("duration", 3))
    bg, fg = ec.get("bg", "#111827"), ec.get("fg", "#FFFFFF")
    accent, cta_fg = ec.get("accent", fg), ec.get("cta_fg", bg)
    out = work / f"seg_{i:02d}.mp4"
    m = min(W, H)
    cmd = ["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c={bg}:s={W}x{H}:r={fps}:d={dur}",
           "-f", "lavfi", "-t", f"{dur}", "-i", "anullsrc=r=48000:cl=stereo"]
    logo = base / ec["logo"] if ec.get("logo") else None
    if logo and logo.is_file():
        cmd += ["-loop", "1", "-framerate", str(fps), "-t", f"{dur}", "-i", str(logo)]
        fc = (f"[2:v]scale={int(m * 0.36)}:-1[lg];[0:v][lg]overlay=(W-w)/2:H*0.33-h/2[c];[c]")
        head_y = 0.52
    else:
        fc, head_y = "[0:v]", 0.42
    texts = []
    if ec.get("headline"):
        texts.append(ov.text(ec["headline"], int(m * 0.075), ("center", head_y), color=fg, box=None))
    if ec.get("cta"):
        texts.append(ov.text(ec["cta"], int(m * 0.045), ("center", head_y + 0.11), color=cta_fg, box=accent))
    texts += disclosure_filter(ov, {**spec.get("disclosure", {"text": "AI-generated dramatization"}),
                                    "position": "bottom"})
    fc += ",".join(["format=yuv420p", *texts, "fade=t=in:st=0:d=0.35", "setsar=1"]) + "[v]"
    cmd += ["-filter_complex", fc, "-map", "[v]", "-map", "1:a", "-t", f"{dur}", "-r", str(fps),
            *ENC_V, *ENC_A, "-movflags", "+faststart", out.name]
    run(cmd, work)
    return out


def srt_time(s):
    ms = int(round(s * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("shots")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--out")
    ap.add_argument("--no-captions", action="store_true")
    ap.add_argument("--keep-work", action="store_true")
    args = ap.parse_args()

    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        die("ffmpeg and ffprobe must be on PATH (https://ffmpeg.org/download.html)")
    shots_path = Path(args.shots).resolve()
    base = shots_path.parent
    spec = json.loads(shots_path.read_text(encoding="utf-8-sig"))
    o = spec.get("output", {})
    aspect, res, fps = o.get("aspect_ratio", "9:16"), o.get("resolution", "1080p"), int(o.get("fps", 30))
    if (aspect, res) not in SIZES:
        die(f"unsupported output {aspect} {res}; use one of {sorted(SIZES)}")
    W, H = SIZES[(aspect, res)]

    # ---- plan / check ----
    missing, total = [], 0.0
    print(f"Edit plan: {W}x{H} @ {fps}fps")
    for i, s in enumerate(spec.get("shots", [])):
        src = shot_source(s, base)
        ok = src.is_file()
        d = float(s.get("duration") or 0) if s.get("type") == "image" else planned_seconds(s)
        if ok and s.get("type", "generate") != "image":
            d = min(d, probe(src)[0]) if d else probe(src)[0]
        total += d if ok else (d or 0)
        cap = s.get("caption") or " / ".join(c.get("text", "") for c in s.get("captions", []))
        print(f"  {i:02d} {s['id']:<16}{s.get('type', 'generate'):<9}{d:>5.1f}s  "
              f"{'ok' if ok else 'MISSING ' + str(src)}  {cap[:50]}")
        if not ok:
            missing.append(str(src))
    ec = spec.get("end_card")
    if ec:
        total += float(ec.get("duration", 3))
        lp = base / ec["logo"] if ec.get("logo") else None
        print(f"  -- end card {ec.get('duration', 3)}s  logo: "
              f"{'none' if not lp else ('ok' if lp.is_file() else 'MISSING ' + str(lp))}")
        if lp and not lp.is_file():
            missing.append(str(lp))
    if spec.get("music", {}).get("path") and not (base / spec["music"]["path"]).is_file():
        missing.append(str(base / spec["music"]["path"]))
    print(f"Total ~{total:.1f}s")
    nonascii = any(ord(ch) > 0x24F for s in spec.get("shots", []) for ch in json.dumps(
        [s.get("caption", ""), s.get("captions", [])], ensure_ascii=False))
    if nonascii and not spec.get("font"):
        print("Note: captions use a non-Latin script; set \"font\" in shots.json to a font that covers "
              "it (e.g. Nirmala UI / Noto Sans Devanagari), or the text renders as boxes.")
    if missing:
        die("Missing files:\n  " + "\n  ".join(missing), 2)
    if args.check:
        print("Check OK.")
        return

    # ---- render ----
    font = Path(spec["font"]) if spec.get("font") else None
    if font and not font.is_absolute():
        font = base / font
    if not font or not font.is_file():
        font = next((Path(p) for p in FONT_CANDIDATES if Path(p).is_file()), None)
    if not font:
        die("No font found; set \"font\" in shots.json to a .ttf file")
    work = base / ".work"
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    font_name = "font" + font.suffix.lower()
    shutil.copy(font, work / font_name)
    ov = Overlay(work, W, H, font_name)

    segs, cues, t0 = [], [], 0.0
    for i, s in enumerate(spec["shots"]):
        print(f"Rendering {s['id']}...", flush=True)
        seg = build_segment(i, s, base, work, W, H, fps, ov, spec, not args.no_captions)
        d = probe(seg)[0]
        for text, a, b in shot_captions(s, d):
            cues.append((t0 + a, t0 + min(b, d), text))
        segs.append(seg)
        t0 += d
    if ec:
        print("Rendering end card...", flush=True)
        segs.append(build_end_card(len(segs), ec, base, work, W, H, fps, ov, spec))

    (work / "list.txt").write_text("".join(f"file '{p.name}'\n" for p in segs), encoding="utf-8")
    project = spec.get("project", "campaign-ad")
    out = Path(args.out).resolve() if args.out else base / "final" / f"{project}.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    joined = work / "joined.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy",
         "-movflags", "+faststart", joined.name], work)

    music = spec.get("music") or {}
    if music.get("path"):
        T = probe(joined)[0]
        fade = min(2.0, T / 4)
        run(["ffmpeg", "-y", "-i", joined.name, "-stream_loop", "-1", "-i", str(base / music["path"]),
             "-filter_complex",
             f"[1:a]aresample=48000,aformat=channel_layouts=stereo,volume={float(music.get('volume', 0.15))},"
             f"atrim=0:{T:.3f},afade=t=in:st=0:d=0.5,afade=t=out:st={T - fade:.3f}:d={fade:.3f}[m];"
             f"[0:a][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]",
             "-map", "0:v", "-map", "[a]", "-c:v", "copy", *ENC_A, "-t", f"{T:.3f}",
             "-movflags", "+faststart", str(out)], work)
    else:
        shutil.move(str(joined), str(out))

    srt = out.with_suffix(".srt")
    srt.write_text("".join(f"{n}\n{srt_time(a)} --> {srt_time(b)}\n{text}\n\n"
                           for n, (a, b, text) in enumerate(cues, 1)), encoding="utf-8")
    if not args.keep_work:
        shutil.rmtree(work, ignore_errors=True)
    d, _ = probe(out)
    print(f"\nDone: {out}  ({d:.1f}s, {out.stat().st_size / 1e6:.1f} MB)\nCaptions file: {srt}")


if __name__ == "__main__":
    main()
