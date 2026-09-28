#!/usr/bin/env python3
"""Validate NsTut fork policy against the actual TFG/Pakku source tree."""

from __future__ import annotations

import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
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

    if os.environ.get("GITHUB_REF_NAME") == "nstut/stable":
        head_tree = subprocess.check_output(
            ["git", "-C", str(ROOT), "rev-parse", "HEAD^{tree}"], text=True
        ).strip()
        tag_tree = subprocess.check_output(
            ["git", "-C", str(ROOT), "rev-parse", f"{tag_ref}^{{tree}}"], text=True
        ).strip()
        if head_tree != tag_tree:
            fail(
                f"nstut/stable tree does not match immutable tag {source_ref}; "
                "promote a tagged nstut/<base> release branch instead of merging development directly"
            )

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

    expected_release_branch = f"nstut/{release.get('baseRef', '')}"
    if release.get("branch") != expected_release_branch:
        fail(
            f"release.json branch must be {expected_release_branch!r}, "
            f"got {release.get('branch')!r}"
        )
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
    expected_tag_prefix = f"https://raw.githubusercontent.com/UpperMoon0/TFG-Modern-Fork/refs/tags/{release['sourceRef']}/"
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
        if cleanup_targets != ["client", "server"]:
            fail(f"{cfg_key} cleanupTargets must be ['client', 'server'] to scrub stale copies on both sides")
        cleanup_patterns = mod.get("cleanupPatterns")
        if not isinstance(cleanup_patterns, list) or not cleanup_patterns:
            fail(f"{cfg_key} must declare at least one cleanup pattern")

    for client_key in ("UpperMoon0/OpenUI-MC", "UpperMoon0/Create-Precise-Controls"):
        if (config_projects.get(client_key) or {}).get("side") != "CLIENT":
            fail(f"{client_key} must remain client-only")

    # Alabaster recipe audit: raw decoloring must target raw alabaster, and
    # colored bricks must have exactly one dyeing registration. Duplicate
    # Chemical Bath signatures are rejected by GTCEu's lookup DB.
    alabaster = (ROOT / "kubejs/server_scripts/tfg/natural_blocks/recipes.alabaster.js").read_text(
        encoding="utf-8"
    )
    raw_decolor = re.search(
        r"chemical_bath\('tfc:alabaster/raw'\)(.*?)(?=\n\s*for \(let i = 0; i < 16; i\+\+\))",
        alabaster,
        re.DOTALL,
    )
    if raw_decolor is None or "#tfc:colored_raw_alabaster" not in raw_decolor.group(1):
        fail("raw alabaster decolor recipe must consume #tfc:colored_raw_alabaster")
    if raw_decolor is not None and "#tfc:colored_bricks_alabaster" in raw_decolor.group(1):
        fail("raw alabaster decolor recipe still consumes the colored-bricks tag")

    canonical_bricks_recipe = "chemical_bath(`tfg:tfc/alabaster/bricks/${global.MINECRAFT_DYE_NAMES[i]}`)"
    duplicate_bricks_recipe = "chemical_bath(`tfg:alabaster/bricks/${global.MINECRAFT_DYE_NAMES[i]}`)"
    if alabaster.count(canonical_bricks_recipe) != 1:
        fail("colored alabaster bricks must have exactly one canonical dye registration")
    if duplicate_bricks_recipe in alabaster:
        fail("duplicate 36 mB colored-alabaster-bricks dye registration remains")
    bricks_dye_72 = "Fluid.of(`tfc:${global.MINECRAFT_DYE_NAMES[i]}_dye`, 72)"
    if bricks_dye_72 not in alabaster:
        fail("colored alabaster bricks must retain the original 72 mB dye cost")

    sandwiches = (ROOT / "kubejs/server_scripts/tfg/food/recipes.food.sandwiches.js").read_text(
        encoding="utf-8"
    )
    jam_one_start = sandwiches.find("jam_sandwich_1`, 100, 16, {")
    if jam_one_start < 0:
        fail("jam sandwich recipe 1 block is missing")
    jam_one_end = sandwiches.find("});", jam_one_start)
    jam_one = sandwiches[jam_one_start:jam_one_end] if jam_one_start >= 0 and jam_one_end >= 0 else ""
    if "circuit: 5" not in jam_one:
        fail("jam sandwich recipe 1 must use circuit 5 to avoid the recipe-3 lookup-prefix collision")
    if "#tfc:foods/preserves" not in jam_one:
        fail("jam sandwich recipe 1 must retain the normal preserves tag")

    medicine = (ROOT / "kubejs/server_scripts/tfg/primitive/medicine/recipes.medicine.js").read_text(
        encoding="utf-8"
    )
    for token in (
        "spring_water/pill_${type.name}_with_herbal_slime_ball",
        "distilled_water/pill_${type.name}_with_herbal_slime_ball",
        "spring_water/tablet_${type.name}_with_herbal_slime_ball",
        "distilled_water/tablet_${type.name}_with_herbal_slime_ball",
    ):
        if token not in medicine:
            fail(f"herbal medicine mixer recipe missing: {token}")
    herbal_section = medicine.split("// With Herbal Slime Ball", 1)[1].split("// Arrow", 1)[0]
    if herbal_section.count("Fluid.of('tfc:spring_water', 250)") != 2:
        fail("herbal spring-water pill/tablet routes must each consume 250 mB spring water")
    if herbal_section.count("Fluid.of('gtceu:distilled_water', 50)") != 2:
        fail("herbal distilled-water pill/tablet routes must each consume 50 mB distilled water")

    mega_cells = (ROOT / "kubejs/server_scripts/mega_cells/recipes.js").read_text(encoding="utf-8")
    mega_reverse_start = mega_cells.find("packer('megacells:crafting_mega_accelerator_back')")
    if mega_reverse_start < 0:
        fail("MEGA crafting accelerator reverse Packer recipe is missing")
        mega_reverse = ""
    else:
        mega_reverse_end = mega_cells.find(chr(10) + "    event.recipes.gtceu.", mega_reverse_start + 1)
        mega_reverse = mega_cells[
            mega_reverse_start:mega_reverse_end if mega_reverse_end >= 0 else len(mega_cells)
        ]
    if "itemInputs('megacells:mega_crafting_accelerator')" not in mega_reverse:
        fail("MEGA crafting accelerator reverse recipe must consume megacells:mega_crafting_accelerator")
    if "itemInputs('ae2:crafting_accelerator')" in mega_reverse:
        fail("MEGA reverse recipe still collides with AE2 crafting accelerator unpacking")

    gtceu = (ROOT / "config/gtceu.yaml").read_text(encoding="utf-8")
    if not re.search(r"(?m)^\s*shouldWeatherOrTerrainExplosion:\s*false\s*$", gtceu):
        fail("GTCEu weather/terrain explosion policy is not disabled")

    chp = tomllib.loads((ROOT / "defaultconfigs/createhorsepower-server.toml").read_text(encoding="utf-8"))
    chp_overlay = next(
        x for x in runtime["overlays"]
        if x["path"] == "defaultconfigs/createhorsepower-server.toml"
    )
    expected = chp_overlay["values"]
    for dotted, value in expected.items():
        cur = chp
        for part in dotted.split("."):
            if not isinstance(cur, dict) or part not in cur:
                fail(f"horse-power config missing {dotted}")
            cur = cur[part]
        if cur != value:
            fail(f"horse-power {dotted}: expected {value!r}, got {cur!r}")

    speaker_overlay = next(
        (x for x in runtime["overlays"] if x["path"] == "config/simplyspeakers-common.toml"),
        None,
    )
    if speaker_overlay is None:
        fail("Simply Speakers server runtime overlay is missing")
    if speaker_overlay.get("format") != "toml":
        fail("Simply Speakers runtime overlay must use TOML patching")
    if speaker_overlay.get("targets") != ["server"]:
        fail(f"Simply Speakers runtime overlay must be server-only: {speaker_overlay.get('targets')!r}")
    if speaker_overlay.get("values") != {"speakerRange": 512}:
        fail(f"Simply Speakers speakerRange policy must be 512: {speaker_overlay.get('values')!r}")

    patcher = NSTUT / "tools" / "patch-existing-server.py"
    with tempfile.TemporaryDirectory() as temp_dir:
        server = Path(temp_dir)
        config = server / "config" / "simplyspeakers-common.toml"
        config.parent.mkdir(parents=True)
        config.write_text(
            "# Simply Speakers\nspeakerRange = 64\ndisableUpload = false\n",
            encoding="utf-8",
        )
        subprocess.run([sys.executable, str(patcher), str(server)], check=True)
        first_pass = config.read_text(encoding="utf-8")
        patched = tomllib.loads(first_pass)
        if patched.get("speakerRange") != 512:
            fail(f"existing-server patcher left speakerRange at {patched.get('speakerRange')!r}")
        if patched.get("disableUpload") is not False:
            fail("existing-server patcher changed unrelated Simply Speakers config")
        subprocess.run([sys.executable, str(patcher), str(server)], check=True)
        if config.read_text(encoding="utf-8") != first_pass:
            fail("existing-server Simply Speakers patch is not idempotent")

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
    speaker_ops = [
        operation for operation in generated["operations"]
        if operation.get("type") == "patchToml"
        and operation.get("destination") == "config/simplyspeakers-common.toml"
    ]
    if len(speaker_ops) != 1:
        fail(f"expected one generated Simply Speakers TOML patch, found {len(speaker_ops)}")
    speaker_op = speaker_ops[0]
    if speaker_op.get("values") != {"speakerRange": 512} or speaker_op.get("targets") != ["server"]:
        fail(f"generated Simply Speakers patch is wrong: {speaker_op!r}")

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
