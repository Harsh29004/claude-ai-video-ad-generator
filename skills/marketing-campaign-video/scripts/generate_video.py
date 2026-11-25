#!/usr/bin/env python3
"""Generate the video clips of a campaign shot list through the fal.ai queue API.

Usage:
  python generate_video.py SHOTS_JSON [--dry-run] [--only s01,s02] [--force]
                                      [--timeout 1200] [--workers 4]

  --dry-run   Validate shots.json, expand {{placeholders}}, print the payloads and
              a cost estimate. Needs no API key and spends nothing.
  --only      Comma-separated shot ids to generate (e.g. the hook as a look check).
  --force     Regenerate even if a finished clip for the same input already exists.

API key: FAL_KEY from the environment, or a FAL_KEY=... line in a .env file in the
current directory or next to shots.json (or up to 3 parent folders above it).

Output: <shots dir>/clips/<id>.mp4. Job state lives in clips/_state.json, so an
interrupted run resumes polling the jobs it already paid for instead of resubmitting.
Standard library only.
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
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

QUEUE_BASE = os.environ.get("FAL_QUEUE_URL", "https://queue.fal.run").rstrip("/")
# USD per generated second. A snapshot (Nov 2026) for estimates only; check fal.ai/models.
PRICE_PER_SECOND = {"fal-ai/veo3.1": 0.40}
PLACEHOLDER = re.compile(r"\{\{\s*([A-Za-z0-9_\-]+)\s*\}\}")


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
        for _ in range(5):  # allow nested placeholders, bounded
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
    """Collect 'file:relative/path' strings."""
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


def build_jobs(spec: dict, base: Path):
    bible = spec.get("bible", {}) or {}
    defaults = spec.get("input_defaults", {}) or {}
    jobs, problems = [], []
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
        for r in refs:
            if not r.is_file():
                problems.append(f"{shot['id']}: file not found {r}")
        # Hash the expanded input plus the bytes of referenced files, so editing a prompt
        # or swapping a reference image invalidates the cached clip, and nothing else does.
        h = hashlib.sha256(json.dumps({"model": model, "input": inp}, sort_keys=True).encode())
        for r in refs:
            if r.is_file():
                h.update(hashlib.sha256(r.read_bytes()).digest())
        jobs.append({"id": shot["id"], "model": model, "input": inp,
                     "seconds": seconds_of(shot, inp), "hash": h.hexdigest()[:16]})
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
        "Accept": "application/json", "User-Agent": "campaign-video-generator/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = r.read().decode("utf-8", "replace")
            return json.loads(txt) if txt.strip() else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:800]
        raise RuntimeError(f"HTTP {e.code} {method} {url}: {detail}") from None


def find_video_url(obj):
    """fal video models return {"video": {"url": ...}}; fall back to any *.mp4/video URL."""
    if isinstance(obj, dict):
        v = obj.get("video")
        if isinstance(v, dict) and isinstance(v.get("url"), str):
            return v["url"]
        if isinstance(obj.get("url"), str) and (
                obj["url"].split("?")[0].lower().endswith((".mp4", ".mov", ".webm"))
                or str(obj.get("content_type", "")).startswith("video/")):
            return obj["url"]
        for val in obj.values():
            u = find_video_url(val)
            if u:
                return u
    elif isinstance(obj, list):
        for val in obj:
            u = find_video_url(val)
            if u:
                return u
    return None


# ---------- state ----------

class State:
    def __init__(self, path: Path):
        self.path, self.lock = path, threading.Lock()
        self.data = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}

    def get(self, sid):
        with self.lock:
            return dict(self.data.get(sid, {}))

    def set(self, sid, **kw):
        with self.lock:
            self.data.setdefault(sid, {}).update(kw)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.data, indent=2), encoding="utf-8")
            os.replace(tmp, self.path)


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def run_job(job, key, base, clips: Path, state: State, force: bool, timeout: int):
    sid, out = job["id"], clips / f"{job['id']}.mp4"
    st = state.get(sid)
    if not force and out.is_file() and st.get("hash") == job["hash"] and st.get("status") == "done":
        log(f"{sid}: cached, skipping ({out.name})")
        return sid, "cached", str(out)

    resumable = (not force and st.get("hash") == job["hash"]
                 and st.get("status") in ("submitted", "running") and st.get("status_url"))
    if resumable:
        log(f"{sid}: resuming job {st.get('request_id')}")
    else:
        payload = to_data_uris(job["input"], base)
        sub = http("POST", f"{QUEUE_BASE}/{job['model']}", key, payload)
        if not sub.get("request_id"):
            raise RuntimeError(f"{sid}: unexpected submit response {sub}")
        st = {"hash": job["hash"], "model": job["model"], "request_id": sub["request_id"],
              "status_url": sub.get("status_url"), "response_url": sub.get("response_url"),
              "status": "submitted", "submitted_at": time.time()}
        if not st["status_url"] or not st["response_url"]:
            raise RuntimeError(f"{sid}: submit response lacks status/response URLs: {sub}")
        state.set(sid, **st)
        log(f"{sid}: submitted to {job['model']} (request {sub['request_id']})")

    start, delay, last = time.time(), 4.0, None
    while True:
        s = http("GET", st["status_url"], key)
        status = s.get("status")
        if status != last:
            extra = f" (queue position {s.get('queue_position')})" if status == "IN_QUEUE" else ""
            log(f"{sid}: {status}{extra}")
            last = status
            state.set(sid, status="running")
        if status == "COMPLETED":
            if s.get("error"):
                state.set(sid, status="failed", error=str(s.get("error")))
                raise RuntimeError(f"{sid}: generation failed: {s.get('error')} {s.get('error_type', '')}")
            break
        if time.time() - start > timeout:
            raise RuntimeError(f"{sid}: still {status} after {timeout}s; rerun the same command to resume")
        time.sleep(delay)
        delay = min(delay * 1.4, 15.0)

    result = http("GET", st["response_url"], key)
    url = find_video_url(result)
    if not url:
        state.set(sid, status="failed", error="no video url in result")
        raise RuntimeError(f"{sid}: no video URL in result: {json.dumps(result)[:500]}")
    tmp = out.with_suffix(".part")
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "campaign-video-generator/1.0"}), timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    os.replace(tmp, out)
    state.set(sid, status="done", file=out.name, video_url=url, finished_at=time.time())
    log(f"{sid}: saved {out}")
    return sid, "done", str(out)


# ---------- main ----------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("shots")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--timeout", type=int, default=1200, help="seconds to wait per shot")
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
            problems.append(f"--only: no generate shot with id {', '.join(sorted(unknown))}")
        jobs = [j for j in jobs if j["id"] in wanted]

    pps = spec.get("price_per_second")
    prices = dict(PRICE_PER_SECOND)
    if isinstance(pps, dict):
        prices.update(pps)
    elif isinstance(pps, (int, float)):
        prices.update({j["model"]: float(pps) for j in jobs})

    clips = base / "clips"
    state = State(clips / "_state.json") if (clips / "_state.json").is_file() else None
    total_s, total_usd, unknown_price = 0.0, 0.0, set()
    print(f"\n{'shot':<16}{'model':<42}{'sec':>5}{'est $':>9}  status")
    for j in jobs:
        p = prices.get(j["model"])
        cost = p * j["seconds"] if p is not None else None
        if p is None:
            unknown_price.add(j["model"])
        cached = (state and not args.force and (clips / f"{j['id']}.mp4").is_file()
                  and state.get(j["id"]).get("hash") == j["hash"])
        if not cached:
            total_s += j["seconds"]
            total_usd += cost or 0.0
        print(f"{j['id']:<16}{j['model']:<42}{j['seconds']:>5.0f}{(f'{cost:.2f}' if cost is not None else '?'):>9}  "
              f"{'cached (free)' if cached else 'to generate'}")
    print(f"\nTo generate: {total_s:.0f}s of video, est. ${total_usd:.2f}"
          + (f" + unknown price for {', '.join(sorted(unknown_price))}" if unknown_price else ""))

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
                 "(get one at fal.ai > Dashboard > Keys). Or use the prompt-pack route.")
    if not jobs:
        print("No generate shots selected.")
        return

    clips.mkdir(parents=True, exist_ok=True)
    state = State(clips / "_state.json")
    failures = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
        futs = {ex.submit(run_job, j, key, base, clips, state, args.force, args.timeout): j["id"] for j in jobs}
        for f in as_completed(futs):
            try:
                f.result()
            except Exception as e:  # report every failure, keep the other shots running
                failures.append(str(e))
                log(f"ERROR {e}")
    print(f"\n{len(jobs) - len(failures)}/{len(jobs)} shots ready in {clips}")
    if failures:
        print("Failed:\n  " + "\n  ".join(failures))
        sys.exit(1)


if __name__ == "__main__":
    main()
