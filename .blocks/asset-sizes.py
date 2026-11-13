#!/usr/bin/env python3
# /// block
# name = "asset-sizes"
# summary = "Largest files in a build output folder, the total size and how many exceed a size limit."
# effects = "read"
# example = ["--dir", "$FIXTURES/assets", "--top", "2", "--limit", "1"]
# matches = ['_build/assets', 'stat -c%s']
#
# [returns]
# keys = ["files", "total_kb", "over", "largest"]
# doc = "over counts files larger than --limit KB; largest lists the biggest as name and kb, at most --top"
#
# [params]
# dir = { type = "path", default = "dist/client/_build/assets", help = "Folder to measure, walked recursively" }
# top = { type = "int", default = 8, min = 1, max = 30, help = "Most files to list" }
# limit = { type = "int", default = 1024, min = 1, max = 1048576, help = "Size limit in KB" }
# ext = { type = "str", default = "", help = "Only files ending in this suffix, such as .js" }
#
# [provenance]
# created = "2026-11-11"
# source = "local"
#
# [stamp]
# verified = "919e1a196936"
# ///
"""Measure a build output folder: total size, files over a limit, and the largest files."""
import argparse
import json
import os
import sys


def sizes(folder, ext):
    if not os.path.isdir(folder):
        raise ValueError(f"{folder} is not a folder; build first")
    for base, _, names in os.walk(folder):
        for name in names:
            if name.endswith(ext):
                path = os.path.join(base, name)
                yield os.path.relpath(path, folder).replace(os.sep, "/"), os.path.getsize(path)


def measure(folder, top, limit, ext):
    files = sorted(sizes(folder, ext), key=lambda item: -item[1])
    return {
        "files": len(files),
        "total_kb": round(sum(size for _, size in files) / 1024, 1),
        "over": sum(1 for _, size in files if size > limit * 1024),
        "largest": [{"name": name, "kb": round(size / 1024, 1)} for name, size in files[:top]],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", default="dist/client/_build/assets", help="Folder to measure")
    parser.add_argument("--top", type=int, default=8, help="Most files to list (1-30)")
    parser.add_argument("--limit", type=int, default=1024, help="Size limit in KB")
    parser.add_argument("--ext", default="", help="Only files ending in this suffix")
    args = parser.parse_args()
    if not 1 <= args.top <= 30 or args.limit < 1:
        parser.error("--top must be 1-30 and --limit at least 1")
    return measure(args.dir, args.top, args.limit, args.ext)


if __name__ == "__main__":
    try:
        answer, code = main(), 0
    except (OSError, ValueError) as exc:
        answer, code = {"error": str(exc)}, 1
    print(json.dumps(answer))
    sys.exit(code)
