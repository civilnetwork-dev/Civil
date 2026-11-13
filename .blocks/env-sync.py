#!/usr/bin/env python3
# /// block
# name = "env-sync"
# summary = "Required env vars in misc/env.ts missing from .env.example, compose app env or tests/setup.ts."
# effects = "read"
# example = ["--env", "$FIXTURES/env.ts.txt", "--dotenv", "$FIXTURES/dotenv.txt", "--compose", "$FIXTURES/compose.yml.txt", "--setup", "$FIXTURES/setup.ts.txt"]
# matches = ['REQUIRED_ENV', 'TEST_ENV_DEFAULTS']
#
# [returns]
# keys = ["ok", "required", "missing"]
# doc = "required is REQUIRED_ENV in order; missing maps each other file to the required names it lacks and is empty when ok"
#
# [params]
# env = { type = "path", default = "misc/env.ts", help = "File declaring REQUIRED_ENV" }
# dotenv = { type = "path", default = ".env.example", help = "Example env file; keys above its '# Optional' heading count" }
# compose = { type = "path", default = "docker-compose.yml", help = "Compose file whose app service environment counts" }
# setup = { type = "path", default = "tests/setup.ts", help = "Test setup declaring TEST_ENV_DEFAULTS" }
#
# [provenance]
# created = "2026-11-11"
# source = "local"
#
# [stamp]
# verified = "2b699a9e2ad9"
# ///
"""Check the four places AGENTS.md says must list the same required env vars."""
import argparse
import json
import re
import sys

REQUIRED = re.compile(r"REQUIRED_ENV\s*=\s*\[(.*?)\]", re.S)
QUOTED = re.compile(r"[\"']([A-Z][A-Z0-9_]*)[\"']")
DOTENV_KEY = re.compile(r"(?m)^([A-Z][A-Z0-9_]*)=")
OPTIONAL = re.compile(r"(?m)^#\s*Optional\b")
APP_SERVICE = re.compile(r"(?ms)^  app:\n(.*?)(?=^  \S|\Z)")
YAML_KEY = re.compile(r"(?m)^\s{4,}([A-Z][A-Z0-9_]*):")
TEST_DEFAULTS = re.compile(r"TEST_ENV_DEFAULTS[^=]*=\s*\{(.*?)\n\};", re.S)
OBJECT_KEY = re.compile(r"(?m)^\s+([A-Z][A-Z0-9_]*):")


def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def required_names(text):
    match = REQUIRED.search(text)
    if not match:
        raise ValueError("REQUIRED_ENV array not found")
    return QUOTED.findall(match.group(1))


def dotenv_keys(text):
    """Keys above the '# Optional' heading."""
    return set(DOTENV_KEY.findall(OPTIONAL.split(text, maxsplit=1)[0]))


def compose_keys(text):
    """Upper-case keys inside the compose `app` service."""
    match = APP_SERVICE.search(text)
    return set(YAML_KEY.findall(match.group(1))) if match else set()


def setup_keys(text):
    match = TEST_DEFAULTS.search(text)
    return set(OBJECT_KEY.findall(match.group(1))) if match else set()


def check(args):
    required = required_names(read(args.env))
    found = {
        args.dotenv: dotenv_keys(read(args.dotenv)),
        args.compose: compose_keys(read(args.compose)),
        args.setup: setup_keys(read(args.setup)),
    }
    missing = {}
    for path, keys in found.items():
        absent = [name for name in required if name not in keys]
        if absent:
            missing[path] = absent
    return {"ok": not missing, "required": required, "missing": missing}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", default="misc/env.ts", help="File declaring REQUIRED_ENV")
    parser.add_argument("--dotenv", default=".env.example", help="Example env file")
    parser.add_argument("--compose", default="docker-compose.yml", help="Compose file with the app service")
    parser.add_argument("--setup", default="tests/setup.ts", help="Test setup declaring TEST_ENV_DEFAULTS")
    return check(parser.parse_args())


if __name__ == "__main__":
    try:
        answer, code = main(), 0
    except (OSError, ValueError) as exc:
        answer, code = {"error": str(exc)}, 1
    print(json.dumps(answer))
    sys.exit(code)
