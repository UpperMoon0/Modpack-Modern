#!/usr/bin/env python3
"""Reserve existing online identities in TrueUUID without changing player saves.

Run while the server and its wake service are stopped. Inspect the default dry
run first; --apply backs up the registry before installing the reserved names.
"""

from __future__ import annotations

import argparse
import datetime
import json
import pathlib
import shutil
import uuid


def prepare(root: pathlib.Path) -> tuple[dict, list[str]]:
    props = root / "server.properties"
    world = "world"
    for line in props.read_text(encoding="latin-1").splitlines():
        if line.startswith("level-name="):
            world = line.partition("=")[2].strip() or "world"
    world_path = (root / world).resolve()
    world_path.relative_to(root.resolve())

    registry_file = root / "config/trueuuid-registry.json"
    registry = json.loads(registry_file.read_text()) if registry_file.exists() else {}
    candidates: dict[str, str] = {}
    names: dict[str, str] = {}
    def add(name: str, value: str) -> None:
        identity = uuid.UUID(value)
        # Java offline IDs are v3; only existing v4 premium saves are reserved.
        if identity.version != 4 or not (world_path / "playerdata" / f"{identity}.dat").is_file():
            return
        key = name.lower()
        if key in candidates and candidates[key] != str(identity):
            raise ValueError(f"conflicting premium identities for {name}")
        candidates[key] = str(identity)
        names[key] = name

    username_cache = root / "usernamecache.json"
    if username_cache.exists():
        for value, name in json.loads(username_cache.read_text()).items():
            add(name, value)
    for filename in ("usercache.json", "ops.json", "whitelist.json"):
        path = root / filename
        if path.exists():
            for entry in json.loads(path.read_text()):
                add(entry["name"], entry["uuid"])

    for key, value in candidates.items():
        existing = registry.get(key)
        if existing is not None:
            if str(uuid.UUID(existing["premiumUuid"])) != value or existing.get("authSource", "MOJANG") != "MOJANG":
                raise ValueError(f"TrueUUID binding conflicts with saved premium identity for {names[key]}")
            continue
        registry[key] = {
            "premiumUuid": value, "firstVerifiedAt": 0, "lastVerifiedAt": 0,
            "authSource": "MOJANG", "authDisplayName": "Mojang",
        }
    return registry, sorted(names.values())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("server_root", type=pathlib.Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    root = args.server_root.resolve()
    registry, names = prepare(root)
    print("Reserved premium names:", ", ".join(names) or "none")
    path = root / "config/trueuuid-registry.json"
    rendered = json.dumps(registry, indent=2) + "\n"
    if path.exists() and json.loads(path.read_text()) == registry:
        print("TrueUUID registry already current")
        return
    if not args.apply:
        print("Dry run: no files changed. Stop the server before using --apply.")
        return
    if not names:
        raise ValueError("no confirmed premium player saves found; refusing to write")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        shutil.copy2(path, path.with_name(path.name + ".before-" + stamp))
    temporary = path.with_name(path.name + ".new")
    with temporary.open("x", encoding="utf-8") as file:
        file.write(rendered)
    temporary.replace(path)
    print("Installed TrueUUID registry; player and world data unchanged")


if __name__ == "__main__":
    main()
