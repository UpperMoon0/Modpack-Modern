#!/usr/bin/env python3
"""Static integrity checks for the LV renewable basic-ore chains."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RECIPES = ROOT / "kubejs/server_scripts/tfg/ores_and_materials/recipes.renewable_ores.js"
MATERIALS = ROOT / "kubejs/startup_scripts/tfg/materials/materials.renewable_ores.js"
TAGS = ROOT / "kubejs/server_scripts/tfg/ores_and_materials/tags.materials.js"
CONCRETE_RECIPES = ROOT / "kubejs/server_scripts/tfg/natural_blocks/recipes.concrete.js"
ROCK_TAGS = ROOT / "kubejs/server_scripts/tfg/natural_blocks/tags.rocks.js"
CHROMIUM_RECIPES = ROOT / "kubejs/server_scripts/tfg/ores_and_materials/recipes.chromium.js"
RECIPE_REGISTRY = ROOT / "kubejs/server_scripts/tfg/recipes.js"
MATERIAL_REGISTRY = ROOT / "kubejs/startup_scripts/tfg/materials.js"
TFC_LANG = ROOT / "kubejs/assets/tfc/lang/en_us.json"
PAKKU_LOCK = ROOT / "pakku-lock.json"

recipe_text = RECIPES.read_text(encoding="utf-8")
material_text = MATERIALS.read_text(encoding="utf-8")
tags_text = TAGS.read_text(encoding="utf-8")
concrete_text = CONCRETE_RECIPES.read_text(encoding="utf-8")
rock_tags_text = ROCK_TAGS.read_text(encoding="utf-8")
chromium_text = CHROMIUM_RECIPES.read_text(encoding="utf-8")
recipe_registry = RECIPE_REGISTRY.read_text(encoding="utf-8")
material_registry = MATERIAL_REGISTRY.read_text(encoding="utf-8")
tfc_lang = TFC_LANG.read_text(encoding="utf-8")
pakku_lock = PAKKU_LOCK.read_text(encoding="utf-8")

errors: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


# This validation encodes source-audit assumptions. If a pinned dependency changes,
# the recipe IO/tank/ore-grade behavior must be re-audited before updating pins.
require("gtceu-1.20.1-7.5.3.jar" in pakku_lock,
        "GTCEu version changed: re-audit recipe maps, LV tanks and chemistry")
require("TerraFirmaGreg-Core-Modern-0.9.23.jar" in pakku_lock,
        "TFG Core version changed: re-audit TFC/GT integration and ore-prefix behavior")

# The three LV lines must end at actual TFC poor ores and require a mined seed.
final_ores = {
    "hematite": "tfc:ore/poor_hematite",
    "malachite": "tfc:ore/poor_malachite",
    "sphalerite": "tfc:ore/poor_sphalerite",
}
for name, item_id in final_ores.items():
    require(f".itemOutputs('{item_id}')" in recipe_text,
            f"{name}: missing poor-ore final output")
    seed_tag = f"tfg:renewable_{name}_seed"
    require(f".notConsumable('#{seed_tag}')" in recipe_text,
            f"{name}: missing non-consumable any-grade discovery seed")
    for grade in ("poor", "normal", "rich"):
        require(f"'tfc:ore/{grade}_' + ore" in tags_text,
                f"{name}: renewable seed tag no longer includes all ore grades")
        require(f'"item.tfc.ore.{grade}_{name}"' in tfc_lang,
                f"{name}: TFC {grade} grade is not present in the pack")

# Tin starts in MV, not in this LV feature.
require(not re.search(r"\b(?:tin|cassiterite)\b", recipe_text, re.IGNORECASE),
        "LV renewable recipe file must not contain tin/cassiterite")

# Keep the geology distinct as well as the chemistry: one renewable rock feed
# must not be able to feed all three metal lines.
require(".itemInputs('16x tfg:igneous_mafic_dust')" in recipe_text,
        "iron must use mafic/basaltic feed")
require(".itemInputs('24x tfg:igneous_intermediate_dust')" in recipe_text,
        "copper must use intermediate volcanic feed")
require(".itemInputs('28x tfg:sedimentary_carbonate_dust')" in recipe_text,
        "zinc must use carbonate-host feed")

# Do not let the renewable feature emit final metal dusts or ingots.
for forbidden in (
    "gtceu:iron_dust", "gtceu:copper_dust", "gtceu:zinc_dust",
    "gtceu:iron_ingot", "gtceu:copper_ingot", "gtceu:zinc_ingot",
):
    require(forbidden not in recipe_text, f"forbidden direct metal output: {forbidden}")

# GTCEu 7.5.3 LV single-block machines use 8 B tanks. Every individual
# fluid stack must fit even if aggregate chain consumption is much larger.
fluid_amounts = [
    int(match.group(1))
    for match in re.finditer(r"Fluid\.of\('[^']+',\s*(\d+)\)", recipe_text)
]
require(bool(fluid_amounts), "no fluid stacks found")
require(max(fluid_amounts, default=0) <= 8000,
        f"fluid stack exceeds LV 8 B tank: {max(fluid_amounts, default=0)} mB")

# Recipe-map IO slot checks for the exact machine types used here.
blocks = re.findall(
    r"event\.recipes\.gtceu\.(\w+)\('([^']+)'\)(.*?)(?=\n\s*event\.recipes\.gtceu\.|\n})",
    recipe_text,
    re.DOTALL,
)
limits = {
    "mixer": (6, 1, 2, 1),
    "chemical_reactor": (2, 2, 3, 2),
    "centrifuge": (2, 6, 1, 6),
    "autoclave": (2, 2, 1, 1),
    "electric_blast_furnace": (3, 3, 1, 1),
}
require(len(blocks) == 33, f"expected 33 renewable recipes, found {len(blocks)}")
recipe_ids = [recipe_id for _, recipe_id, _ in blocks]
require(len(recipe_ids) == len(set(recipe_ids)), "duplicate renewable recipe ID")

recipe_bodies = {recipe_id: body for _, recipe_id, body in blocks}

# Balance contract: keep renewable ore expensive while staying on the scale of
# TFG's existing LV/MV chemistry instead of multi-minute individual reactions.
balance_snippets = {
    "tfg:lv_renewable_sulfate_rich_brine": [
        "Fluid.of('tfc:salt_water', 8000)",
        "Fluid.of('tfg:sulfate_rich_brine', 1000)",
        ".duration(400)",
    ],
    "tfg:lv_renewable_marine_gypsum": [
        ".itemInputs('2x tfc:powder/flux')",
        "Fluid.of('tfg:sulfate_rich_brine', 1000)",
        ".itemOutputs('2x tfg:marine_gypsum_dust')",
        ".duration(300)",
    ],
    "tfg:lv_renewable_calcium_sulfide": [
        ".itemInputs('2x tfg:marine_gypsum_dust', '4x gtceu:charcoal_dust')",
        ".itemOutputs('2x tfg:calcium_sulfide_dust')",
        ".blastFurnaceTemp(1000)",
        ".duration(600)",
    ],
    "tfg:lv_renewable_hydrogen_sulfide": [
        "Fluid.of('gtceu:hydrogen_sulfide', 2000)",
        ".duration(400)",
    ],
    "tfg:lv_renewable_iron_acid_leach": [
        "Fluid.of('gtceu:sulfuric_acid', 500)",
        ".duration(600)",
    ],
    "tfg:lv_renewable_iron_hydroxide_precipitation": [
        "Fluid.of('gtceu:oxygen', 1000)",
        ".duration(600)",
    ],
    "tfg:lv_renewable_poor_hematite": [".duration(1200)"],
    "tfg:lv_renewable_copper_acid_leach": [
        "Fluid.of('gtceu:sulfuric_acid', 1000)",
        ".duration(600)",
    ],
    "tfg:lv_renewable_poor_malachite": [".duration(1000)"],
    "tfg:lv_renewable_zinc_chloride_leach": [
        "Fluid.of('gtceu:hydrochloric_acid', 1000)",
        ".duration(700)",
    ],
    "tfg:lv_renewable_zinc_sulfide_precipitation": [
        "Fluid.of('gtceu:hydrogen_sulfide', 500)",
        ".duration(600)",
    ],
    "tfg:lv_renewable_poor_sphalerite": [".duration(1400)"],
    "tfg:lv_refine_marine_gypsum": [
        ".itemInputs('tfg:marine_gypsum_dust')",
        ".itemOutputs('gtceu:gypsum_dust')",
        ".duration(80)",
    ],
    "tfg:lv_refine_calcium_carbonate_residue": [
        ".itemInputs('2x tfg:calcium_carbonate_residue_dust')",
        ".itemOutputs('gtceu:calcium_carbonate_dust')",
    ],
    "tfg:lv_recycle_iron_silicate_tailings": [
        ".itemInputs('8x tfg:iron_silicate_tailings_dust')",
        ".itemOutputs('gtceu:stone_dust')",
    ],
    "tfg:lv_recycle_copper_silicate_tailings": [
        ".itemInputs('8x tfg:copper_silicate_tailings_dust')",
        ".itemOutputs('gtceu:stone_dust')",
    ],
    "tfg:lv_recycle_zinc_carbonate_tailings": [
        ".itemInputs('8x tfg:zinc_carbonate_tailings_dust')",
        ".itemOutputs('gtceu:calcite_dust')",
    ],
    "tfg:lv_recycle_spent_marine_brine": [
        "Fluid.of('tfg:spent_marine_brine', 1000)",
        ".itemOutputs('2x gtceu:salt_dust')",
        "Fluid.of('minecraft:water', 750)",
    ],
    "tfg:lv_neutralize_acidic_iron_wastewater": [
        ".itemInputs('4x tfc:powder/flux')",
        "Fluid.of('tfg:acidic_iron_wastewater', 8000)",
        ".itemOutputs('4x gtceu:gypsum_dust')",
        "Fluid.of('minecraft:water', 6000)",
    ],
    "tfg:lv_neutralize_copper_sulfate_wastewater": [
        ".itemInputs('2x tfc:powder/flux')",
        "Fluid.of('tfg:copper_sulfate_wastewater', 6000)",
        ".itemOutputs('2x gtceu:gypsum_dust')",
        "Fluid.of('minecraft:water', 4500)",
    ],
    "tfg:mv_reclaim_iron_wastewater_acid": [
        "Fluid.of('gtceu:diluted_sulfuric_acid', 750)",
        ".EUt(MV)",
    ],
    "tfg:mv_reclaim_copper_wastewater_acid": [
        "Fluid.of('gtceu:diluted_sulfuric_acid', 375)",
        ".EUt(MV)",
    ],
    "tfg:lv_desalinate_spent_chloride_brine": [
        "Fluid.of('tfg:spent_chloride_brine', 6000)",
        ".itemOutputs('2x gtceu:salt_dust')",
        "Fluid.of('minecraft:water', 4500)",
    ],
    "tfg:mv_reclaim_spent_chloride_hcl": [
        "Fluid.of('gtceu:diluted_hydrochloric_acid', 1000)",
        ".EUt(MV)",
    ],
}
for recipe_id, snippets in balance_snippets.items():
    body = recipe_bodies.get(recipe_id)
    require(body is not None, f"missing balance-critical recipe: {recipe_id}")
    if body is not None:
        for snippet in snippets:
            require(snippet in body, f"{recipe_id}: balance contract changed: {snippet}")

require("marine_sulfate_concentrate" not in recipe_text + material_text,
        "obsolete vague marine sulfate concentrate must not return")
require("sulfate_reduction_slag" not in recipe_text + material_text,
        "obsolete abstract sulfate-reduction slag must not return")

for machine, recipe_id, body in blocks:
    require(machine in limits, f"{recipe_id}: unexpected machine type {machine}")
    if machine not in limits:
        continue

    item_in = body.count(".itemInputs(") + body.count(".notConsumable(")
    item_out = body.count(".itemOutputs(")
    fluid_in_region = body.split(".outputFluids(", 1)[0]
    fluid_in = fluid_in_region.count("Fluid.of(")
    fluid_out = body.count("Fluid.of(") - fluid_in

    max_item_in, max_item_out, max_fluid_in, max_fluid_out = limits[machine]
    require(item_in <= max_item_in,
            f"{recipe_id}: {item_in} item inputs exceed {machine} limit {max_item_in}")
    require(item_out <= max_item_out,
            f"{recipe_id}: {item_out} item outputs exceed {machine} limit {max_item_out}")
    require(fluid_in <= max_fluid_in,
            f"{recipe_id}: {fluid_in} fluid inputs exceed {machine} limit {max_fluid_in}")
    require(fluid_out <= max_fluid_out,
            f"{recipe_id}: {fluid_out} fluid outputs exceed {machine} limit {max_fluid_out}")

custom_materials = {
    "mafic_mineral_slurry",
    "iron_bearing_leachate",
    "purified_iron_liquor",
    "acidic_iron_wastewater",
    "copper_bearing_leachate",
    "purified_copper_liquor",
    "copper_sulfate_wastewater",
    "zinc_bearing_leachate",
    "purified_zinc_liquor",
    "zinc_sulfide_slurry",
    "spent_chloride_brine",
    "iron_silicate_tailings",
    "copper_silicate_tailings",
    "zinc_carbonate_tailings",
    "iron_impurity_sludge",
    "iron_hydroxide_precipitate",
    "copper_impurity_sludge",
    "basic_copper_carbonate",
    "zinc_impurity_sludge",
    "sphalerite_crystals",
    "sulfate_rich_brine",
    "spent_marine_brine",
    "marine_gypsum",
    "calcium_sulfide",
    "calcium_carbonate_residue",
}

# Every intermediate must be explicitly non-decomposable, not merely coexist in
# a file that sets that flag somewhere else.
material_blocks = {
    name: body
    for name, body in re.findall(
        r"event\.create\('tfg:([^']+)'\)(.*?)(?=\n\s*event\.create\(|\n})",
        material_text,
        re.DOTALL,
    )
}
for material in sorted(custom_materials):
    body = material_blocks.get(material)
    require(body is not None, f"missing custom material registration: tfg:{material}")
    if body is not None:
        require(".flags(noDecomp)" in body,
                f"tfg:{material} is not explicitly protected from decomposition")

# Waste recovery must stay conversion-first and feed existing TFG/GT materials.
# No new circuit selectors are permitted here: alternate treatments are separated
# by recipe map instead, which removes both circuit-number and subset-input clashes.
require(".circuit(" not in recipe_text and ".circuitMeta(" not in recipe_text,
        "renewable recovery must not rely on programmed-circuit selection")

# The requested conversions must terminate in ingredients already used by the
# existing concrete/material economy; custom wastes must not become substitutes.
require("event.add('tfg:stone_dusts', 'gtceu:stone_dust')" in rock_tags_text,
        "recovered stone dust is no longer accepted by #tfg:stone_dusts")
for ingredient in ("gtceu:calcite_dust", "gtceu:clay_dust", "gtceu:gypsum_dust"):
    require(ingredient in concrete_text,
            f"recovered concrete ingredient is not consumed by existing recipes: {ingredient}")
require("tfg:marine_gypsum" not in concrete_text + rock_tags_text,
        "marine gypsum must be refined to real gypsum, not tagged as a substitute")
require("gtceu:calcium_carbonate_dust" in chromium_text,
        "calcium-carbonate residue no longer feeds the existing chromium economy")

# Recovery outputs must never recreate the exact renewable rock feeds. Otherwise
# tailings could lower the geological feed cost into a self-supporting loop.
for forbidden_feed in (
    "tfg:igneous_mafic_dust",
    "tfg:igneous_intermediate_dust",
    "tfg:sedimentary_carbonate_dust",
):
    require(not re.search(
        rf"\.itemOutputs\([^\n]*{re.escape(forbidden_feed)}", recipe_text
    ), f"recovery emits renewable feedstock: {forbidden_feed}")

# Every waste has an explicit allowlist of consumers. If a waste has two treatment
# paths, those paths must use different recipe maps so a machine can never match
# both from a subset of the same inventory.
approved_waste_consumers = {
    "acidic_iron_wastewater": {
        "tfg:lv_neutralize_acidic_iron_wastewater",
        "tfg:mv_reclaim_iron_wastewater_acid",
    },
    "copper_sulfate_wastewater": {
        "tfg:lv_neutralize_copper_sulfate_wastewater",
        "tfg:mv_reclaim_copper_wastewater_acid",
    },
    "spent_chloride_brine": {
        "tfg:lv_desalinate_spent_chloride_brine",
        "tfg:mv_reclaim_spent_chloride_hcl",
    },
    "iron_silicate_tailings": {"tfg:lv_recycle_iron_silicate_tailings"},
    "copper_silicate_tailings": {"tfg:lv_recycle_copper_silicate_tailings"},
    "zinc_carbonate_tailings": {"tfg:lv_recycle_zinc_carbonate_tailings"},
    "iron_impurity_sludge": {"tfg:lv_recycle_iron_impurity_sludge"},
    "copper_impurity_sludge": {"tfg:lv_recycle_copper_impurity_sludge"},
    "zinc_impurity_sludge": {"tfg:lv_recycle_zinc_impurity_sludge"},
    "spent_marine_brine": {"tfg:lv_recycle_spent_marine_brine"},
    "calcium_carbonate_residue": {"tfg:lv_refine_calcium_carbonate_residue"},
}

def input_region(body: str) -> str:
    output_positions = [
        pos for pos in (body.find(".itemOutputs("), body.find(".outputFluids("))
        if pos >= 0
    ]
    return body[:min(output_positions)] if output_positions else body

for material, expected_ids in approved_waste_consumers.items():
    consumers = [
        (machine, recipe_id)
        for machine, recipe_id, body in blocks
        if f"tfg:{material}" in input_region(body)
    ]
    actual_ids = {recipe_id for _, recipe_id in consumers}
    require(actual_ids == expected_ids,
            f"unexpected consumers for tfg:{material}: {sorted(actual_ids)}")
    machines = [machine for machine, _ in consumers]
    if len(consumers) > 1:
        require(len(machines) == len(set(machines)),
                f"alternate tfg:{material} treatments share a recipe map: {machines}")

# No other server recipe file may produce/use the custom intermediates.
# Explicit recovery remains centralized here so later scripts cannot multiply it.
for path in (ROOT / "kubejs/server_scripts").rglob("*.js"):
    if path == RECIPES:
        continue
    text = path.read_text(encoding="utf-8", errors="replace")
    for material in custom_materials:
        require(f"tfg:{material}" not in text,
                f"custom renewable intermediate leaked into {path.relative_to(ROOT)}: tfg:{material}")

# Registration hooks must exist exactly once.
require(recipe_registry.count("registerTFGLVRenewableOreRecipes(event)") == 1,
        "renewable recipe registrar must be called exactly once")
require(material_registry.count("registerTFGRenewableOreMaterials(event)") == 1,
        "renewable material registrar must be called exactly once")

# Anti-bootstrap invariant: every final ore recipe has exactly one non-consumable
# same-mineral seed tag and exactly one Poor Ore output.
for name, item_id in final_ores.items():
    seed = f".notConsumable('#tfg:renewable_{name}_seed')"
    require(recipe_text.count(seed) == 1,
            f"{item_id}: any-grade seed tag must appear once as non-consumable")
    require(recipe_text.count(f".itemOutputs('{item_id}')") == 1,
            f"{item_id}: final output must appear once")

if errors:
    print("LV renewable ore validation FAILED:")
    for error in errors:
        print(f" - {error}")
    raise SystemExit(1)

print("LV renewable ore validation passed")
print(f" - recipes checked: {len(blocks)}")
print(f" - custom intermediates checked: {len(custom_materials)}")
print(f" - max fluid stack: {max(fluid_amounts)} mB")
print(" - final ores: poor hematite, poor malachite, poor sphalerite")
print(" - tin/cassiterite: absent")
print(" - source audit: GTCEu 7.5.3 + TFC 3.2.25; pack pin: TFG Core 0.9.23")
