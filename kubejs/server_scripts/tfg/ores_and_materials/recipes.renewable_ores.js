// priority: 0
"use strict";

/**
 * LV renewable basic ores.
 *
 * Design rules:
 * - Final outputs are TFC poor raw ores, so all normal TFG beneficiation still applies.
 * - Each final autoclave recipe requires a non-consumable sample of the ore being grown.
 *   The renewable line therefore cannot bootstrap a metal the player has never found.
 * - Intermediates are non-decomposable and intentionally have no alternate recovery recipes.
 * - Waste streams are deliberately not recycled at LV; reagent recovery can be a later-tier feature.
 *
 * @param {Internal.RecipesEventJS} event
 */
function registerTFGLVRenewableOreRecipes(event) {
    const LV = GTValues.VA[GTValues.LV];

    // Shared renewable sulfur / H2S infrastructure.
    //
    // This deliberately models the sulfate already dissolved in seawater instead
    // of treating a vague "marine concentrate" as sulfur. Salt water is first
    // concentrated into a sulfate-rich brine, calcium sulfate is precipitated
    // as marine gypsum, the gypsum is carbothermically reduced to calcium
    // sulfide, and wet carbonation releases H2S.
    //
    // Per 2 B H2S:
    // 8 B TFC salt water, 2 flux, 4 charcoal dust, 2 B water,
    // 51,000 EU and 1,700 ticks of aggregate machine time.
    // The reduction also leaves 2 B net CO2 available after the carbonation step.
    event.recipes.gtceu.centrifuge('tfg:lv_renewable_sulfate_rich_brine')
        .inputFluids(Fluid.of('tfc:salt_water', 8000))
        .outputFluids(Fluid.of('tfg:sulfate_rich_brine', 1000))
        .duration(400)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_marine_gypsum')
        .itemInputs('2x tfc:powder/flux')
        .inputFluids(Fluid.of('tfg:sulfate_rich_brine', 1000))
        .itemOutputs('2x tfg:marine_gypsum_dust')
        .outputFluids(Fluid.of('tfg:spent_marine_brine', 1000))
        .duration(300)
        .EUt(LV);

    event.recipes.gtceu.electric_blast_furnace('tfg:lv_renewable_calcium_sulfide')
        .itemInputs('2x tfg:marine_gypsum_dust', '4x gtceu:charcoal_dust')
        .itemOutputs('2x tfg:calcium_sulfide_dust')
        .outputFluids(Fluid.of('gtceu:carbon_dioxide', 4000))
        .duration(600)
        .EUt(LV)
        .blastFurnaceTemp(1000);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_hydrogen_sulfide')
        .itemInputs('2x tfg:calcium_sulfide_dust')
        .inputFluids(
            Fluid.of('minecraft:water', 2000),
            Fluid.of('gtceu:carbon_dioxide', 2000)
        )
        .itemOutputs('2x tfg:calcium_carbonate_residue_dust')
        .outputFluids(Fluid.of('gtceu:hydrogen_sulfide', 2000))
        .duration(400)
        .EUt(LV);

    // Iron: high-volume mafic leach, impurity removal, hydroxide precipitation,
    // then seeded hydrothermal aging. The first three recipes run twice per ore
    // so every LV fluid tank stays at or below the 8 B single-block limit.
    //
    // Per poor hematite:
    // 32 mafic dust, 24 B water, 1 B sulfuric acid, 1 B oxygen, 8 flux,
    // 126,000 EU and 4,200 ticks of aggregate machine time.
    event.recipes.gtceu.mixer('tfg:lv_renewable_iron_mafic_slurry')
        .itemInputs('16x tfg:igneous_mafic_dust')
        .inputFluids(Fluid.of('minecraft:water', 8000))
        .outputFluids(Fluid.of('tfg:mafic_mineral_slurry', 8000))
        .duration(300)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_iron_acid_leach')
        .inputFluids(
            Fluid.of('tfg:mafic_mineral_slurry', 8000),
            Fluid.of('gtceu:sulfuric_acid', 500)
        )
        .itemOutputs('12x tfg:iron_silicate_tailings_dust')
        .outputFluids(Fluid.of('tfg:iron_bearing_leachate', 6000))
        .duration(600)
        .EUt(LV);

    event.recipes.gtceu.centrifuge('tfg:lv_renewable_iron_liquor_purification')
        .inputFluids(Fluid.of('tfg:iron_bearing_leachate', 6000))
        .itemOutputs('4x tfg:iron_impurity_sludge_dust')
        .outputFluids(Fluid.of('tfg:purified_iron_liquor', 4000))
        .duration(300)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_iron_hydroxide_precipitation')
        .itemInputs('8x tfc:powder/flux')
        .inputFluids(
            Fluid.of('tfg:purified_iron_liquor', 8000),
            Fluid.of('gtceu:oxygen', 1000)
        )
        .itemOutputs('8x tfg:iron_hydroxide_precipitate_dust')
        .outputFluids(Fluid.of('tfg:acidic_iron_wastewater', 8000))
        .duration(600)
        .EUt(LV);

    event.recipes.gtceu.autoclave('tfg:lv_renewable_poor_hematite')
        .itemInputs('8x tfg:iron_hydroxide_precipitate_dust')
        .notConsumable('tfc:ore/poor_hematite')
        .inputFluids(Fluid.of('minecraft:water', 8000))
        .itemOutputs('tfc:ore/poor_hematite')
        .duration(1200)
        .EUt(LV);

    // Copper: direct sulfuric leach followed by carbonate precipitation.
    //
    // Per poor malachite:
    // 24 intermediate igneous dust, 18 B water, 1 B sulfuric acid, 16 soda ash powder,
    // 78,000 EU and 2,600 ticks. TFC soda ash is renewable from seaweed/kelp.
    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_copper_acid_leach')
        .itemInputs('24x tfg:igneous_intermediate_dust')
        .inputFluids(
            Fluid.of('minecraft:water', 8000),
            Fluid.of('gtceu:sulfuric_acid', 1000)
        )
        .itemOutputs('18x tfg:copper_silicate_tailings_dust')
        .outputFluids(Fluid.of('tfg:copper_bearing_leachate', 8000))
        .duration(600)
        .EUt(LV);

    event.recipes.gtceu.centrifuge('tfg:lv_renewable_copper_liquor_purification')
        .inputFluids(Fluid.of('tfg:copper_bearing_leachate', 8000))
        .itemOutputs('4x tfg:copper_impurity_sludge_dust')
        .outputFluids(Fluid.of('tfg:purified_copper_liquor', 6000))
        .duration(400)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_basic_copper_carbonate')
        .itemInputs('16x tfc:powder/soda_ash')
        .inputFluids(
            Fluid.of('tfg:purified_copper_liquor', 6000),
            Fluid.of('minecraft:water', 4000)
        )
        .itemOutputs('8x tfg:basic_copper_carbonate_dust')
        .outputFluids(Fluid.of('tfg:copper_sulfate_wastewater', 6000))
        .duration(600)
        .EUt(LV);

    event.recipes.gtceu.autoclave('tfg:lv_renewable_poor_malachite')
        .itemInputs('8x tfg:basic_copper_carbonate_dust')
        .notConsumable('tfc:ore/poor_malachite')
        .inputFluids(Fluid.of('minecraft:water', 6000))
        .itemOutputs('tfc:ore/poor_malachite')
        .duration(1000)
        .EUt(LV);

    // Zinc: chloride leach, H2S precipitation, crystallization and seeded
    // sphalerite growth. This deliberately depends on the shared renewable
    // seawater-sulfate/H2S plant rather than copying the copper line.
    //
    // Per poor sphalerite, excluding the shared H2S plant:
    // 28 carbonate sedimentary dust, 14 B water, 1 B hydrochloric acid, 0.5 B H2S,
    // 117,000 EU and 3,900 ticks.
    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_zinc_chloride_leach')
        .itemInputs('28x tfg:sedimentary_carbonate_dust')
        .inputFluids(
            Fluid.of('minecraft:water', 8000),
            Fluid.of('gtceu:hydrochloric_acid', 1000)
        )
        .itemOutputs('22x tfg:zinc_carbonate_tailings_dust')
        .outputFluids(Fluid.of('tfg:zinc_bearing_leachate', 8000))
        .duration(700)
        .EUt(LV);

    event.recipes.gtceu.centrifuge('tfg:lv_renewable_zinc_liquor_purification')
        .inputFluids(Fluid.of('tfg:zinc_bearing_leachate', 8000))
        .itemOutputs('4x tfg:zinc_impurity_sludge_dust')
        .outputFluids(Fluid.of('tfg:purified_zinc_liquor', 6000))
        .duration(400)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_zinc_sulfide_precipitation')
        .inputFluids(
            Fluid.of('tfg:purified_zinc_liquor', 6000),
            Fluid.of('gtceu:hydrogen_sulfide', 500)
        )
        .outputFluids(
            Fluid.of('tfg:zinc_sulfide_slurry', 6000),
            Fluid.of('tfg:spent_chloride_brine', 6000)
        )
        .duration(600)
        .EUt(LV);

    event.recipes.gtceu.centrifuge('tfg:lv_renewable_sphalerite_crystallization')
        .inputFluids(Fluid.of('tfg:zinc_sulfide_slurry', 6000))
        .itemOutputs('8x tfg:sphalerite_crystals_dust')
        .duration(800)
        .EUt(LV);

    event.recipes.gtceu.autoclave('tfg:lv_renewable_poor_sphalerite')
        .itemInputs('8x tfg:sphalerite_crystals_dust')
        .notConsumable('tfc:ore/poor_sphalerite')
        .inputFluids(Fluid.of('minecraft:water', 6000))
        .itemOutputs('tfc:ore/poor_sphalerite')
        .duration(1400)
        .EUt(LV);
}
