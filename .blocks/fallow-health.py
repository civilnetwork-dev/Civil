#!/usr/bin/env python3
# /// block
# name = "fallow-health"
# summary = "Fallow health score, grade, non-zero penalties and the functions over a line limit, in one run."
# effects = "exec"
# example = ["--cmd", "python3 \"$FIXTURES/fake_fallow.py\""]
# matches = ['fallow health', 'line_count']
#
# [returns]
# keys = ["score", "grade", "penalties", "long_count", "long_functions"]
# doc = "penalties keeps only non-zero entries; long_functions lists the longest as path:line name (lines), at most --top"
#
# [params]
# cmd = { type = "str", default = "bunx fallow", help = "Command that runs fallow" }
# limit = { type = "int", default = 60, min = 1, max = 1000, help = "Line limit per function" }
# top = { type = "int", default = 10, min = 1, max = 30, help = "Most long functions to list" }
#
# [provenance]
# created = "2026-11-11"
# source = "local"
#
# [stamp]
# verified = "94124a6d19c4"
# ///
"""Run fallow health once with every function as a finding; report the score and long functions."""
import argparse
import json
import subprocess
import sys

ARGS = "health --score --complexity --max-cyclomatic 0 --report-only --format json --quiet"


def report(cmd):
    proc = subprocess.run(
        f"{cmd} {ARGS}", shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    out = proc.stdout
    start = out.find("{")
    if start < 0:
        tail = (proc.stderr or out).strip()[-300:]
        raise ValueError(f"fallow printed no JSON (exit {proc.returncode}): {tail}")
    return json.loads(out[start:])


def summarize(data, limit, top):
    score = data.get("health_score") or {}
    long = [f for f in data.get("findings") or [] if f.get("line_count", 0) > limit]
    long.sort(key=lambda f: -f["line_count"])
    return {
        "score": score.get("score"),
        "grade": score.get("grade"),
        "penalties": {k: v for k, v in (score.get("penalties") or {}).items() if v},
        "long_count": len(long),
        "long_functions": [f"{f['path']}:{f['line']} {f['name']} ({f['line_count']})" for f in long[:top]],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cmd", default="bunx fallow", help="Command that runs fallow")
    parser.add_argument("--limit", type=int, default=60, help="Line limit per function (1-1000)")
    parser.add_argument("--top", type=int, default=10, help="Most long functions to list (1-30)")
    args = parser.parse_args()
    if not 1 <= args.limit <= 1000 or not 1 <= args.top <= 30:
        parser.error("--limit must be 1-1000 and --top 1-30")
    return summarize(report(args.cmd), args.limit, args.top)


if __name__ == "__main__":
    try:
        answer, code = main(), 0
    except (OSError, ValueError) as exc:
        answer, code = {"error": str(exc)}, 1
    print(json.dumps(answer))
    sys.exit(code)
