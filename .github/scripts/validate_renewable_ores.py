#!/usr/bin/env python3
"""Static integrity and balance checks for the multi-tier renewable resource chains."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RECIPES = ROOT / "kubejs/server_scripts/tfg/ores_and_materials/recipes.renewable_ores.js"
MATERIALS = ROOT / "kubejs/startup_scripts/tfg/materials/materials.renewable_ores.js"
TAGS = ROOT / "kubejs/server_scripts/tfg/ores_and_materials/tags.materials.js"
RECIPE_REGISTRY = ROOT / "kubejs/server_scripts/tfg/recipes.js"
MATERIAL_REGISTRY = ROOT / "kubejs/startup_scripts/tfg/materials.js"
PAKKU_LOCK = ROOT / "pakku-lock.json"

recipe_text = RECIPES.read_text(encoding="utf-8")
material_text = MATERIALS.read_text(encoding="utf-8")
tags_text = TAGS.read_text(encoding="utf-8")
recipe_registry = RECIPE_REGISTRY.read_text(encoding="utf-8")
material_registry = MATERIAL_REGISTRY.read_text(encoding="utf-8")
pakku_lock = PAKKU_LOCK.read_text(encoding="utf-8")
gt_lang = (ROOT / "kubejs/assets/gtceu/lang/en_us.json").read_text(encoding="utf-8")

errors: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


# Source-audit pins: update these only after re-auditing recipe maps and ore prefixes.
require("gtceu-1.20.1-7.5.3.jar" in pakku_lock,
        "GTCEu version changed: re-audit recipe maps, tanks and prefix behavior")
require("TerraFirmaGreg-Core-Modern-0.9.23.jar" in pakku_lock,
        "TFG Core version changed: re-audit TFC/GT ore integration")

blocks = re.findall(
    r"event\.recipes\.gtceu\.(\w+)\('([^']+)'\)(.*?)(?=\n\s*event\.recipes\.gtceu\.|\n})",
    recipe_text,
    re.DOTALL,
)
require(len(blocks) >= 65, f"expected at least 65 renewable recipes, found {len(blocks)}")
recipe_ids = [recipe_id for _, recipe_id, _ in blocks]
require(len(recipe_ids) == len(set(recipe_ids)), "duplicate renewable recipe ID")
recipe_bodies = {recipe_id: body for _, recipe_id, body in blocks}
recipe_machines = {recipe_id: machine for machine, recipe_id, _ in blocks}

# Every individual fluid stack stays within the 8 B single-block tank ceiling.
fluid_amounts = [
    int(m.group(1))
    for m in re.finditer(r"Fluid\.of\('[^']+',\s*(\d+)\)", recipe_text)
]
require(bool(fluid_amounts), "no fluid stacks found")
require(max(fluid_amounts, default=0) <= 8000,
        f"fluid stack exceeds 8 B: {max(fluid_amounts, default=0)} mB")

# No programmed-circuit forks: every alternate treatment has a distinct recipe/map.
require(".circuit(" not in recipe_text and ".circuitMeta(" not in recipe_text,
        "renewable chains must not depend on circuit-number selection")

# GTCEu Chemical Bath is item + one fluid -> item. Leaching stages that need a
# process liquor must produce a wet/leached solid first, then separate it in a
# centrifuge or use a Chemical Reactor for fluid-fluid chemistry.
for machine, recipe_id, body in blocks:
    if machine == "chemical_bath":
        require(body.count(".inputFluids(") == 1,
                f"{recipe_id}: Chemical Bath must have exactly one fluid input")
        require(".outputFluids(" not in body,
                f"{recipe_id}: Chemical Bath cannot emit a process fluid")
        require(".itemInputs(" in body and ".itemOutputs(" in body,
                f"{recipe_id}: Chemical Bath must transform an item")

    if machine == "autoclave":
        require(body.count(".inputFluids(") == 1,
                f"{recipe_id}: Autoclave must have exactly one fluid input")
        require(body.count(".outputFluids(") <= 1,
                f"{recipe_id}: Autoclave supports at most one fluid output")

# Registration hooks exactly once.
require(recipe_registry.count("registerTFGRenewableOreRecipes(event)") == 1,
        "renewable recipe registrar must be called exactly once")
require("registerTFGLVRenewableOreRecipes" not in recipe_registry + recipe_text,
        "obsolete LV-only renewable registrar remains")
require(material_registry.count("registerTFGRenewableOreMaterials(event)") == 1,
        "renewable material registrar must be called exactly once")

# TFC poor-ore finals and same-mineral discovery seeds.
tfc_finals = {
    "hematite": ("tfc:ore/poor_hematite", 1),
    "malachite": ("tfc:ore/poor_malachite", 1),
    "sphalerite": ("tfc:ore/poor_sphalerite", 1),
    "cassiterite": ("tfc:ore/poor_cassiterite", 1),
    "garnierite": ("tfc:ore/poor_garnierite", 4),
    "native_silver": ("tfc:ore/poor_native_silver", 4),
    "native_gold": ("tfc:ore/poor_native_gold", 4),
}
for name, (item_id, count) in tfc_finals.items():
    output = f".itemOutputs('{item_id}')" if count == 1 else f".itemOutputs('{count}x {item_id}')"
    require(output in recipe_text, f"{name}: missing expected poor-ore output x{count}")
    seed = f".notConsumable('#tfg:renewable_{name}_seed')"
    require(recipe_text.count(seed) == 1, f"{name}: discovery seed must appear exactly once")

# TFC seed loop must cover all seven TFC minerals and all three grades.
for name in tfc_finals:
    require(f"'{name}'" in tags_text, f"{name}: missing from renewable TFC seed list")
for grade in ("poor", "normal", "rich"):
    require(f"'tfc:ore/{grade}_' + ore" in tags_text,
            f"TFC renewable seed loop no longer includes {grade} grade")

# GT raw-ore finals: poor Redstone/Galena/Cobaltite with mined any-grade seeds.
gt_finals = {
    "redstone": ("GTMaterials.Redstone", 2),
    "galena": ("GTMaterials.Galena", 1),
    "cobaltite": ("GTMaterials.Cobaltite", 2),
}
for name, (material, count) in gt_finals.items():
    expected = f"ChemicalHelper.get(TFGTagPrefix.poorRawOre, {material}, {count})"
    require(expected in recipe_text, f"{name}: missing poor GT raw-ore output x{count}")
    require(f".notConsumable('#tfg:renewable_{name}_seed')" in recipe_text,
            f"{name}: missing non-consumable discovery seed")
    require(material in tags_text, f"{name}: missing GT any-grade seed registration")

# Arsenic is intentionally an elemental renewable chain, not an ore synthesis chain.
require(".itemOutputs('4x gtceu:arsenic_dust')" in recipe_text,
        "arsenic chain must terminate in 4x gtceu:arsenic_dust")
require(".notConsumable('#tfg:renewable_arsenic_seed')" in recipe_text,
        "arsenic chain must require prior arsenic discovery")
require("renewable_arsenic_seed" in tags_text and "gtceu:arsenic_dust" in tags_text,
        "arsenic seed must be elemental arsenic dust")
require(not re.search(r"poor.*arsenic|raw_arsenic", recipe_text, re.IGNORECASE),
        "renewable arsenic must not create an arsenic ore form")

# Intended machine choice for chemistry-critical stages.
machine_contract = {
    "tfg:lv_renewable_tin_alkaline_roast": "electric_blast_furnace",
    "tfg:lv_renewable_lead_chloride_leach": "chemical_bath",
    "tfg:mv_renewable_nickel_laterite_activation": "electric_blast_furnace",
    "tfg:mv_renewable_nickel_pressure_leach": "autoclave",
    "tfg:mv_renewable_silver_chlorination_roast": "electric_blast_furnace",
    "tfg:mv_renewable_silver_chloride_leach": "chemical_bath",
    "tfg:mv_renewable_arsenic_roast": "electric_blast_furnace",
    "tfg:mv_renewable_arsenic_leach": "chemical_bath",
    "tfg:mv_renewable_cobalt_oxidative_roast": "electric_blast_furnace",
    "tfg:mv_renewable_cobalt_pressure_leach": "autoclave",
    "tfg:hv_renewable_gold_aqua_regia_leach": "large_chemical_reactor",
    "tfg:hv_renewable_gold_reduction": "large_chemical_reactor",
}
for recipe_id, machine in machine_contract.items():
    require(recipe_machines.get(recipe_id) == machine,
            f"{recipe_id}: expected {machine}, got {recipe_machines.get(recipe_id)}")

# Energy normalization contract. Higher voltage increases batch output for common
# materials instead of arbitrarily multiplying EU per ore.
chains = {
    "redstone": (30, 2, 3200, [
        "tfg:lv_renewable_redstone_slurry",
        "tfg:lv_renewable_redstone_leach",
        "tfg:lv_renewable_redstone_concentration",
        "tfg:lv_renewable_redstone_mineralization",
        "tfg:lv_renewable_poor_redstone",
    ]),
    "tin": (30, 1, 3700, [
        "tfg:lv_renewable_tin_alkaline_roast",
        "tfg:lv_renewable_sodium_stannate",
        "tfg:lv_renewable_hydrated_tin_oxide",
        "tfg:lv_renewable_tin_oxide_precursor",
        "tfg:lv_renewable_poor_cassiterite",
    ]),
    "lead": (30, 1, 3500, [
        "tfg:lv_renewable_lead_chloride_leach",
        "tfg:lv_renewable_lead_liquor_purification",
        "tfg:lv_renewable_galena_precipitation",
        "tfg:lv_renewable_poor_galena",
    ]),
    "nickel": (120, 4, 4200, [
        "tfg:mv_renewable_nickel_laterite_activation",
        "tfg:mv_renewable_nickel_pressure_leach",
        "tfg:mv_renewable_nickel_liquor_purification",
        "tfg:mv_renewable_nickel_hydroxide",
        "tfg:mv_renewable_nickel_silicate_gel",
        "tfg:mv_renewable_poor_garnierite",
    ]),
    "silver": (120, 4, 3600, [
        "tfg:mv_renewable_silver_chlorination_roast",
        "tfg:mv_renewable_silver_chloride_leach",
        "tfg:mv_renewable_silver_chloride_precipitation",
        "tfg:mv_renewable_silver_reduction",
        "tfg:mv_renewable_poor_native_silver",
    ]),
    "arsenic": (120, 4, 3600, [
        "tfg:mv_renewable_arsenic_roast",
        "tfg:mv_renewable_arsenic_leach",
        "tfg:mv_renewable_arsenic_oxide_concentration",
        "tfg:mv_renewable_arsenic_reduction",
    ]),
    "cobaltite": (120, 2, 5000, [
        "tfg:mv_renewable_cobalt_oxidative_roast",
        "tfg:mv_renewable_cobalt_pressure_leach",
        "tfg:mv_renewable_cobalt_liquor_purification",
        "tfg:mv_renewable_cobalt_hydroxide",
        "tfg:mv_renewable_cobaltite_precursor",
        "tfg:mv_renewable_poor_cobaltite",
    ]),
    "gold": (480, 4, 3100, [
        "tfg:hv_renewable_gold_refractory_roast",
        "tfg:hv_renewable_gold_aqua_regia_leach",
        "tfg:hv_renewable_gold_liquor_purification",
        "tfg:hv_renewable_gold_reduction",
        "tfg:hv_renewable_poor_native_gold",
    ]),
}

for name, (voltage, output_count, expected_ticks, ids) in chains.items():
    durations = []
    for recipe_id in ids:
        body = recipe_bodies.get(recipe_id)
        require(body is not None, f"{name}: missing chain recipe {recipe_id}")
        if body is None:
            continue
        match = re.search(r"\.duration\((\d+)\)", body)
        require(match is not None, f"{recipe_id}: duration must be an integer literal")
        if match:
            durations.append(int(match.group(1)))
    total_ticks = sum(durations)
    require(total_ticks == expected_ticks,
            f"{name}: expected {expected_ticks} aggregate ticks, got {total_ticks}")
    if total_ticks:
        eu_per_output = total_ticks * voltage // output_count
        if name in {"nickel", "silver"}:
            require(90000 <= eu_per_output <= 140000,
                    f"{name}: common MV metal cost drifted to {eu_per_output} EU/output")
        if name == "cobaltite":
            require(eu_per_output >= 250000,
                    f"cobaltite should remain strategically expensive, got {eu_per_output} EU/output")
        if name == "gold":
            require(eu_per_output >= 350000,
                    f"gold should remain strategically expensive, got {eu_per_output} EU/output")

# Galena already yields Silver through GTCEu ore processing; do not double-count
# that geological byproduct with a second renewable Lead-side Silver stream.
require("argentiferous_residue" not in recipe_text and "argentiferous_residue" not in material_text,
        "renewable Lead must not duplicate Galena's built-in Silver byproduct")

# Use GTCEu's canonical Aqua Regia material instead of a parallel TFG fluid.
require("tfg:aqua_regia" not in recipe_text and "tfg:aqua_regia" not in material_text,
        "renewable Gold must use canonical gtceu:aqua_regia")
require("Fluid.of('gtceu:aqua_regia', 4000)" in recipe_text,
        "renewable Gold leach must consume gtceu:aqua_regia")

# Cobaltite explicitly consumes elemental arsenic from the independent arsenic chain.
cobalt_body = recipe_bodies.get("tfg:mv_renewable_cobaltite_precursor", "")
require("'4x gtceu:arsenic_dust'" in cobalt_body,
        "Cobaltite precursor must consume elemental arsenic dust")
require("tfg:arsenic_" not in cobalt_body,
        "Cobaltite must not consume a hidden custom arsenic precursor")

# Custom materials must not shadow an existing GTCEu material ID.
gt_material_ids = set(re.findall(r'\"material\.gtceu\.([a-z0-9_]+)\"', gt_lang))
custom_material_ids = set(re.findall(r"event\.create\('tfg:([a-z0-9_]+)'\)", material_text))
require(not (gt_material_ids & custom_material_ids),
        f"custom renewable materials shadow GTCEu IDs: {sorted(gt_material_ids & custom_material_ids)}")

# Redstone must not depend on finite Quartzite mining; reuse renewable Iron tailings.
redstone_body = recipe_bodies.get("tfg:lv_renewable_redstone_slurry", "")
require("tfg:iron_silicate_tailings_dust" in redstone_body,
        "renewable Redstone must consume renewable silicate tailings")
require("quartzite" not in redstone_body,
        "renewable Redstone must not depend on mined Quartzite")

# All renewable custom materials are non-decomposable and have both a producer
# and a downstream consumer/recovery reference in this centralized recipe file.
material_blocks = {
    name: body
    for name, body in re.findall(
        r"event\.create\('tfg:([^']+)'\)(.*?)(?=\n\s*event\.create\(|\n})",
        material_text,
        re.DOTALL,
    )
}
require(len(material_blocks) >= 70,
        f"expected at least 70 renewable custom materials, found {len(material_blocks)}")
method_calls = re.findall(
    r"\.(itemInputs|inputFluids|notConsumable|itemOutputs|outputFluids)\((.*?)\)\s*(?=\.|;)",
    recipe_text,
    re.DOTALL,
)
for material, body in sorted(material_blocks.items()):
    require(".flags(noDecomp)" in body,
            f"tfg:{material}: missing DISABLE_DECOMPOSITION")
    producers = 0
    consumers = 0
    for method, args in method_calls:
        if f"tfg:{material}" not in args:
            continue
        if method in {"itemOutputs", "outputFluids"}:
            producers += 1
        else:
            consumers += 1
    require(producers >= 1, f"tfg:{material}: has no producing recipe")
    require(consumers >= 1, f"tfg:{material}: has no downstream use/recovery recipe")

# Custom intermediates remain centralized so another script cannot silently add
# an unreviewed producer/consumer and break the recovery balance.
for path in (ROOT / "kubejs/server_scripts").rglob("*.js"):
    if path == RECIPES:
        continue
    text = path.read_text(encoding="utf-8", errors="replace")
    for material in material_blocks:
        require(f"tfg:{material}" not in text,
                f"renewable intermediate leaked into {path.relative_to(ROOT)}: tfg:{material}")

if errors:
    print("Renewable resource validation FAILED:")
    for error in errors:
        print(f" - {error}")
    raise SystemExit(1)

print("Renewable resource validation passed")
print(f" - recipes checked: {len(blocks)}")
print(f" - custom intermediates checked: {len(material_blocks)}")
print(f" - max fluid stack: {max(fluid_amounts)} mB")
print(" - LV: iron, copper, zinc, redstone, tin, lead")
print(" - MV: nickel, silver, arsenic, cobaltite")
print(" - HV: gold")
