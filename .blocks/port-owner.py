#!/usr/bin/env python3
# /// block
# name = "port-owner"
# summary = "Which process listens on a TCP port: pid and name, so one dev server can be stopped alone."
# effects = "exec"
# example = ["--port", "9876", "--netstat", "$FIXTURES/netstat.txt"]
# matches = ['Get-NetTCPConnection', 'netstat -ano', 'lsof -i']
#
# [returns]
# keys = ["port", "listening", "owners"]
# doc = "owners lists pid and process name (null when unknown) of every listener; stop one with Stop-Process -Id <pid> or kill <pid>"
#
# [params]
# port = { type = "int", required = true, min = 1, max = 65535, help = "TCP port" }
# netstat = { type = "path", default = "", help = "Parse this saved netstat -ano output instead of asking the OS" }
#
# [provenance]
# created = "2026-11-11"
# source = "local"
#
# [stamp]
# verified = "a4d8c7776378"
# ///
"""Find the listener on a port without killing every Bun process (taskkill /IM bun.exe)."""
import argparse
import csv
import json
import re
import subprocess
import sys

# netstat -ano line: proto, local address, foreign address, state, pid
NETSTAT = re.compile(r"^\s*TCP\s+\S*:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$", re.I | re.M)


def run(args):
    return subprocess.run(args, capture_output=True, text=True, errors="replace").stdout


def windows_listeners(text, port):
    return sorted({int(pid) for found, pid in NETSTAT.findall(text) if int(found) == port})


def windows_name(pid):
    rows = list(csv.reader(run(["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"]).splitlines()))
    return rows[0][0] if rows and len(rows[0]) > 1 else None


def posix_listeners(port):
    out = run(["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-Fpc"])
    owners, pid = [], None
    for line in out.splitlines():
        if line.startswith("p"):
            pid = int(line[1:])
        elif line.startswith("c") and pid is not None:
            owners.append({"pid": pid, "name": line[1:]})
    return owners


def owners_of(args):
    if args.netstat:
        with open(args.netstat, encoding="utf-8") as fh:
            return [{"pid": pid, "name": None} for pid in windows_listeners(fh.read(), args.port)]
    if sys.platform == "win32":
        return [{"pid": pid, "name": windows_name(pid)} for pid in windows_listeners(run(["netstat", "-ano"]), args.port)]
    return posix_listeners(args.port)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, required=True, help="TCP port (1-65535)")
    parser.add_argument("--netstat", default="", help="Saved netstat -ano output to parse instead")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be 1-65535")
    owners = owners_of(args)
    return {"port": args.port, "listening": bool(owners), "owners": owners}


if __name__ == "__main__":
    try:
        answer, code = main(), 0
    except (OSError, ValueError) as exc:
        answer, code = {"error": str(exc)}, 1
    print(json.dumps(answer))
    sys.exit(code)
