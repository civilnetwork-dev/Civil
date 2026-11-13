#!/usr/bin/env python3
# /// block
# name = "test-summary"
# summary = "Run a test command; return pass/fail counts, the first failure and its trace head, log path."
# effects = "exec"
# example = ["--cmd", "python3 $FIXTURES/fake_tests.py"]
# matches = ['subprocess\.run\(.*test']
#
# [returns]
# keys = ["passed", "failed", "skipped", "first_failure", "exit", "log", "duration_s"]
# doc = "Counts parsed from pytest, go test, vitest/jest and cargo summaries (go counts need -v); first_failure is {name, trace_head} or null; exit is the command's exit code; log holds the full output"
#
# [params]
# cmd = { type = "str", required = true, help = "Test command, run through the shell from the current directory" }
# timeout = { type = "int", default = 300, min = 1, max = 3600, help = "Seconds before the command is killed" }
#
# [provenance]
# created = "2026-10-03"
# source = "registry:test-summary@0.1.0"
#
# [stamp]
# verified = "fcb761231621"
# ///
"""Run a test command, keep its output in a log file and print counts plus the first failure."""
import argparse
import json
import os
import re
import signal
import subprocess
import sys
import tempfile
import time

TRACE_LINES = 30
TRACE_CHARS = 1200
MAX_LINE = 120

SUMMARY_LINE = re.compile(r"^=+ .*\d+ (passed|failed|error)|^test result:|^\s*Tests:?\s")
COUNT = re.compile(r"(\d+) (passed|failed|skipped|ignored|errors?)\b")
ALIAS = {"ignored": "skipped", "error": "failed", "errors": "failed"}
GO_RESULT = re.compile(r"^\s*--- (PASS|FAIL|SKIP):")
GO_WORD = {"PASS": "passed", "FAIL": "failed", "SKIP": "skipped"}
GO_FAIL = re.compile(r"^\s*--- FAIL: (\S+)")
FAILURE = [  # in priority order; the first pattern with any hit names the failure
    re.compile(r"^_{3,} (.+?) _{3,}$"),  # pytest section header
    GO_FAIL,
    re.compile(r"^---- (\S+) stdout ----$"),  # cargo
    re.compile(r"^\s*● (?!Console)(.+)$"),  # jest "● suite › name"
    re.compile(r"^\s*FAIL\s+(.+)$"),  # vitest, jest file line
    re.compile(r"^FAILED (\S+)"),  # pytest short summary
]


def tally(lines):
    counts = {"passed": 0, "failed": 0, "skipped": 0}
    found = False
    for line in lines:
        if SUMMARY_LINE.search(line):
            for number, word in COUNT.findall(line):
                counts[ALIAS.get(word, word)] += int(number)
                found = True
    if not found:  # go test prints no totals; count its per-test lines
        for line in lines:
            match = GO_RESULT.match(line)
            if match:
                counts[GO_WORD[match[1]]] += 1
    return counts


def head(lines):
    out, size = [], 0
    for line in lines[:TRACE_LINES]:
        line = line[:MAX_LINE]
        if not out and not line.strip():
            continue
        size += len(line)
        if size > TRACE_CHARS:
            break
        out.append(line)
    return out


def first_failure(lines):
    for pattern in FAILURE:
        for i, line in enumerate(lines):
            match = pattern.match(line)
            if not match:
                continue
            start = i
            if pattern is GO_FAIL:  # go -v streams a test's log lines before its --- FAIL line
                while start > 0 and lines[start - 1][:1] in (" ", "\t"):
                    start -= 1
            trace = lines[start:i] + lines[i + 1:]
            return {"name": match[1].strip()[:MAX_LINE], "trace_head": head(trace)}
    return None


def run(cmd, timeout):
    fd, log = tempfile.mkstemp(prefix="test-summary-", suffix=".log", dir=os.environ.get("BLOCKS_OUT") or None)
    started = time.monotonic()
    with os.fdopen(fd, "wb") as fh:
        # ponytail: POSIX process groups; Windows needs CREATE_NEW_PROCESS_GROUP and taskkill
        proc = subprocess.Popen(
            cmd, shell=True, stdin=subprocess.DEVNULL, stdout=fh, stderr=subprocess.STDOUT, start_new_session=True
        )
        try:
            code = proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)
            proc.wait()
            raise TimeoutError(f"timed out after {timeout}s; partial log: {log}") from None
    duration = round(time.monotonic() - started, 2)
    with open(log, encoding="utf-8", errors="replace") as fh:
        lines = fh.read().splitlines()
    answer = tally(lines)
    answer.update({"first_failure": first_failure(lines), "exit": code, "log": log, "duration_s": duration})
    return answer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cmd", required=True, help="Test command, run through the shell from the current directory")
    parser.add_argument("--timeout", type=int, default=300, help="Seconds before the command is killed (1-3600)")
    args = parser.parse_args()
    if not 1 <= args.timeout <= 3600:
        parser.error("--timeout must be between 1 and 3600")
    return run(args.cmd, args.timeout)


if __name__ == "__main__":
    try:
        answer, code = main(), 0
    except (OSError, ValueError) as exc:
        answer, code = {"error": str(exc)}, 1
    print(json.dumps(answer))
    sys.exit(code)
