#!/usr/bin/env python3
"""Static integrity checks for the LV renewable basic-ore chains."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RECIPES = ROOT / "kubejs/server_scripts/tfg/ores_and_materials/recipes.renewable_ores.js"
MATERIALS = ROOT / "kubejs/startup_scripts/tfg/materials/materials.renewable_ores.js"
RECIPE_REGISTRY = ROOT / "kubejs/server_scripts/tfg/recipes.js"
MATERIAL_REGISTRY = ROOT / "kubejs/startup_scripts/tfg/materials.js"
TFC_LANG = ROOT / "kubejs/assets/tfc/lang/en_us.json"
PAKKU_LOCK = ROOT / "pakku-lock.json"

recipe_text = RECIPES.read_text(encoding="utf-8")
material_text = MATERIALS.read_text(encoding="utf-8")
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
    require(f".notConsumable('{item_id}')" in recipe_text,
            f"{name}: missing non-consumable discovery seed")
    require(f'"item.tfc.ore.poor_{name}"' in tfc_lang,
            f"{name}: TFC poor grade is not present in the pack")

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
}
require(len(blocks) == 16, f"expected 16 renewable recipes, found {len(blocks)}")
recipe_ids = [recipe_id for _, recipe_id, _ in blocks]
require(len(recipe_ids) == len(set(recipe_ids)), "duplicate renewable recipe ID")

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
    "zinc_silicate_tailings",
    "iron_impurity_sludge",
    "iron_hydroxide_precipitate",
    "copper_impurity_sludge",
    "basic_copper_carbonate",
    "zinc_impurity_sludge",
    "sphalerite_crystals",
    "marine_sulfate_concentrate",
    "sulfate_reduction_slag",
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

# Waste products are sinks at LV. Reusing them as inputs here would create a
# recovery loop and invalidate the stated resource costs.
waste_materials = {
    "acidic_iron_wastewater",
    "copper_sulfate_wastewater",
    "spent_chloride_brine",
    "iron_silicate_tailings",
    "copper_silicate_tailings",
    "zinc_silicate_tailings",
    "iron_impurity_sludge",
    "copper_impurity_sludge",
    "zinc_impurity_sludge",
    "sulfate_reduction_slag",
}
for material in waste_materials:
    require(not re.search(
        rf"\.(?:itemInputs|inputFluids)\([^\n]*tfg:{re.escape(material)}",
        recipe_text,
    ), f"LV waste stream is recycled: tfg:{material}")

# No other server recipe file may produce/use the custom intermediates yet.
# This keeps the initial system closed and prevents accidental multiplication.
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

# Anti-bootstrap invariant: each final ore is both catalyst and output only once
# inside the renewable feature.
for item_id in final_ores.values():
    require(recipe_text.count(f".notConsumable('{item_id}')") == 1,
            f"{item_id}: seed must appear once as non-consumable")
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
