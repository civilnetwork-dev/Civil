#!/usr/bin/env python3
# /// block
# name = "dep-pins"
# summary = "Check package.json overrides and patched versions against what is installed."
# effects = "read"
# example = ["--manifest", "$FIXTURES/manifest.json", "--modules", "$FIXTURES/modules"]
# matches = ['router-core/node_modules', 'npm view @tanstack/solid-router', 'npm view solid-js']
#
# [returns]
# keys = ["ok", "checked", "problems"]
# doc = "problems has one sentence per broken pin: an override that differs from the version its owner pins, a patch keyed to a version that is not installed, a missing patch file, or a nested router-core node_modules"
#
# [params]
# manifest = { type = "path", default = "package.json", help = "Root package.json" }
# modules = { type = "path", default = "node_modules", help = "Installed packages folder" }
#
# [provenance]
# created = "2026-11-11"
# source = "local"
#
# [stamp]
# verified = "2632df293298"
# ///
"""Overrides must equal the version their owner pins; patches must match installed versions."""
import argparse
import json
import os
import sys

# override -> package whose own dependency pin it has to equal
OWNERS = {
    "@tanstack/router-core": "@tanstack/solid-router",
    "@tanstack/history": "@tanstack/router-core",
    "seroval": "solid-js",
    "seroval-plugins": "solid-js",
}
NESTED = ("@tanstack/router-core", "node_modules")


def installed(modules, name):
    path = os.path.join(modules, *name.split("/"), "package.json")
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def check_overrides(overrides, modules, problems):
    checked = 0
    for dep, owner in OWNERS.items():
        if dep not in overrides:
            continue
        meta = installed(modules, owner)
        if meta is None:
            problems.append(f"{owner} is not installed, so overrides.{dep} cannot be checked")
            continue
        checked += 1
        pin = (meta.get("dependencies") or {}).get(dep)
        if pin is None:
            problems.append(f"{owner} {meta.get('version')} no longer depends on {dep}: drop overrides.{dep}?")
        elif pin.lstrip("^~=") != overrides[dep]:
            problems.append(f"overrides.{dep} is {overrides[dep]} but {owner} {meta.get('version')} pins {pin}")
    return checked


def check_patches(patched, root, modules, problems):
    for key, patch in patched.items():
        name, _, version = key.rpartition("@")
        meta = installed(modules, name)
        have = meta.get("version") if meta else None
        if have != version:
            problems.append(f"patch {key} but {name} {have} is installed: port it with bun patch")
        if not os.path.isfile(os.path.join(root, patch)):
            problems.append(f"patch file {patch} is missing")
    return len(patched)


def check(manifest_path, modules):
    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    root = os.path.dirname(manifest_path) or "."
    problems = []
    checked = check_overrides(manifest.get("overrides") or {}, modules, problems)
    checked += check_patches(manifest.get("patchedDependencies") or {}, root, modules, problems)
    if os.path.isdir(os.path.join(modules, *NESTED)):
        problems.append("node_modules/@tanstack/router-core/node_modules exists: a second history or core copy")
    return {"ok": not problems, "checked": checked, "problems": problems}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", default="package.json", help="Root package.json")
    parser.add_argument("--modules", default="node_modules", help="Installed packages folder")
    args = parser.parse_args()
    return check(args.manifest, args.modules)


if __name__ == "__main__":
    try:
        answer, code = main(), 0
    except (OSError, ValueError) as exc:
        answer, code = {"error": str(exc)}, 1
    print(json.dumps(answer))
    sys.exit(code)
