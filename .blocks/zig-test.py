#!/usr/bin/env python3
# /// block
# name = "zig-test"
# summary = "Run a zig build step; return step and test counts, the first error and the zig version."
# effects = "exec"
# example = ["--dir", "$FIXTURES", "--zig", "python3 \"$FIXTURES/fake_zig.py\""]
# matches = ['zig(\.exe)?"? build test', 'zig(\.exe)?"? build test-jsdefender']
#
# [returns]
# keys = ["ok", "zig_version", "steps", "tests", "first_error", "exit", "log", "duration_s"]
# doc = "steps and tests are passed/total from the Build Summary line, or null when it is missing; first_error is the first compiler or test error line; a first_error under zig-pkg/ means the toolchain and package versions do not match"
#
# [params]
# dir = { type = "path", default = "misc/obfuscatti", help = "Folder holding build.zig" }
# step = { type = "str", default = "test", help = "Build step, such as test or test-jsdefender" }
# zig = { type = "str", default = "zig", help = "Zig executable, or a command that stands in for it" }
# timeout = { type = "int", default = 1800, min = 1, max = 7200, help = "Seconds before the build is stopped" }
#
# [provenance]
# created = "2026-11-11"
# source = "local"
#
# [stamp]
# verified = "1bf7d05e7776"
# ///
"""Run `zig build <step> --summary all` and report the summary instead of the whole log."""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time

STEPS = re.compile(r"Build Summary: (\d+)/(\d+) steps succeeded")
TESTS = re.compile(r"(\d+)/(\d+) tests passed")
FIRST_ERROR = re.compile(r"(?:^|: )error: |^\s*FAIL\b|test failure", re.M)
MAX_LINE = 220


def zig_version(zig, cwd):
    proc = subprocess.run(f"{zig} version", shell=True, cwd=cwd, capture_output=True, text=True, errors="replace")
    return proc.stdout.strip() or None


def build(args):
    fd, log = tempfile.mkstemp(prefix="zig-test-", suffix=".log", dir=os.environ.get("BLOCKS_OUT") or None)
    started = time.monotonic()
    with os.fdopen(fd, "wb") as fh:
        try:
            proc = subprocess.run(
                f"{args.zig} build {args.step} --summary all",
                shell=True, cwd=args.dir, stdin=subprocess.DEVNULL, stdout=fh, stderr=subprocess.STDOUT,
                timeout=args.timeout,
            )
        except subprocess.TimeoutExpired:
            raise ValueError(f"timed out after {args.timeout}s; partial log: {log}") from None
    with open(log, encoding="utf-8", errors="replace") as fh:
        text = fh.read()
    return proc.returncode, text, log, round(time.monotonic() - started, 2)


def fraction(regex, text):
    match = regex.search(text)
    return f"{match[1]}/{match[2]}" if match else None


def first_error(text):
    for line in text.splitlines():
        if FIRST_ERROR.search(line):
            return line.strip()[:MAX_LINE]
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", default="misc/obfuscatti", help="Folder holding build.zig")
    parser.add_argument("--step", default="test", help="Build step")
    parser.add_argument("--zig", default="zig", help="Zig executable or stand-in command")
    parser.add_argument("--timeout", type=int, default=1800, help="Seconds before the build is stopped (1-7200)")
    args = parser.parse_args()
    if not 1 <= args.timeout <= 7200:
        parser.error("--timeout must be between 1 and 7200")
    if not os.path.isfile(os.path.join(args.dir, "build.zig")):
        raise ValueError(f"no build.zig in {args.dir}")
    code, text, log, duration = build(args)
    return {
        "ok": code == 0,
        "zig_version": zig_version(args.zig, args.dir),
        "steps": fraction(STEPS, text),
        "tests": fraction(TESTS, text),
        "first_error": None if code == 0 else first_error(text),
        "exit": code,
        "log": log,
        "duration_s": duration,
    }


if __name__ == "__main__":
    try:
        answer, code = main(), 0
    except (OSError, ValueError) as exc:
        answer, code = {"error": str(exc)}, 1
    print(json.dumps(answer))
    sys.exit(code)
