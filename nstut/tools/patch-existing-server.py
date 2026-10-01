#!/usr/bin/env python3
"""Apply managed server-side properties/TOML/SNBT overlays to an existing TFG server."""

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



def render_toml_scalar(value):
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    raise RuntimeError(f"unsupported TOML scalar {value!r}")


def replace_toml_values(path: pathlib.Path, values: dict[str, object], dry_run: bool):
    original = path.read_text(encoding="utf-8") if path.is_file() else ""
    updated = original

    for dotted, value in values.items():
        parts = dotted.split(".")
        leaf = parts[-1]
        section = ".".join(parts[:-1])
        lines = updated.splitlines()
        line_ending = "\r\n" if "\r\n" in updated else "\n"
        trailing = updated.endswith(("\n", "\r"))

        current = ""
        matches = []
        section_header = None
        for index, line in enumerate(lines):
            header = re.match(r"^\s*\[([^\]]+)\]\s*(?:#.*)?$", line)
            if header:
                current = header.group(1).strip()
                if current == section:
                    section_header = index
                continue
            if current != section:
                continue
            if re.match(rf"^\s*{re.escape(leaf)}\s*=", line):
                matches.append(index)

        if len(matches) > 1:
            raise RuntimeError(f"TOML key {dotted!r} is ambiguous in {path}")

        rendered = render_toml_scalar(value)
        if matches:
            index = matches[0]
            match = re.match(
                rf"^(?P<prefix>\s*{re.escape(leaf)}\s*=\s*)(?P<value>[^#]*?)(?P<suffix>\s*(?:#.*)?)$",
                lines[index],
            )
            if not match:
                raise RuntimeError(f"cannot safely patch TOML key {dotted!r} in {path}")
            lines[index] = f"{match.group('prefix')}{rendered}{match.group('suffix')}"
        elif not section:
            first_section = next((i for i, line in enumerate(lines) if re.match(r"^\s*\[", line)), len(lines))
            lines.insert(first_section, f"{leaf} = {rendered}")
        elif section_header is not None:
            insert_at = section_header + 1
            while insert_at < len(lines) and not re.match(r"^\s*\[", lines[insert_at]):
                insert_at += 1
            lines.insert(insert_at, f"{leaf} = {rendered}")
        else:
            if lines and lines[-1].strip():
                lines.append("")
            lines.extend([f"[{section}]", f"{leaf} = {rendered}"])

        updated = line_ending.join(lines)
        if trailing or not original:
            updated += line_ending

    if updated == original:
        print(f"current {path}")
        return False
    print(f"{'would patch' if dry_run else 'patch'} {path}")
    if not dry_run:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(updated, encoding="utf-8")
    return True

def replace_properties_values(path: pathlib.Path, values: dict[str, object], dry_run: bool):
    original = path.read_bytes().decode("latin-1") if path.is_file() else ""
    newline = "\r\n" if "\r\n" in original else "\r" if "\r" in original else "\n"
    rendered = {}
    for key, value in values.items():
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", key):
            raise RuntimeError(f"unsupported properties key {key!r}")
        text = str(value).lower() if isinstance(value, bool) else str(value)
        if "\n" in text or "\r" in text or "\\" in text:
            raise RuntimeError("unsupported properties value")
        rendered[key] = text
    lines = [line for line in re.findall(r"[^\r\n]*(?:\r\n|[\r\n]|$)", original) if line]
    output, seen = [], set()
    index = 0
    while index < len(lines):
        start, logical = index, ""
        while index < len(lines):
            physical = lines[index]
            ending = "\r\n" if physical.endswith("\r\n") else "\r" if physical.endswith("\r") else "\n" if physical.endswith("\n") else ""
            body = physical[:-len(ending)] if ending else physical
            body = body.lstrip(" \t\f")
            comment = not logical and body.startswith(("#", "!"))
            continued = not comment and (len(body) - len(body.rstrip("\\"))) % 2 == 1
            logical += body[:-1] if continued else body
            index += 1
            if not continued:
                break
        match = None if logical.startswith(("#", "!")) else re.match(r"((?:\\.|[^=:\s])+)", logical)
        raw_key = match.group(1) if match else ""
        key = re.sub(r"\\u([0-9a-fA-F]{4})|\\(.)", lambda m: chr(int(m.group(1), 16)) if m.group(1) else {"t": "\t", "n": "\n", "r": "\r", "f": "\f"}.get(m.group(2), m.group(2)), raw_key)
        if key in rendered:
            output.append(f"{key}={rendered[key]}{ending}")
            seen.add(key)
        else:
            output.extend(lines[start:index])
    updated = "".join(output)
    for key, text in rendered.items():
        if key in seen:
            continue
        if updated:
            last = [line for line in re.findall(r"[^\r\n]*(?:\r\n|[\r\n]|$)", updated) if line][-1]
            body = last.rstrip("\r\n")
            continued = (len(body) - len(body.rstrip("\\"))) % 2 == 1
            if not last.endswith(("\r", "\n")):
                updated += newline
            # End an unfinished logical line with a blank natural line before
            # adding a separate property; Java ignores the continuation at EOF.
            if continued:
                updated += newline
        updated += f"{key}={text}{newline}"
    if updated == original:
        print(f"current {path}")
        return False
    print(f"{'would patch' if dry_run else 'patch'} {path}")
    if not dry_run:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(updated.encode("latin-1"))
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
        if "server" not in overlay.get("targets", []):
            continue
        rel = overlay["path"].replace("{levelName}", world.name)
        path = server_root / rel
        if overlay["format"] == "toml":
            changed |= replace_toml_values(path, overlay["values"], args.dry_run)
        elif overlay["format"] == "properties":
            changed |= replace_properties_values(path, overlay["values"], args.dry_run)
        elif overlay["format"] in {"snbt", "snbtAll"}:
            changed |= replace_values(
                path,
                overlay["values"],
                overlay["format"] == "snbtAll",
                args.dry_run,
            )
    print("managed server overlays changed files" if changed else "managed server overlays already current")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
