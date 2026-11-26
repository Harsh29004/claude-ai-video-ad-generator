#!/usr/bin/env python3
"""Generate everything a campaign ad needs from fal.ai: realistic video clips, the
voiceover lines and the background music, all through the fal.ai queue API.

Usage:
  python generate_video.py SHOTS_JSON [--dry-run] [--only s01-hook,music] [--force]
                                      [--timeout 1200] [--workers 4]

  --dry-run   Validate shots.json, expand {{placeholders}}, print every payload and a cost
              estimate. Needs no API key and spends nothing.
  --only      Comma-separated job ids: shot ids (clips), vo-<shot id> (voiceover lines),
              music. E.g. the hook clip alone as a look check: --only s01-hook
  --force     Regenerate even if a finished file for the same input already exists.

Jobs come from shots.json:
  shots[] of type "generate"           -> clips/<id>.mp4
  shots[].vo + "voiceover": {model}    -> audio/vo-<id>.<ext>  (skipped if the shot has vo_path)
  "music": {model, input}              -> audio/music.<ext>   (skipped if music has a path)

API key: FAL_KEY from the environment, or a FAL_KEY=... line in a .env file in the current
directory or next to shots.json (or up to 3 parent folders above it).
Job state lives in clips/_state.json, so an interrupted run resumes polling the jobs it
already paid for instead of resubmitting them. Standard library only.
"""
import argparse
import base64
import copy
import hashlib
import json
import mimetypes
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

QUEUE_BASE = os.environ.get("FAL_QUEUE_URL", "https://queue.fal.run").rstrip("/")
# USD per generated second of video. Snapshot (Nov 2026) for estimates only; check fal.ai/models.
PRICE_PER_SECOND = {"fal-ai/veo3.1": 0.40}
PLACEHOLDER = re.compile(r"\{\{\s*([A-Za-z0-9_\-]+)\s*\}\}")
VIDEO_EXT = (".mp4", ".mov", ".webm")
AUDIO_EXT = (".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".flac")


# ---------- shot list ----------

def load_shots(path: Path) -> dict:
    try:
        spec = json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        sys.exit(f"shots.json is not valid JSON: {e}")
    if not isinstance(spec.get("shots"), list) or not spec["shots"]:
        sys.exit("shots.json needs a non-empty 'shots' list")
    ids = [s.get("id") for s in spec["shots"]]
    if any(not i for i in ids):
        sys.exit("every shot needs an 'id'")
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        sys.exit(f"duplicate shot ids: {', '.join(sorted(dupes))}")
    return spec


def expand(value, bible: dict, missing: set):
    """Recursively replace {{key}} with bible[key] (bible entries may nest placeholders)."""
    if isinstance(value, str):
        def sub(m):
            key = m.group(1)
            if key not in bible:
                missing.add(key)
                return m.group(0)
            return expand(bible[key], bible, missing)
        for _ in range(5):
            new = PLACEHOLDER.sub(sub, value)
            if new == value:
                break
            value = new
        return value
    if isinstance(value, list):
        return [expand(v, bible, missing) for v in value]
    if isinstance(value, dict):
        return {k: expand(v, bible, missing) for k, v in value.items()}
    return value


def file_refs(value, base: Path, found: list):
    if isinstance(value, str) and value.startswith("file:"):
        found.append(base / value[5:])
    elif isinstance(value, list):
        for v in value:
            file_refs(v, base, found)
    elif isinstance(value, dict):
        for v in value.values():
            file_refs(v, base, found)


def to_data_uris(value, base: Path):
    if isinstance(value, str) and value.startswith("file:"):
        p = base / value[5:]
        mime = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
        return f"data:{mime};base64,{base64.b64encode(p.read_bytes()).decode()}"
    if isinstance(value, list):
        return [to_data_uris(v, base) for v in value]
    if isinstance(value, dict):
        return {k: to_data_uris(v, base) for k, v in value.items()}
    return value


def seconds_of(shot: dict, inp: dict) -> float:
    if shot.get("duration"):
        return float(shot["duration"])
    d = str(inp.get("duration", "")).lower().rstrip("s").strip()
    try:
        return float(d)
    except ValueError:
        return 0.0


def job_hash(model, inp, refs):
    h = hashlib.sha256(json.dumps({"model": model, "input": inp}, sort_keys=True).encode())
    for r in refs:
        if r.is_file():
            h.update(hashlib.sha256(r.read_bytes()).digest())
    return h.hexdigest()[:16]


def build_jobs(spec: dict, base: Path):
    bible = spec.get("bible", {}) or {}
    defaults = spec.get("input_defaults", {}) or {}
    jobs, problems = [], []

    # video clips
    for shot in spec["shots"]:
        if shot.get("type", "generate") != "generate":
            continue
        model = shot.get("model") or spec.get("default_model")
        if not model:
            problems.append(f"{shot['id']}: no 'model' and no 'default_model'")
            continue
        raw = copy.deepcopy(defaults) if shot.get("use_defaults", True) else {}
        raw.update(shot.get("input", {}))
        missing = set()
        inp = expand(raw, bible, missing)
        if missing:
            problems.append(f"{shot['id']}: unknown placeholder(s) {', '.join('{{%s}}' % m for m in sorted(missing))}")
        if not inp.get("prompt") and not inp.get("multi_prompt"):
            problems.append(f"{shot['id']}: input has no 'prompt'")
        refs = []
        file_refs(inp, base, refs)
        problems += [f"{shot['id']}: file not found {r}" for r in refs if not r.is_file()]
        jobs.append({"id": shot["id"], "kind": "video", "model": model, "input": inp,
                     "seconds": seconds_of(shot, inp), "price": None,
                     "dir": "clips", "stem": shot["id"], "hash": job_hash(model, inp, refs)})

    # voiceover lines (one job per shot, so each line lands exactly on its shot)
    vo = spec.get("voiceover") or {}
    vo_shots = [s for s in spec["shots"] if s.get("vo") and not s.get("vo_path")]
    if vo_shots and not vo.get("path"):
        if not vo.get("model"):
            problems.append("shots have 'vo' lines but 'voiceover' has no 'model' (or give each shot a vo_path)")
        else:
            field = vo.get("text_field", "text")
            for s in vo_shots:
                inp = copy.deepcopy(vo.get("input", {}))
                inp[field] = s["vo"]
                if "minimax/speech" in vo["model"]:
                    inp.setdefault("output_format", "url")  # MiniMax returns hex by default
                jobs.append({"id": f"vo-{s['id']}", "kind": "audio", "model": vo["model"], "input": inp,
                             "seconds": 0, "price": vo.get("price_per_job"),
                             "dir": "audio", "stem": f"vo-{s['id']}", "hash": job_hash(vo["model"], inp, [])})

    # background music
    mu = spec.get("music") or {}
    if mu.get("model") and not mu.get("path"):
        missing = set()
        inp = expand(copy.deepcopy(mu.get("input", {})), bible, missing)
        if missing:
            problems.append(f"music: unknown placeholder(s) {', '.join(sorted(missing))}")
        jobs.append({"id": "music", "kind": "audio", "model": mu["model"], "input": inp,
                     "seconds": 0, "price": mu.get("price_per_job"),
                     "dir": "audio", "stem": "music", "hash": job_hash(mu["model"], inp, [])})
    return jobs, problems


# ---------- HTTP ----------

def load_key(base: Path):
    if os.environ.get("FAL_KEY"):
        return os.environ["FAL_KEY"].strip()
    candidates = [Path.cwd() / ".env"] + [d / ".env" for d in [base, *base.parents][:4]]
    for c in candidates:
        if c.is_file():
            for line in c.read_text(encoding="utf-8-sig").splitlines():
                m = re.match(r"\s*(?:export\s+)?FAL_KEY\s*=\s*(.+?)\s*$", line)
                if m:
                    return m.group(1).strip().strip('"').strip("'")
    return None


def http(method: str, url: str, key: str, body=None, timeout=90):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Key {key}", "Content-Type": "application/json",
        "Accept": "application/json", "User-Agent": "campaign-video-generator/1.2"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = r.read().decode("utf-8", "replace")
            return json.loads(txt) if txt.strip() else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:800]
        raise RuntimeError(f"HTTP {e.code} {method} {url}: {detail}") from None


def find_media_url(obj, kind):
    """fal returns {"video": {"url"}} / {"audio": {"url"}} (sometimes a bare URL string);
    fall back to any URL whose extension or content_type matches the kind."""
    exts = VIDEO_EXT if kind == "video" else AUDIO_EXT
    if isinstance(obj, dict):
        v = obj.get(kind)
        if isinstance(v, dict) and isinstance(v.get("url"), str):
            return v["url"]
        if isinstance(v, str) and v.startswith("http"):
            return v
        u = obj.get("url")
        if isinstance(u, str) and (urllib.parse.urlparse(u).path.lower().endswith(exts)
                                   or str(obj.get("content_type", "")).startswith(kind + "/")):
            return u
        for val in obj.values():
            r = find_media_url(val, kind)
            if r:
                return r
    elif isinstance(obj, list):
        for val in obj:
            r = find_media_url(val, kind)
            if r:
                return r
    return None


# ---------- state ----------

class State:
    def __init__(self, path: Path):
        self.path, self.lock = path, threading.Lock()
        self.data = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}

    def get(self, jid):
        with self.lock:
            return dict(self.data.get(jid, {}))

    def set(self, jid, **kw):
        with self.lock:
            self.data.setdefault(jid, {}).update(kw)
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.data, indent=2), encoding="utf-8")
            os.replace(tmp, self.path)


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def is_cached(job, base, state):
    st = state.get(job["id"]) if state else {}
    f = st.get("file")
    return bool(f and (base / job["dir"] / f).is_file() and st.get("hash") == job["hash"]
                and st.get("status") == "done")


def run_job(job, key, base, state: State, force: bool, timeout: int):
    jid = job["id"]
    st = state.get(jid)
    if not force and is_cached(job, base, state):
        log(f"{jid}: cached, skipping ({st['file']})")
        return jid, "cached"

    resumable = (not force and st.get("hash") == job["hash"]
                 and st.get("status") in ("submitted", "running") and st.get("status_url"))
    if resumable:
        log(f"{jid}: resuming job {st.get('request_id')}")
    else:
        sub = http("POST", f"{QUEUE_BASE}/{job['model']}", key, to_data_uris(job["input"], base))
        if not sub.get("request_id") or not sub.get("status_url") or not sub.get("response_url"):
            raise RuntimeError(f"{jid}: unexpected submit response {sub}")
        st = {"hash": job["hash"], "model": job["model"], "request_id": sub["request_id"],
              "status_url": sub["status_url"], "response_url": sub["response_url"],
              "status": "submitted", "submitted_at": time.time()}
        state.set(jid, **st)
        log(f"{jid}: submitted to {job['model']} (request {sub['request_id']})")

    start, delay, last = time.time(), 4.0, None
    while True:
        s = http("GET", st["status_url"], key)
        status = s.get("status")
        if status != last:
            extra = f" (queue position {s.get('queue_position')})" if status == "IN_QUEUE" else ""
            log(f"{jid}: {status}{extra}")
            last = status
            state.set(jid, status="running")
        if status == "COMPLETED":
            if s.get("error"):
                state.set(jid, status="failed", error=str(s.get("error")))
                raise RuntimeError(f"{jid}: generation failed: {s.get('error')} {s.get('error_type', '')}")
            break
        if time.time() - start > timeout:
            raise RuntimeError(f"{jid}: still {status} after {timeout}s; rerun the same command to resume")
        time.sleep(delay)
        delay = min(delay * 1.4, 15.0)

    result = http("GET", st["response_url"], key)
    url = find_media_url(result, job["kind"])
    if not url:
        state.set(jid, status="failed", error=f"no {job['kind']} url in result")
        raise RuntimeError(f"{jid}: no {job['kind']} URL in result: {json.dumps(result)[:500]}")
    ext = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if ext not in (VIDEO_EXT if job["kind"] == "video" else AUDIO_EXT):
        ext = ".mp4" if job["kind"] == "video" else ".mp3"
    out_dir = base / job["dir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob(job["stem"] + ".*"):  # drop an older render with another extension
        if old.suffix.lower() in VIDEO_EXT + AUDIO_EXT:
            old.unlink()
    out = out_dir / f"{job['stem']}{ext}"
    tmp = out.with_suffix(ext + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "campaign-video-generator/1.2"})
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    os.replace(tmp, out)
    state.set(jid, status="done", file=out.name, url=url, finished_at=time.time())
    log(f"{jid}: saved {out}")
    return jid, "done"


# ---------- main ----------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("shots")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--timeout", type=int, default=1200, help="seconds to wait per job")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    shots_path = Path(args.shots).resolve()
    base = shots_path.parent
    spec = load_shots(shots_path)
    jobs, problems = build_jobs(spec, base)
    if args.only:
        wanted = {x.strip() for x in args.only.split(",") if x.strip()}
        unknown = wanted - {j["id"] for j in jobs}
        if unknown:
            problems.append(f"--only: no job with id {', '.join(sorted(unknown))} "
                            f"(jobs: {', '.join(j['id'] for j in jobs)})")
        jobs = [j for j in jobs if j["id"] in wanted]

    pps = spec.get("price_per_second")
    prices = dict(PRICE_PER_SECOND)
    if isinstance(pps, dict):
        prices.update(pps)
    elif isinstance(pps, (int, float)):
        prices.update({j["model"]: float(pps) for j in jobs if j["kind"] == "video"})

    state_path = base / "clips" / "_state.json"
    state = State(state_path) if state_path.is_file() else None
    total_usd, unknown_price, n_todo = 0.0, set(), 0
    print(f"\n{'job':<20}{'kind':<7}{'model':<40}{'sec':>5}{'est $':>8}  status")
    for j in jobs:
        if j["kind"] == "video":
            p = prices.get(j["model"])
            cost = p * j["seconds"] if p is not None else None
        else:
            cost = float(j["price"]) if j["price"] is not None else None
        cached = not args.force and is_cached(j, base, state)
        if not cached:
            n_todo += 1
            if cost is None:
                unknown_price.add(j["model"])
            total_usd += cost or 0.0
        print(f"{j['id']:<20}{j['kind']:<7}{j['model']:<40}{(j['seconds'] or 0):>5.0f}"
              f"{(f'{cost:.2f}' if cost is not None else '?'):>8}  {'cached (free)' if cached else 'to generate'}")
    print(f"\nTo generate: {n_todo} job(s), est. ${total_usd:.2f}"
          + (f" + unpriced: {', '.join(sorted(unknown_price))} (see fal.ai pricing)" if unknown_price else ""))

    if problems:
        print("\nProblems:\n  " + "\n  ".join(problems))
        sys.exit(2)

    if args.dry_run:
        print("\nExpanded payloads:")
        for j in jobs:
            print(f"\n--- {j['id']} -> {j['model']}\n{json.dumps(j['input'], indent=2, ensure_ascii=False)}")
        print("\nDry run OK. Nothing was submitted.")
        return

    key = load_key(base)
    if not key:
        sys.exit("FAL_KEY not found. Set it as an env var or put FAL_KEY=... in a .env file "
                 "(fal.ai > Dashboard > Keys). Without a key, use the bring-your-own-clips route: "
                 "generate clips from prompt-pack.md and drop them into clips/<shot-id>.mp4.")
    if not jobs:
        print("Nothing to generate.")
        return

    state = State(state_path)
    failures = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
        futs = {ex.submit(run_job, j, key, base, state, args.force, args.timeout): j["id"] for j in jobs}
        for f in as_completed(futs):
            try:
                f.result()
            except Exception as e:  # report every failure, keep the other jobs running
                failures.append(str(e))
                log(f"ERROR {e}")
    print(f"\n{len(jobs) - len(failures)}/{len(jobs)} jobs ready (clips/ and audio/ in {base})")
    if failures:
        print("Failed:\n  " + "\n  ".join(failures))
        sys.exit(1)


if __name__ == "__main__":
    main()
