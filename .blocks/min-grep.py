#!/usr/bin/env python3
# /// block
# name = "min-grep"
# summary = "Regex hits inside large or minified files: file, character offset and the text around each hit."
# effects = "read"
# example = ["--path", "$FIXTURES/bundle.min.txt", "--pattern", '\$sc\w+|bare-mux-\w+', "--context", "12"]
# matches = ['readFileSync\([^)]*\.min\.js', 'readFileSync\([^)]*_build', '\.indexOf\([^)]*\)[\s\S]*slice\(']
#
# [returns]
# keys = ["files", "hits", "shown", "truncated"]
# doc = "files counts files searched; hits counts every match; shown lists file, offset and snippet for the first matches, trimmed to fit the 2 KB cap; truncated is true when shown is not all hits"
#
# [params]
# path = { type = "path", required = true, help = "File or folder to search" }
# pattern = { type = "str", required = true, help = "Python regular expression; prefix (?i) to ignore case" }
# context = { type = "int", default = 60, min = 0, max = 400, help = "Characters kept on each side of a hit" }
# max = { type = "int", default = 8, min = 1, max = 40, help = "Most hits to show" }
# ext = { type = "str", default = ".js", help = "File suffix to search when path is a folder" }
#
# [provenance]
# created = "2026-11-11"
# source = "local"
#
# [stamp]
# verified = "e838bda2a4a4"
# ///
"""Search minified bundles, where line numbers mean nothing, by character offset with context."""
import argparse
import json
import os
import re
import sys

MAX_FILES = 5000
BUDGET = 1800  # bytes of JSON; caveman-blocks run caps output at 2 KB


def targets(path, ext):
    if os.path.isfile(path):
        yield path
        return
    if not os.path.isdir(path):
        raise ValueError(f"{path} does not exist")
    count = 0
    for base, _, names in os.walk(path):
        for name in sorted(names):
            if name.endswith(ext):
                count += 1
                if count > MAX_FILES:
                    raise ValueError(f"more than {MAX_FILES} files under {path}; narrow --path or --ext")
                yield os.path.join(base, name)


def search(args):
    regex = re.compile(args.pattern)
    files, hits, shown = 0, 0, []
    for path in targets(args.path, args.ext):
        files += 1
        with open(path, encoding="utf-8", errors="replace") as fh:
            text = fh.read()
        for match in regex.finditer(text):
            hits += 1
            if len(shown) < args.max:
                start, end = match.span()
                snippet = text[max(0, start - args.context):end + args.context]
                shown.append({"file": path.replace(os.sep, "/"), "offset": start, "snippet": snippet})
    answer = {"files": files, "hits": hits, "shown": shown, "truncated": hits > len(shown)}
    while shown and len(json.dumps(answer)) > BUDGET:
        shown.pop()
        answer["truncated"] = True
    return answer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", required=True, help="File or folder to search")
    parser.add_argument("--pattern", required=True, help="Python regular expression")
    parser.add_argument("--context", type=int, default=60, help="Characters kept on each side (0-400)")
    parser.add_argument("--max", type=int, default=8, help="Most hits to show (1-40)")
    parser.add_argument("--ext", default=".js", help="File suffix to search when path is a folder")
    args = parser.parse_args()
    if not 0 <= args.context <= 400 or not 1 <= args.max <= 40:
        parser.error("--context must be 0-400 and --max 1-40")
    try:
        return search(args)
    except re.error as exc:
        raise ValueError(f"bad --pattern: {exc}") from None


if __name__ == "__main__":
    try:
        answer, code = main(), 0
    except (OSError, ValueError) as exc:
        answer, code = {"error": str(exc)}, 1
    print(json.dumps(answer))
    sys.exit(code)
