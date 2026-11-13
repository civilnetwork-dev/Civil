#!/usr/bin/env python3
# /// block
# name = "districts-sentinel"
# summary = "Row count of the school districts DB; add or remove the sentinel row that stops a 210 MB download."
# effects = "write-workspace"
# example = ["--db", "$FIXTURES/districts.sqlite", "--action", "status"]
# matches = ['districts\.sqlite', '__harness__']
#
# [returns]
# keys = ["action", "rows", "sentinel"]
# doc = "rows counts districts after the action; sentinel says whether the __harness__ row is present. The server downloads the NCES shapefile on start whenever rows is 0"
#
# [params]
# db = { type = "path", default = "misc/schoolDistricts/data/districts.sqlite", help = "Districts SQLite database" }
# action = { type = "str", default = "status", help = "status reads; add inserts the sentinel row; remove deletes it" }
#
# [provenance]
# created = "2026-11-11"
# source = "local"
#
# [stamp]
# verified = "d8c84133c7e5"
# ///
"""Keep a local server start from downloading the ~210 MB districts shapefile into an empty DB."""
import argparse
import json
import os
import sqlite3
import sys

SENTINEL = "__harness__"
ACTIONS = ("status", "add", "remove")


def apply(db, action):
    if not os.path.isfile(db):
        raise ValueError(f"{db} does not exist; start the server once or pass --db")
    target = f"file:{db}?mode=ro" if action == "status" else f"file:{db}"
    with sqlite3.connect(target, uri=True) as conn:
        has = lambda: conn.execute("SELECT 1 FROM districts WHERE lea_id = ?", (SENTINEL,)).fetchone() is not None
        if action == "add" and not has():
            conn.execute(
                "INSERT INTO districts (lea_id, name, lat, lon) VALUES (?, ?, 0, 0)", (SENTINEL, "harness sentinel")
            )
        elif action == "remove":
            conn.execute("DELETE FROM districts WHERE lea_id = ?", (SENTINEL,))
        rows = conn.execute("SELECT COUNT(*) FROM districts").fetchone()[0]
        return {"action": action, "rows": rows, "sentinel": has()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default="misc/schoolDistricts/data/districts.sqlite", help="Districts database")
    parser.add_argument("--action", default="status", choices=ACTIONS, help="status, add or remove")
    args = parser.parse_args()
    try:
        return apply(args.db, args.action)
    except sqlite3.Error as exc:
        raise ValueError(f"sqlite: {exc}") from None


if __name__ == "__main__":
    try:
        answer, code = main(), 0
    except (OSError, ValueError) as exc:
        answer, code = {"error": str(exc)}, 1
    print(json.dumps(answer))
    sys.exit(code)
