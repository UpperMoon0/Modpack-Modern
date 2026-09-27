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
    // Four 8 B concentrate batches consume 32 B salt water. Reduction then
    // consumes 8 B renewable hydrogen and yields 8 B H2S. GTCEu's existing
    // sulfide oxidation recipe can turn this H2S into sulfuric acid, but only
    // with a further 4 B oxygen per 1 B H2S.
    event.recipes.gtceu.centrifuge('tfg:lv_renewable_marine_sulfate_concentrate')
        .inputFluids(Fluid.of('tfc:salt_water', 8000))
        .itemOutputs('tfg:marine_sulfate_concentrate_dust')
        .duration(1200)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_hydrogen_sulfide')
        .itemInputs('4x tfg:marine_sulfate_concentrate_dust')
        .inputFluids(Fluid.of('gtceu:hydrogen', 8000))
        .itemOutputs('2x tfg:sulfate_reduction_slag_dust')
        .outputFluids(Fluid.of('gtceu:hydrogen_sulfide', 8000))
        .duration(4800)
        .EUt(LV);

    // Iron: high-volume mafic leach, impurity removal, hydroxide precipitation,
    // then seeded hydrothermal aging. The first three recipes run twice per ore
    // so every LV fluid tank stays at or below the 8 B single-block limit.
    //
    // Per poor hematite:
    // 32 mafic dust, 24 B water, 8 B sulfuric acid, 8 B oxygen, 8 flux,
    // 576,000 EU and 19,200 ticks of aggregate machine time.
    event.recipes.gtceu.mixer('tfg:lv_renewable_iron_mafic_slurry')
        .itemInputs('16x tfg:igneous_mafic_dust')
        .inputFluids(Fluid.of('minecraft:water', 8000))
        .outputFluids(Fluid.of('tfg:mafic_mineral_slurry', 8000))
        .duration(1200)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_iron_acid_leach')
        .inputFluids(
            Fluid.of('tfg:mafic_mineral_slurry', 8000),
            Fluid.of('gtceu:sulfuric_acid', 4000)
        )
        .itemOutputs('12x tfg:iron_silicate_tailings_dust')
        .outputFluids(Fluid.of('tfg:iron_bearing_leachate', 6000))
        .duration(1800)
        .EUt(LV);

    event.recipes.gtceu.centrifuge('tfg:lv_renewable_iron_liquor_purification')
        .inputFluids(Fluid.of('tfg:iron_bearing_leachate', 6000))
        .itemOutputs('4x tfg:iron_impurity_sludge_dust')
        .outputFluids(Fluid.of('tfg:purified_iron_liquor', 4000))
        .duration(1200)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_iron_hydroxide_precipitation')
        .itemInputs('8x tfc:powder/flux')
        .inputFluids(
            Fluid.of('tfg:purified_iron_liquor', 8000),
            Fluid.of('gtceu:oxygen', 8000)
        )
        .itemOutputs('8x tfg:iron_hydroxide_precipitate_dust')
        .outputFluids(Fluid.of('tfg:acidic_iron_wastewater', 8000))
        .duration(3600)
        .EUt(LV);

    event.recipes.gtceu.autoclave('tfg:lv_renewable_poor_hematite')
        .itemInputs('8x tfg:iron_hydroxide_precipitate_dust')
        .notConsumable('tfc:ore/poor_hematite')
        .inputFluids(Fluid.of('minecraft:water', 8000))
        .itemOutputs('tfc:ore/poor_hematite')
        .duration(7200)
        .EUt(LV);

    // Copper: direct sulfuric leach followed by carbonate precipitation.
    //
    // Per poor malachite:
    // 24 intermediate igneous dust, 18 B water, 6 B sulfuric acid, 16 soda ash powder,
    // 432,000 EU and 14,400 ticks. TFC soda ash is renewable from seaweed/kelp.
    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_copper_acid_leach')
        .itemInputs('24x tfg:igneous_intermediate_dust')
        .inputFluids(
            Fluid.of('minecraft:water', 8000),
            Fluid.of('gtceu:sulfuric_acid', 6000)
        )
        .itemOutputs('18x tfg:copper_silicate_tailings_dust')
        .outputFluids(Fluid.of('tfg:copper_bearing_leachate', 8000))
        .duration(3600)
        .EUt(LV);

    event.recipes.gtceu.centrifuge('tfg:lv_renewable_copper_liquor_purification')
        .inputFluids(Fluid.of('tfg:copper_bearing_leachate', 8000))
        .itemOutputs('4x tfg:copper_impurity_sludge_dust')
        .outputFluids(Fluid.of('tfg:purified_copper_liquor', 6000))
        .duration(2400)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_basic_copper_carbonate')
        .itemInputs('16x tfc:powder/soda_ash')
        .inputFluids(
            Fluid.of('tfg:purified_copper_liquor', 6000),
            Fluid.of('minecraft:water', 4000)
        )
        .itemOutputs('8x tfg:basic_copper_carbonate_dust')
        .outputFluids(Fluid.of('tfg:copper_sulfate_wastewater', 6000))
        .duration(3600)
        .EUt(LV);

    event.recipes.gtceu.autoclave('tfg:lv_renewable_poor_malachite')
        .itemInputs('8x tfg:basic_copper_carbonate_dust')
        .notConsumable('tfc:ore/poor_malachite')
        .inputFluids(Fluid.of('minecraft:water', 6000))
        .itemOutputs('tfc:ore/poor_malachite')
        .duration(4800)
        .EUt(LV);

    // Zinc: chloride leach, H2S precipitation, crystallization and seeded
    // sphalerite growth. This deliberately depends on the renewable marine
    // sulfate/H2S infrastructure rather than copying the copper line.
    //
    // Per poor sphalerite, excluding the shared H2S batch:
    // 28 carbonate sedimentary dust, 14 B water, 8 B hydrochloric acid, 2 B H2S,
    // 684,000 EU and 22,800 ticks.
    //
    // The H2S plant runs in 8 B batches: 32 B salt water + 8 B hydrogen
    // -> 8 B H2S, so one sphalerite consumes one quarter of that batch.
    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_zinc_chloride_leach')
        .itemInputs('28x tfg:sedimentary_carbonate_dust')
        .inputFluids(
            Fluid.of('minecraft:water', 8000),
            Fluid.of('gtceu:hydrochloric_acid', 8000)
        )
        .itemOutputs('22x tfg:zinc_silicate_tailings_dust')
        .outputFluids(Fluid.of('tfg:zinc_bearing_leachate', 8000))
        .duration(3600)
        .EUt(LV);

    event.recipes.gtceu.centrifuge('tfg:lv_renewable_zinc_liquor_purification')
        .inputFluids(Fluid.of('tfg:zinc_bearing_leachate', 8000))
        .itemOutputs('4x tfg:zinc_impurity_sludge_dust')
        .outputFluids(Fluid.of('tfg:purified_zinc_liquor', 6000))
        .duration(2400)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_zinc_sulfide_precipitation')
        .inputFluids(
            Fluid.of('tfg:purified_zinc_liquor', 6000),
            Fluid.of('gtceu:hydrogen_sulfide', 2000)
        )
        .outputFluids(
            Fluid.of('tfg:zinc_sulfide_slurry', 6000),
            Fluid.of('tfg:spent_chloride_brine', 6000)
        )
        .duration(3600)
        .EUt(LV);

    event.recipes.gtceu.centrifuge('tfg:lv_renewable_sphalerite_crystallization')
        .inputFluids(Fluid.of('tfg:zinc_sulfide_slurry', 6000))
        .itemOutputs('8x tfg:sphalerite_crystals_dust')
        .duration(4800)
        .EUt(LV);

    event.recipes.gtceu.autoclave('tfg:lv_renewable_poor_sphalerite')
        .itemInputs('8x tfg:sphalerite_crystals_dust')
        .notConsumable('tfc:ore/poor_sphalerite')
        .inputFluids(Fluid.of('minecraft:water', 6000))
        .itemOutputs('tfc:ore/poor_sphalerite')
        .duration(8400)
        .EUt(LV);
}
