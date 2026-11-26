#!/usr/bin/env python3
"""Edit the final ad: realistic clips + real app screens + voiceover + background music +
captions + transitions + end card, then a quality gate (ffmpeg/ffprobe required).

Usage:
  python assemble_video.py SHOTS_JSON [--check] [--out final/name.mp4] [--no-captions]
                                      [--keep-work] [--allow-stills]

  --check         Print the edit + audio plan and list missing files; renders nothing.
  --allow-stills  Skip the "real footage" guard (only when the user explicitly wants a
                  motion-graphics piece instead of a live-action ad).

Sources per shot:
  generate -> clips/<id>.mp4 (from generate_video.py, or a clip you made in Gemini/Flow/Kling)
  clip     -> any video file (e.g. a screen recording)
  image    -> a real app screenshot over a blurred backdrop with a slow zoom (keep these short)
Audio:
  shot "vo" lines -> audio/vo-<id>.* (generated) or shot "vo_path" (your own recording)
  "voiceover": {"path": ...} -> one full voiceover track instead of per-shot lines
  "music": {"path": ...} or generated audio/music.* -> looped, faded, ducked under speech
The mix is loudness-normalized to -14 LUFS (social-platform level). After rendering, a
quality gate measures loudness, silence and motion; a silent or static result exits with
code 3 and must not be handed off. Standard library only.
"""
import argparse
import json
import re
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
AUDIO_EXT = (".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".flac")
STILL_SHARE_MAX = 0.35   # stills may fill at most this share of the ad
MOTION_MIN = 0.15        # median luma frame difference below this = a frozen picture, not footage
LOUDNESS_MIN = -35.0     # integrated LUFS below this = effectively silent


def die(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


def run(cmd, cwd):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        die(f"ffmpeg failed:\n  {' '.join(map(str, cmd))}\n{r.stderr[-2500:]}")
    return r.stdout + r.stderr


def probe(path: Path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
                        "-of", "json", str(path)], capture_output=True, text=True)
    data = json.loads(r.stdout or "{}")
    kinds = {s.get("codec_type") for s in data.get("streams", [])}
    return float(data.get("format", {}).get("duration") or 0), "audio" in kinds, "video" in kinds


def planned_seconds(shot):
    if shot.get("duration"):
        return float(shot["duration"])
    d = str(shot.get("input", {}).get("duration", "")).lower().rstrip("s").strip()
    try:
        return float(d)
    except ValueError:
        return 0.0


def shot_source(shot, base: Path):
    if shot.get("type", "generate") == "generate":
        return base / "clips" / f"{shot['id']}.mp4"
    return base / shot.get("path", "")


def find_audio(base: Path, stem: str):
    for p in sorted((base / "audio").glob(stem + ".*")):
        if p.suffix.lower() in AUDIO_EXT:
            return p
    return None


def vo_source(shot, base):
    if shot.get("vo_path"):
        return base / shot["vo_path"]
    if shot.get("vo"):
        return find_audio(base, f"vo-{shot['id']}") or base / "audio" / f"vo-{shot['id']}.mp3"
    return None


def music_source(spec, base):
    mu = spec.get("music") or {}
    if mu.get("none"):
        return None
    if mu.get("path"):
        return base / mu["path"]
    return find_audio(base, "music") or base / "audio" / "music.mp3"


def shot_captions(shot, dur):
    if shot.get("captions"):
        return [(c["text"], float(c.get("start", 0.2)), float(c.get("end", dur - 0.1)))
                for c in shot["captions"] if c.get("text")]
    if shot.get("caption"):
        return [(shot["caption"], 0.2, max(0.4, dur - 0.1))]
    return []


class Overlay:
    """drawtext filters. Text goes through files and the font is copied into the work dir under
    a plain name, so no path or text needs filtergraph escaping (Windows-safe). One drawtext per
    line: recent ffmpeg renders '\\n' as a box glyph, and per-line boxes are the social look."""

    def __init__(self, work: Path, W: int, H: int, font_name: str):
        self.work, self.W, self.H, self.font, self.n = work, W, H, font_name, 0

    def text(self, content, size, anchor=("center", 0.5), color="white", box="black@0.55",
             window=None, wrap=True):
        per_line = max(12, int(self.W * 0.84 / (size * 0.55)))
        lines = (textwrap.wrap(content, per_line) if wrap else [content]) or [content]
        if len(lines) > 1:  # balance line lengths (no orphan word on the last line)
            even = textwrap.wrap(content, -(-len(content) // len(lines)) + 4)
            if len(even) == len(lines):
                lines = even
        pad = max(4, int(size * 0.3))
        lh = int(size * 1.15) + 2 * pad + max(2, int(size * 0.12))
        block = len(lines) * lh
        kind, frac = anchor
        top = {"top": frac * self.H, "bottom": frac * self.H - block}.get(kind, frac * self.H - block / 2)
        out = []
        for k, line in enumerate(lines):
            self.n += 1
            name = f"t{self.n:03d}.txt"
            with open(self.work / name, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(line)
            f = (f"drawtext=fontfile={self.font}:textfile={name}:expansion=none:fontsize={size}"
                 f":fontcolor={color}:x=(w-text_w)/2:y={int(top + k * lh) + pad}")
            if box:
                f += f":box=1:boxcolor={box}:boxborderw={pad}"
            if window:
                a, b = window
                f += f":enable='between(t,{a:.2f},{b:.2f})':alpha='min(1,max(0,(t-{a:.2f})/0.15))'"
            out.append(f)
        return ",".join(out)


def disclosure_filter(ov: Overlay, disc: dict):
    text = (disc or {}).get("text", "")
    if not text:
        return []
    size = max(16, int(min(ov.W, ov.H) * 0.026))
    anchor = ("top", 0.03) if disc.get("position", "top") == "top" else ("bottom", 0.97)
    return [ov.text(text, size, anchor, color="white@0.9", box="black@0.35", wrap=False)]


def build_segment(i, shot, base, work, W, H, fps, ov, spec, with_caps):
    t = shot.get("type", "generate")
    src = shot_source(shot, base)
    out = work / f"seg_{i:02d}.mp4"
    if t == "image":
        dur, start, has_audio = float(shot.get("duration") or 3), 0.0, False
    else:
        clip_dur, has_audio, _ = probe(src)
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
        size = max(22, int(min(W, H) * 0.05))
        texts += [ov.text(c, size, ("center", pos), window=(a, b)) for c, a, b in shot_captions(shot, dur)]
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
        frames = max(int(round(dur * fps)), 1)
        motion = (f"[base]scale={W * 2}:{H * 2},zoompan=z='1+0.10*on/{frames}':d=1"
                  f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={fps}[m];"
                  if shot.get("motion", "zoom") == "zoom" else f"[base]fps={fps}[m];")
        fc = layout(shot.get("fit", "contain")) + motion + f"[m]format=yuv420p{tail}[v]"
        cmd = ["ffmpeg", "-y", "-loop", "1", "-framerate", str(fps), "-t", f"{dur}", "-i", str(src),
               "-f", "lavfi", "-t", f"{dur}", "-i", "anullsrc=r=48000:cl=stereo",
               "-filter_complex", fc, "-map", "[v]", "-map", "1:a"]
    else:
        # Under a voiceover the clip's own sound drops to an ambience bed unless told otherwise.
        vol = float(shot.get("clip_volume", 0.35 if (shot.get("vo") or shot.get("vo_path")) else 1.0))
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
        fc, head_y = f"[2:v]scale={int(m * 0.36)}:-1[lg];[0:v][lg]overlay=(W-w)/2:H*0.33-h/2[c];[c]", 0.52
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


def join_segments(segs, durs, spec, work, fps):
    """Hard cuts (lossless concat) or xfade transitions. Returns (file, start time of each segment)."""
    tr = spec.get("transition") or {}
    kind, td = tr.get("type", "cut"), float(tr.get("duration", 0.25))
    if kind == "cut" or len(segs) < 2 or min(durs) <= td * 2:
        starts, t = [], 0.0
        for d in durs:
            starts.append(t)
            t += d
        (work / "list.txt").write_text("".join(f"file '{p.name}'\n" for p in segs), encoding="utf-8")
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy",
             "-movflags", "+faststart", "joined.mp4"], work)
        return work / "joined.mp4", starts
    starts = [0.0]
    for d in durs[:-1]:
        starts.append(starts[-1] + d - td)
    cmd = ["ffmpeg", "-y"]
    for p in segs:
        cmd += ["-i", p.name]
    fc = [f"[{i}:v]settb=AVTB,setpts=PTS-STARTPTS,fps={fps}[v{i}];[{i}:a]asetpts=PTS-STARTPTS[a{i}]"
          for i in range(len(segs))]
    vprev, aprev = "v0", "a0"
    for i in range(1, len(segs)):
        vo, ao = f"vx{i}", f"ax{i}"
        fc.append(f"[{vprev}][v{i}]xfade=transition={kind}:duration={td}:offset={starts[i]:.3f}[{vo}]")
        fc.append(f"[{aprev}][a{i}]acrossfade=d={td}:c1=tri:c2=tri[{ao}]")
        vprev, aprev = vo, ao
    cmd += ["-filter_complex", ";".join(fc), "-map", f"[{vprev}]", "-map", f"[{aprev}]",
            "-r", str(fps), *ENC_V, *ENC_A, "-movflags", "+faststart", "joined.mp4"]
    run(cmd, work)
    return work / "joined.mp4", starts


def mix_audio(joined, T, vo_items, music, spec, out, work):
    """clip sound + voiceover lines -> voice bus; music bed ducked under the voice bus;
    everything loudness-normalized to -14 LUFS."""
    cmd = ["ffmpeg", "-y", "-i", joined.name]
    fc = ["[0:a]aresample=48000,aformat=channel_layouts=stereo[clip]"]
    voice_inputs = ["[clip]"]
    vo_cfg = spec.get("voiceover") or {}
    vvol = float(vo_cfg.get("volume", 1.0))
    for k, (path, at) in enumerate(vo_items, start=1):
        cmd += ["-i", str(path)]
        ms = max(0, int(at * 1000))
        fc.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,volume={vvol},"
                  f"adelay=delays={ms}:all=1[vo{k}]")
        voice_inputs.append(f"[vo{k}]")
    if len(voice_inputs) > 1:
        fc.append("".join(voice_inputs) + f"amix=inputs={len(voice_inputs)}:duration=first:normalize=0[voice]")
    else:
        fc.append("[clip]anull[voice]")
    if music:
        mu = spec.get("music") or {}
        mi = len(vo_items) + 1
        cmd += ["-stream_loop", "-1", "-i", str(music)]
        fade = min(2.0, T / 4)
        fc.append(f"[{mi}:a]aresample=48000,aformat=channel_layouts=stereo,"
                  f"volume={float(mu.get('volume', 0.22))},atrim=0:{T:.3f},asetpts=PTS-STARTPTS,"
                  f"afade=t=in:st=0:d=0.6,afade=t=out:st={T - fade:.3f}:d={fade:.3f}[mus]")
        if mu.get("duck", True):
            fc.append("[voice]asplit=2[vmix][vkey]")
            fc.append("[mus][vkey]sidechaincompress=threshold=0.03:ratio=4:attack=15:release=450[bed]")
            fc.append("[vmix][bed]amix=inputs=2:duration=first:normalize=0[mix]")
        else:
            fc.append("[voice][mus]amix=inputs=2:duration=first:normalize=0[mix]")
    else:
        fc.append("[voice]anull[mix]")
    fc.append("[mix]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]")
    cmd += ["-filter_complex", ";".join(fc), "-map", "0:v", "-map", "[aout]", "-c:v", "copy",
            *ENC_A, "-t", f"{T:.3f}", "-movflags", "+faststart", str(out)]
    run(cmd, work)


def motion_score(path: Path, work: Path, start=0.0, dur=None):
    """Median luma difference between frames sampled at 6 fps (0 = frozen picture). The median
    ignores one-off spikes such as a caption fading in or a transition."""
    rng = ["-ss", f"{start}"] + (["-t", f"{dur}"] if dur else [])
    txt = run(["ffmpeg", "-v", "error", *rng, "-i", str(path), "-an", "-vf",
               "fps=6,scale=160:-2,format=gray,tblend=all_mode=difference,signalstats,"
               "metadata=print:key=lavfi.signalstats.YAVG:file=-", "-f", "null", "-"], work)
    vals = sorted(float(v) for v in re.findall(r"YAVG=([\d.]+)", txt))[1:]  # first frame has no predecessor
    return vals[len(vals) // 2] if vals else 0.0


def quality_gate(out: Path, seg_checks, work: Path):
    txt = run(["ffmpeg", "-nostats", "-i", str(out), "-vn", "-af",
               "ebur128=framelog=quiet,silencedetect=noise=-45dB:d=2", "-f", "null", "-"], work)
    lufs = re.findall(r"I:\s+(-?[\d.]+|-inf) LUFS", txt)
    loud = float(lufs[-1]) if lufs and lufs[-1] != "-inf" else -99.0
    silences = len(re.findall(r"silence_start", txt))
    motion = motion_score(out, work)
    problems = []
    if loud < LOUDNESS_MIN:
        problems.append(f"audio is silent ({loud:.1f} LUFS): no dialogue, voiceover or music reached the mix")
    if silences:
        problems.append(f"{silences} silent gap(s) of 2 s or more")
    if motion < MOTION_MIN:
        problems.append(f"video is static (motion {motion:.2f}): this is a slideshow, not footage")
    for sid, m in seg_checks:
        if m < MOTION_MIN:
            problems.append(f"shot {sid} is a still frame (motion {m:.2f}); a real generated clip moves")
    return {"loudness_lufs": round(loud, 1), "silent_gaps": silences, "motion": round(motion, 2),
            "problems": problems, "passed": not problems}


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
    ap.add_argument("--allow-stills", action="store_true")
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
    shots = spec.get("shots", [])

    # ---------- plan / check ----------
    missing, errors, warnings = [], [], []
    total, still_time, footage_time = 0.0, 0.0, 0.0
    print(f"Edit plan: {W}x{H} @ {fps}fps")
    for i, s in enumerate(shots):
        t = s.get("type", "generate")
        src = shot_source(s, base)
        ok = src.is_file()
        d = float(s.get("duration") or 3) if t == "image" else planned_seconds(s)
        if ok and t != "image":
            cd, _, has_v = probe(src)
            if not has_v:
                errors.append(f"{s['id']}: {src.name} has no video stream")
            d = min(d, cd) if d else cd
        total += d
        if t == "image":
            still_time += d
        else:
            footage_time += d
        if "placeholder" in str(s.get("path", "")).lower():
            errors.append(f"{s['id']}: placeholder image; a placeholder is never a deliverable")
        vo = vo_source(s, base)
        vo_note = ""
        if vo is not None:
            if vo.is_file():
                vd = probe(vo)[0]
                vo_note = f"  VO {vd:.1f}s"
                if vd > d + 1.0:
                    warnings.append(f"{s['id']}: voiceover ({vd:.1f}s) runs {vd - d:.1f}s past the shot; "
                                    f"shorten the line or lengthen the shot")
            else:
                missing.append(str(vo))
                vo_note = "  VO MISSING"
        cap = s.get("caption") or " / ".join(c.get("text", "") for c in s.get("captions", []))
        print(f"  {i:02d} {s['id']:<16}{t:<9}{d:>5.1f}s  {'ok' if ok else 'MISSING ' + str(src)}{vo_note}  {cap[:40]}")
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

    vo_track = (spec.get("voiceover") or {}).get("path")
    if vo_track and not (base / vo_track).is_file():
        missing.append(str(base / vo_track))
    music = music_source(spec, base)
    if music is None:
        print("Audio: music explicitly disabled")
    elif not music.is_file():
        missing.append(str(music))
        errors.append("no background music: generate it (music.model) or set music.path; "
                      "use \"music\": {\"none\": true} only if the user asked for none")
    else:
        print(f"Audio: music {music.name}" + (" + voiceover lines" if any(vo_source(s, base) for s in shots) else "")
              + (f" + voiceover track {vo_track}" if vo_track else ""))
    if not any(vo_source(s, base) for s in shots) and not vo_track:
        warnings.append("no voiceover: make sure the clips carry dialogue, or add 'vo' lines")

    if not args.allow_stills and shots:
        if shots[0].get("type", "generate") == "image":
            errors.append("the hook (first shot) is a still image; it must be moving footage of a person")
        if total and still_time / max(total, 0.01) > STILL_SHARE_MAX:
            errors.append(f"stills fill {still_time / total:.0%} of the ad (max {STILL_SHARE_MAX:.0%}); "
                          f"this would be a slideshow, so add generated or real clips")
        if footage_time == 0:
            errors.append("no moving footage at all; generate the clips first (or use --allow-stills "
                          "only for an intentional motion-graphics piece)")
    print(f"Total ~{total:.1f}s")
    nonascii = any(ord(ch) > 0x24F for s in shots for ch in json.dumps(
        [s.get("caption", ""), s.get("captions", [])], ensure_ascii=False))
    if nonascii and not spec.get("font"):
        warnings.append("captions use a non-Latin script; set \"font\" to a font covering it "
                        "(e.g. Nirmala UI / Noto Sans Devanagari)")
    for w in warnings:
        print("Warning: " + w)
    if missing:
        errors.insert(0, "Missing files:\n    " + "\n    ".join(dict.fromkeys(missing)))
    if errors:
        die("Cannot render a real ad yet:\n  - " + "\n  - ".join(errors), 2)
    if args.check:
        print("Check OK.")
        return

    # ---------- render ----------
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

    segs, durs = [], []
    for i, s in enumerate(shots):
        print(f"Rendering {s['id']}...", flush=True)
        seg = build_segment(i, s, base, work, W, H, fps, ov, spec, not args.no_captions)
        segs.append(seg)
        durs.append(probe(seg)[0])
    if ec:
        print("Rendering end card...", flush=True)
        segs.append(build_end_card(len(segs), ec, base, work, W, H, fps, ov, spec))
        durs.append(probe(segs[-1])[0])

    print("Joining shots...", flush=True)
    joined, starts = join_segments(segs, durs, spec, work, fps)
    T = probe(joined)[0]

    vo_items = []
    if vo_track:
        vo_items.append((base / vo_track, float((spec.get("voiceover") or {}).get("start", 0))))
    for i, s in enumerate(shots):
        v = vo_source(s, base)
        if v is not None:
            vo_items.append((v, starts[i] + float(s.get("vo_start", 0.25))))

    project = spec.get("project", "campaign-ad")
    out = Path(args.out).resolve() if args.out else base / "final" / f"{project}.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    print("Mixing voiceover + music...", flush=True)
    mix_audio(joined, T, vo_items, music, spec, out, work)

    cues = []
    for i, s in enumerate(shots):
        for text, a, b in shot_captions(s, durs[i]):
            cues.append((starts[i] + a, starts[i] + min(b, durs[i]), text))
    srt = out.with_suffix(".srt")
    srt.write_text("".join(f"{n}\n{srt_time(a)} --> {srt_time(b)}\n{text}\n\n"
                           for n, (a, b, text) in enumerate(cues, 1)), encoding="utf-8")

    print("Quality check...", flush=True)
    # Judge each live-action shot on its raw source (before captions), so overlays can't fake motion.
    seg_checks = [] if args.allow_stills else [
        (s["id"], motion_score(shot_source(s, base), work, float((s.get("trim") or [0])[0] or 0), durs[i]))
        for i, s in enumerate(shots) if s.get("type", "generate") != "image"]
    qc = quality_gate(out, seg_checks, work)
    out.with_suffix(".qc.json").write_text(json.dumps(qc, indent=2), encoding="utf-8")
    if not args.keep_work:
        shutil.rmtree(work, ignore_errors=True)

    d = probe(out)[0]
    print(f"\nRendered: {out}  ({d:.1f}s, {out.stat().st_size / 1e6:.1f} MB)\nCaptions file: {srt}")
    print(f"QC: loudness {qc['loudness_lufs']} LUFS | silent gaps {qc['silent_gaps']} | motion {qc['motion']}")
    if qc["passed"]:
        print("QC PASSED")
    elif args.allow_stills and all("static" in p or "still" in p for p in qc["problems"]):
        print("QC: stills allowed by --allow-stills")
    else:
        die("QC FAILED; do not hand this video off:\n  - " + "\n  - ".join(qc["problems"]), 3)


if __name__ == "__main__":
    main()
