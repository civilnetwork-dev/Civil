#!/usr/bin/env python3
# /// block
# name = "json-peek"
# summary = "Shape of a JSON or JSONL file: keys, row count, one sample. Never the data."
# effects = "read"
# example = ["--path", "$FIXTURES/sample.json", "--depth", "2"]
# matches = ['json\.load\(open', 'json\.loads?\(.*\.read\(\)', 'json\.load\(sys\.stdin']
#
# [returns]
# keys = ["kind", "keys", "rows", "sample", "truncated"]
# doc = "kind is object|array|jsonl|scalar; keys are dotted paths, top level first, at most 20; rows is the array length, JSONL line count or 1; sample is the first element with values cut to 60 chars"
#
# [params]
# path = { type = "path", required = true, help = "JSON or JSONL file inside the repo" }
# depth = { type = "int", default = 2, min = 1, max = 10, help = "How deep to walk nested keys" }
#
# [provenance]
# created = "2026-10-03"
# source = "registry:json-peek@0.1.0"
#
# [stamp]
# verified = "6a6aa0c6a5d1"
# ///
"""Print the shape of a JSON or JSONL file: kind, dotted keys, row count and one truncated sample."""
import argparse
import json
import sys

MAX_KEYS = 20
MAX_SAMPLE_KEYS = 12
MAX_VALUE = 60
SCAN_ROWS = 1000
SCAN_NESTED = 20
COLLECT_KEYS = 500


def load(path):
    """Return ("doc", parsed JSON) or ("jsonl", list of rows)."""
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    if not path.endswith((".jsonl", ".ndjson")):
        try:
            return "doc", json.loads(text)
        except json.JSONDecodeError:
            pass  # not one document; try JSONL
    rows = []
    for n, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise ValueError(f"not JSON or JSONL: line {n}: {exc.msg}") from None
    return "jsonl", rows


def walk(value, prefix, depth, seen):
    """Collect dotted key paths of value into seen, mapping each path to its level."""
    if depth == 0 or len(seen) >= COLLECT_KEYS:
        return
    if isinstance(value, list):
        for item in value[:SCAN_NESTED]:
            walk(item, prefix + "[]", depth, seen)
    elif isinstance(value, dict):
        for key, child in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            seen.setdefault(path, path.count(".") + path.count("[]"))
            walk(child, path, depth - 1, seen)


def cut(value):
    """Return value, or its JSON text cut to MAX_VALUE chars, and whether it was cut."""
    if value is None or isinstance(value, (bool, int, float)):
        return value, False
    text = value if isinstance(value, str) else json.dumps(value)
    if len(text) <= MAX_VALUE:
        return value, False
    return text[:MAX_VALUE] + "...", True


def peek(path, depth):
    form, data = load(path)
    if form == "jsonl" or isinstance(data, list):
        kind = "jsonl" if form == "jsonl" else "array"
        rows, scan = len(data), data[:SCAN_ROWS]
        first = data[0] if data else None
    else:
        kind = "object" if isinstance(data, dict) else "scalar"
        rows, scan, first = 1, [data], data

    seen = {}
    for row in scan:
        walk(row, "", depth, seen)
    keys = sorted(seen, key=seen.get)  # stable: top level first, then file order
    truncated = len(keys) > MAX_KEYS

    if isinstance(first, dict):
        sample = {}
        truncated = truncated or len(first) > MAX_SAMPLE_KEYS
        for key, value in list(first.items())[:MAX_SAMPLE_KEYS]:
            sample[key], was_cut = cut(value)
            truncated = truncated or was_cut
    else:
        sample, was_cut = cut(first)
        truncated = truncated or was_cut

    return {"kind": kind, "keys": keys[:MAX_KEYS], "rows": rows, "sample": sample, "truncated": truncated}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", required=True, help="JSON or JSONL file inside the repo")
    parser.add_argument("--depth", type=int, default=2, help="How deep to walk nested keys (1-10)")
    args = parser.parse_args()
    if not 1 <= args.depth <= 10:
        parser.error("--depth must be between 1 and 10")
    return peek(args.path, args.depth)


if __name__ == "__main__":
    try:
        answer, code = main(), 0
    except (OSError, ValueError) as exc:
        answer, code = {"error": str(exc)}, 1
    print(json.dumps(answer))
    sys.exit(code)
