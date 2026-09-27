#!/usr/bin/env python3
"""Validate NsTut fork policy against the actual TFG/Pakku source tree."""

from __future__ import annotations

import importlib.util
import json
import os
import re
import subprocess
import sys
import tomllib
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
NSTUT = ROOT / "nstut"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def fail(message: str):
    raise AssertionError(message)


PROMOTED_CONTRACT_FILES = (
    "nstut/release.json",
    "nstut/managed-mods.json",
    "nstut/runtime-overlays.json",
    "nstut/modpack-manager.patch.json",
)


def validate_promoted_contract(release: dict) -> None:
    source_ref = release.get("sourceRef", "")
    if not re.fullmatch(r"nstut-[A-Za-z0-9._-]+", source_ref):
        fail(f"invalid immutable sourceRef: {source_ref!r}")

    tag_ref = f"refs/tags/{source_ref}"
    tag_exists = subprocess.run(
        ["git", "-C", str(ROOT), "rev-parse", "--verify", "--quiet", tag_ref],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).returncode == 0

    if not tag_exists:
        if os.environ.get("GITHUB_REF_NAME") == "nstut/stable":
            fail(f"promotion branch references missing immutable tag {source_ref}")
        return

    comparison = subprocess.run(
        ["git", "-C", str(ROOT), "diff", "--quiet", tag_ref, "HEAD", "--", *PROMOTED_CONTRACT_FILES]
    )
    if comparison.returncode == 1:
        fail(
            f"deployable contract drifted from immutable tag {source_ref}; "
            "bump overlayVersion/sourceRef and create the new tag before promotion"
        )
    if comparison.returncode != 0:
        fail(f"could not compare deployable contract with immutable tag {source_ref}")

def main() -> int:
    release = load(NSTUT / "release.json")
    managed = load(NSTUT / "managed-mods.json")
    runtime = load(NSTUT / "runtime-overlays.json")
    validate_promoted_contract(release)
    generator_path = ROOT / "nstut/tools/generate-modpack-manager-manifest.py"
    spec = importlib.util.spec_from_file_location("nstut_manifest_generator", generator_path)
    if spec is None or spec.loader is None:
        fail("could not load manifest generator for invariant checks")
    generator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(generator)

    if generator.deployment_path(".pakku/server-overrides/config/example.toml") != ("config/example.toml", ["server"]):
        fail("server override deployment mapping regressed")
    if generator.deployment_path(".pakku/client-overrides/config/example.toml") != ("config/example.toml", ["client"]):
        fail("client override deployment mapping regressed")
    if generator.deployment_path("config/example.toml") != ("config/example.toml", ["client", "server"]):
        fail("ordinary fork file deployment mapping regressed")

    tag_url = generator.raw_url(release["sourceRef"], "config/example file.toml")
    expected_tag_prefix = f"https://raw.githubusercontent.com/UpperMoon0/Modpack-Modern/refs/tags/{release['sourceRef']}/"
    if not tag_url.startswith(expected_tag_prefix):
        fail(f"fork artifact URL is not pinned to the tag namespace: {tag_url}")

    captured_git_args = []
    original_git = generator.git
    try:
        generator.git = lambda *args: captured_git_args.append(args) or ""
        generator.fork_changes("TEST_BASE")
    finally:
        generator.git = original_git
    if captured_git_args != [("diff", "--no-renames", "--name-status", "TEST_BASE", "--")]:
        fail(f"fork change detection must disable rename folding: {captured_git_args}")
    lock = load(ROOT / "pakku-lock.json")
    pakku = load(ROOT / "pakku.json")

    if lock.get("mc_versions") != ["1.20.1"]:
        fail(f"unexpected Minecraft versions: {lock.get('mc_versions')}")
    if (lock.get("loaders") or {}).get("forge") != "47.4.13":
        fail(f"unexpected Forge version: {lock.get('loaders')}")

    subprocess.run(
        ["git", "-C", str(ROOT), "merge-base", "--is-ancestor", release["baseRef"], "HEAD"],
        check=True,
    )

    by_slug = {}
    for project in lock["projects"]:
        slug = project.get("slug") or {}
        if "github" in slug:
            by_slug[slug["github"]] = project
        if "modrinth" in slug:
            by_slug[f"modrinth:{slug['modrinth']}"] = project

    config_projects = pakku.get("projects", {})
    for mod in managed["mods"]:
        key = mod["repository"]
        project = by_slug.get(key)
        if project is None:
            fail(f"Pakku lock missing managed project {key}")
        files = project.get("files") or []
        if len(files) != 1:
            fail(f"{key} must resolve to exactly one pinned file")
        file = files[0]
        if file.get("file_name") != mod["fileName"]:
            fail(f"{key} resolved {file.get('file_name')} instead of {mod['fileName']}")
        if (file.get("hashes") or {}).get("sha256") not in (None, mod["sha256"]):
            fail(f"{key} SHA-256 does not match managed-mods.json")
        cfg_key = key.split("modrinth:", 1)[-1] if key.startswith("modrinth:") else key
        config_entry = config_projects.get(cfg_key) or {}
        if config_entry.get("update_strategy") != "NONE":
            fail(f"{cfg_key} is not pinned with update_strategy NONE")

        side = config_entry.get("side")
        expected_targets = ["client"] if side == "CLIENT" else ["server"] if side == "SERVER" else ["client", "server"]
        install_targets = mod.get("installTargets")
        if install_targets != expected_targets:
            fail(
                f"{cfg_key} installTargets {install_targets!r} do not match Pakku side "
                f"{side or 'BOTH'} ({expected_targets!r})"
            )
        cleanup_targets = mod.get("cleanupTargets")
        if not isinstance(cleanup_targets, list) or not set(expected_targets).issubset(cleanup_targets):
            fail(f"{cfg_key} cleanupTargets must cover every install target")

    for client_key in ("UpperMoon0/OpenUI-MC", "UpperMoon0/Create-Precise-Controls"):
        if (config_projects.get(client_key) or {}).get("side") != "CLIENT":
            fail(f"{client_key} must remain client-only")

    gtceu = (ROOT / "config/gtceu.yaml").read_text(encoding="utf-8")
    if not re.search(r"(?m)^\s*shouldWeatherOrTerrainExplosion:\s*false\s*$", gtceu):
        fail("GTCEu weather/terrain explosion policy is not disabled")

    chp = tomllib.loads((ROOT / "defaultconfigs/createhorsepower-server.toml").read_text(encoding="utf-8"))
    expected = next(x["values"] for x in runtime["overlays"] if x["format"] == "toml")
    for dotted, value in expected.items():
        cur = chp
        for part in dotted.split("."):
            if not isinstance(cur, dict) or part not in cur:
                fail(f"horse-power config missing {dotted}")
            cur = cur[part]
        if cur != value:
            fail(f"horse-power {dotted}: expected {value!r}, got {cur!r}")

    checks = (
        (".pakku/server-overrides/defaultconfigs/ftbchunks-world.snbt", ("max_claimed_chunks", "max_force_loaded_chunks")),
        (".pakku/server-overrides/defaultconfigs/ftbranks/ranks.snbt", ("ftbchunks.max_claimed", "ftbchunks.max_force_loaded")),
    )
    for rel, keys in checks:
        text = (ROOT / rel).read_text(encoding="utf-8")
        for key in keys:
            matches = re.findall(rf"(?m)^\s*{re.escape(key)}\s*:\s*(-?\d+)\s*$", text)
            if not matches or any(v != "1000000" for v in matches):
                fail(f"{rel} does not enforce {key}=1000000")

    generated = load(NSTUT / "modpack-manager.patch.json")
    for operation in generated["operations"]:
        destination = operation.get("destination") or operation.get("pattern") or ""
        if destination.startswith(".pakku/"):
            fail(f"generated install operation leaks Pakku metadata path: {destination}")

    result = subprocess.run(
        [sys.executable, str(ROOT / "nstut/tools/generate-modpack-manager-manifest.py"), "--check"]
    )
    if result.returncode:
        return result.returncode

    print("NsTut fork validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
