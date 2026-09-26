#!/usr/bin/env python3
"""Apply runtime-only SNBT overlays to an existing TFG server world."""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
POLICY = ROOT / "nstut" / "runtime-overlays.json"


def level_name(server_root: pathlib.Path) -> str:
    props = server_root / "server.properties"
    if props.is_file():
        for raw in props.read_text(encoding="utf-8", errors="replace").splitlines():
            if raw.startswith("level-name="):
                return raw.partition("=")[2].strip() or "world"
    return "world"


def replace_values(path: pathlib.Path, values: dict[str, int], replace_all: bool, dry_run: bool):
    if not path.is_file():
        print(f"skip missing {path}")
        return False
    original = path.read_text(encoding="utf-8")
    updated = original
    for key, value in values.items():
        pattern = re.compile(
            rf"^(?P<prefix>\s*{re.escape(key)}\s*:\s*)(?P<value>-?\d+)(?P<suffix>\s*)$",
            re.MULTILINE,
        )
        matches = list(pattern.finditer(updated))
        if not matches:
            raise RuntimeError(f"key {key!r} not found in {path}")
        if not replace_all and len(matches) != 1:
            raise RuntimeError(f"key {key!r} is ambiguous in {path}")
        updated = pattern.sub(
            lambda m: f"{m.group('prefix')}{value}{m.group('suffix')}",
            updated,
            count=0 if replace_all else 1,
        )
    if updated == original:
        print(f"current {path}")
        return False
    print(f"{'would patch' if dry_run else 'patch'} {path}")
    if not dry_run:
        path.write_text(updated, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("server_root", type=pathlib.Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    server_root = args.server_root.resolve()
    world = (server_root / level_name(server_root)).resolve()
    try:
        world.relative_to(server_root)
    except ValueError:
        print("refusing level-name outside server root", file=sys.stderr)
        return 2

    policy = json.loads(POLICY.read_text(encoding="utf-8-sig"))
    changed = False
    for overlay in policy["overlays"]:
        if overlay["format"] not in {"snbt", "snbtAll"}:
            continue
        rel = overlay["path"].replace("{levelName}", world.name)
        changed |= replace_values(
            server_root / rel,
            overlay["values"],
            overlay["format"] == "snbtAll",
            args.dry_run,
        )
    print("runtime SNBT overlays changed files" if changed else "runtime SNBT overlays already current")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
