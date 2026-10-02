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
import re
import shutil
import uuid


def properties(source: str) -> dict[str, str]:
    """Read Java properties keys/values, including escapes and continuations."""
    def unescape(value: str) -> str:
        def escaped(match: re.Match) -> str:
            text = match.group(1)
            if text.startswith("u"):
                if len(text) != 5 or not re.fullmatch(r"u[0-9a-fA-F]{4}", text):
                    raise ValueError("invalid properties Unicode escape")
                return chr(int(text[1:], 16))
            return {"t": "\t", "n": "\n", "r": "\r", "f": "\f"}.get(text, text)
        decoded = re.sub(r"\\(u.{0,4}|.)", escaped, value)
        return decoded.encode("utf-16-le", "surrogatepass").decode("utf-16-le")

    result: dict[str, str] = {}
    logical = ""
    pending = False
    lines = re.split(r"\r\n|[\r\n]", source)
    for index, physical in enumerate(lines):
        body = physical.lstrip(" \t\f")
        if not pending and (not body or body.startswith(("#", "!"))):
            continue
        continued = (len(body) - len(body.rstrip("\\"))) % 2 == 1
        logical += body[:-1] if continued else body
        pending = continued
        if continued and index != len(lines) - 1:
            continue
        match = re.match(r"((?:\\.|[^=: \t\f])*)(.*)", logical)
        raw_key, rest = match.groups()
        rest = rest.lstrip(" \t\f")
        if rest.startswith(("=", ":")):
            rest = rest[1:].lstrip(" \t\f")
        result[unescape(raw_key)] = unescape(rest)
        logical = ""
        pending = False
    return result


def prepare(root: pathlib.Path) -> tuple[dict, list[str]]:
    props = root / "server.properties"
    world = properties(props.read_bytes().decode("latin-1")).get("level-name") or "world"
    world_path = (root / world).resolve()
    world_path.relative_to(root.resolve())

    registry_file = root / "config/trueuuid-registry.json"
    original_registry = json.loads(registry_file.read_text()) if registry_file.exists() else {}
    if not isinstance(original_registry, dict):
        raise ValueError("TrueUUID registry must be a JSON object")
    registry = {}
    for name, entry in original_registry.items():
        if not isinstance(entry, dict):
            raise ValueError(f"invalid TrueUUID registry entry for {name}")
        # A malformed entry makes TrueUUID abort its load, potentially leaving
        # later premium names unprotected. Validate the entire input first.
        uuid.UUID(entry["premiumUuid"])
        for field in ("firstVerifiedAt", "lastVerifiedAt"):
            if type(entry.get(field)) is not int:
                raise ValueError(f"invalid TrueUUID {field} for {name}")
        key = name.lower()
        if key in registry and registry[key] != entry:
            raise ValueError(f"conflicting case-insensitive TrueUUID bindings for {name}")
        registry[key] = entry
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
    saved = set()
    for path in (world_path / "playerdata").glob("*.dat"):
        identity = uuid.UUID(path.stem)
        if identity.version == 4:
            saved.add(str(identity))
    reserved = {str(uuid.UUID(entry["premiumUuid"])) for entry in registry.values()}
    missing = saved - reserved
    if missing:
        raise ValueError("missing cached names for saved premium identities: " + ", ".join(sorted(missing)))
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
