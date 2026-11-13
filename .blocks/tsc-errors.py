#!/usr/bin/env python3
# /// block
# name = "tsc-errors"
# summary = "Run the TypeScript check; return the error count, the worst files and the first errors."
# effects = "exec"
# example = ["--cmd", "python3 \"$FIXTURES/fake_tsc.py\""]
# matches = ['tsc --noEmit', 'tsc" --noEmit']
#
# [returns]
# keys = ["errors", "files", "first", "exit"]
# doc = "files maps the files with most errors to their count; first lists the first errors as path:line code message, cut to 160 chars"
#
# [params]
# cmd = { type = "str", default = "bunx tsc --noEmit", help = "Type-check command" }
# top = { type = "int", default = 6, min = 1, max = 20, help = "Most files and errors to list" }
#
# [provenance]
# created = "2026-11-11"
# source = "local"
#
# [stamp]
# verified = "b59b09a7aebc"
# ///
"""Type-check and summarise: count, files with most errors, the first few errors."""
import argparse
import collections
import json
import re
import subprocess
import sys

# tsc: path(line,col): error TS2322: message   or   path:line:col - error TS2322: message
ERROR = re.compile(r"^(.+?)(?:\((\d+),\d+\)|:(\d+):\d+)\s*[:-]\s*error (TS\d+): (.*)$")
MAX_LINE = 160


def check(cmd, top):
    proc = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    errors = []
    for line in (proc.stdout + proc.stderr).splitlines():
        match = ERROR.match(line.strip())
        if match:
            path, line_a, line_b, code, message = match.groups()
            errors.append((path.replace("\\", "/"), line_a or line_b, code, message))
    if proc.returncode and not errors:
        tail = (proc.stderr or proc.stdout).strip()[-300:]
        raise ValueError(f"type check failed without TS errors (exit {proc.returncode}): {tail}")
    by_file = collections.Counter(path for path, *_ in errors)
    return {
        "errors": len(errors),
        "files": dict(by_file.most_common(top)),
        "first": [f"{p}:{n} {c} {m}"[:MAX_LINE] for p, n, c, m in errors[:top]],
        "exit": proc.returncode,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cmd", default="bunx tsc --noEmit", help="Type-check command")
    parser.add_argument("--top", type=int, default=6, help="Most files and errors to list (1-20)")
    args = parser.parse_args()
    if not 1 <= args.top <= 20:
        parser.error("--top must be 1-20")
    return check(args.cmd, args.top)


if __name__ == "__main__":
    try:
        answer, code = main(), 0
    except (OSError, ValueError) as exc:
        answer, code = {"error": str(exc)}, 1
    print(json.dumps(answer))
    sys.exit(code)
