#!/usr/bin/env python3
# /// block
# name = "gate"
# summary = "Pre-commit gate: oxlint, oxfmt, tsc, vitest and the Fallow score, one compact verdict per check."
# effects = "exec"
# example = ["--lint", "python3 \"$FIXTURES/ok.py\"", "--format", "python3 \"$FIXTURES/format_bad.py\"", "--tsc", "python3 \"$FIXTURES/ok.py\"", "--vitest", "python3 \"$FIXTURES/vitest_ok.py\"", "--fallow", "python3 \"$FIXTURES/fake_fallow.py\""]
# matches = ['lint:check[\s\S]*format:check', 'format:check[\s\S]*lint:check']
#
# [returns]
# keys = ["ok", "failed", "results"]
# doc = "results maps each check that ran (lint, format, tsc, tests, fallow) to its verdict with a few details; failed lists the checks that failed; fallow fails below --score"
#
# [params]
# checks = { type = "str", default = "lint,format,tsc,tests,fallow", help = "Comma list of checks to run" }
# tests = { type = "str", default = "", help = "Test paths passed to vitest; empty runs the whole suite" }
# score = { type = "int", default = 100, min = 0, max = 100, help = "Lowest Fallow score that passes" }
# lint = { type = "str", default = "bun run lint:check", help = "Lint command" }
# format = { type = "str", default = "bun run format:check", help = "Format check command" }
# tsc = { type = "str", default = "bunx tsc --noEmit", help = "Type-check command, run through the tsc-errors block" }
# vitest = { type = "str", default = "bunx vitest run", help = "Test command, run through the test-summary block" }
# fallow = { type = "str", default = "bunx fallow", help = "Fallow command, run through the fallow-health block" }
#
# [provenance]
# created = "2026-11-11"
# source = "local"
#
# [stamp]
# verified = "e10e8f6f4589"
# ///
"""Run the checks a Civil commit needs and answer with one verdict per check."""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

CHECKS = ("lint", "format", "tsc", "tests", "fallow")
LINT_COUNTS = re.compile(r"Found (\d+) warnings? and (\d+) errors?")
FORMAT_FILE = re.compile(r"(?m)^(\S.*?) \(\d+ms\)$")
BUDGET = 1800  # bytes of JSON; caveman-blocks run caps output at 2 KB


def blocks_binary():
    installed = os.path.join(os.path.expanduser("~"), ".local", "share", "caveman-blocks", "bin", "caveman-blocks")
    for candidate in (os.environ.get("CAVEMAN_BLOCKS_BIN"), installed, installed + ".exe"):
        if candidate and os.path.isfile(candidate):
            return candidate
    found = shutil.which("caveman-blocks")
    if not found:
        raise ValueError("caveman-blocks not found; set CAVEMAN_BLOCKS_BIN")
    return found


def block(name, *argv):
    """Compose: run another block and return its JSON answer."""
    proc = subprocess.run([blocks_binary(), "run", name, *argv], capture_output=True, text=True, errors="replace")
    lines = [line for line in proc.stdout.splitlines() if line.startswith("{")]
    if not lines:
        return {"error": (proc.stderr or proc.stdout).strip()[-200:] or f"exit {proc.returncode}"}
    answer = json.loads(lines[-1])
    answer.pop("_unverified", None)
    return answer


def shell(cmd):
    proc = subprocess.run(cmd, shell=True, capture_output=True, text=True, errors="replace")
    return proc.returncode, proc.stdout + proc.stderr


def lint(args):
    code, out = shell(args.lint)
    result = {"ok": code == 0}
    counts = LINT_COUNTS.search(out)
    if counts:
        result.update(warnings=int(counts[1]), errors=int(counts[2]))
    elif code:
        result["tail"] = out.strip()[-160:]
    return result


def format_check(args):
    code, out = shell(args.format)
    result = {"ok": code == 0}
    if code:
        files = FORMAT_FILE.findall(out)
        result.update(count=len(files), files=files[:5])
    return result


def tsc(args):
    answer = block("tsc-errors", "--cmd", args.tsc, "--top", "3")
    if "error" in answer:
        return {"ok": False, "error": answer["error"]}
    return {"ok": answer["errors"] == 0 and answer["exit"] == 0, "errors": answer["errors"], "first": answer["first"]}


def tests(args):
    answer = block("test-summary", "--cmd", f"{args.vitest} {args.tests}".strip(), "--timeout", "1800")
    if "error" in answer:
        return {"ok": False, "error": answer["error"]}
    failure = answer.get("first_failure") or {}
    return {
        "ok": answer["exit"] == 0 and answer["failed"] == 0,
        "passed": answer["passed"],
        "failed": answer["failed"],
        "first_failure": failure.get("name"),
        "log": answer.get("log"),
    }


def fallow(args):
    answer = block("fallow-health", "--cmd", args.fallow, "--top", "3")
    if "error" in answer:
        return {"ok": False, "error": answer["error"]}
    score = answer.get("score") or 0
    return {"ok": score >= args.score, "score": score, "grade": answer.get("grade"), "long": answer["long_functions"]}


RUNNERS = {"lint": lint, "format": format_check, "tsc": tsc, "tests": tests, "fallow": fallow}


def gate(args):
    chosen = [name.strip() for name in args.checks.split(",") if name.strip()]
    unknown = [name for name in chosen if name not in CHECKS]
    if unknown:
        raise ValueError(f"unknown checks {unknown}; choose from {list(CHECKS)}")
    results = {name: RUNNERS[name](args) for name in chosen}
    failed = [name for name, result in results.items() if not result["ok"]]
    answer = {"ok": not failed, "failed": failed, "results": results}
    for result in results.values():  # keep under the output cap
        if len(json.dumps(answer)) <= BUDGET:
            break
        for key in ("first", "files", "long", "tail"):
            result.pop(key, None)
    return answer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checks", default=",".join(CHECKS), help="Comma list of checks to run")
    parser.add_argument("--tests", default="", help="Test paths for vitest; empty runs the whole suite")
    parser.add_argument("--score", type=int, default=100, help="Lowest Fallow score that passes (0-100)")
    parser.add_argument("--lint", default="bun run lint:check", help="Lint command")
    parser.add_argument("--format", default="bun run format:check", help="Format check command")
    parser.add_argument("--tsc", default="bunx tsc --noEmit", help="Type-check command")
    parser.add_argument("--vitest", default="bunx vitest run", help="Test command")
    parser.add_argument("--fallow", default="bunx fallow", help="Fallow command")
    args = parser.parse_args()
    if not 0 <= args.score <= 100:
        parser.error("--score must be 0-100")
    return gate(args)


if __name__ == "__main__":
    try:
        answer, code = main(), 0
    except (OSError, ValueError) as exc:
        answer, code = {"error": str(exc)}, 1
    print(json.dumps(answer))
    sys.exit(code)
