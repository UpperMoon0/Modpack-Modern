// priority: 0
"use strict";

/**
 * LV renewable basic ores.
 *
 * Design rules:
 * - Final outputs are TFC poor raw ores, so all normal TFG beneficiation still applies.
 * - Each final autoclave recipe requires a non-consumable Poor, Normal, or Rich sample of the ore being grown.
 *   The renewable line therefore cannot bootstrap a metal the player has never found.
 * - Process intermediates are non-decomposable; explicit recipes are the only allowed recovery paths.
 * - LV waste treatment recovers only common minerals/water. MV may reclaim part of spent acid.
 * - No recovery recipe may emit Fe/Cu/Zn or one of the three renewable rock feedstocks.
 *
 * @param {Internal.RecipesEventJS} event
 */
function registerTFGLVRenewableOreRecipes(event) {
    const LV = GTValues.VA[GTValues.LV];
    const MV = GTValues.VA[GTValues.MV];

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
        .notConsumable('#tfg:renewable_hematite_seed')
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
        .notConsumable('#tfg:renewable_malachite_seed')
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
        .notConsumable('#tfg:renewable_sphalerite_seed')
        .inputFluids(Fluid.of('minecraft:water', 6000))
        .itemOutputs('tfc:ore/poor_sphalerite')
        .duration(1400)
        .EUt(LV);

    // Waste valorization. These recipes intentionally convert custom waste into
    // existing TFG/GT materials instead of adding parallel substitutes. Recovery
    // is deliberately lossy, and alternate treatment paths use different recipe
    // maps so they do not depend on circuit selection or ambiguous subset inputs.

    // Marine gypsum is chemically useful gypsum, but remains a distinct process
    // intermediate until cheaply refined. Converting it sacrifices its use in
    // the renewable H2S line, which provides the opportunity cost.
    event.recipes.gtceu.centrifuge('tfg:lv_refine_marine_gypsum')
        .itemInputs('tfg:marine_gypsum_dust')
        .itemOutputs('gtceu:gypsum_dust')
        .duration(80)
        .EUt(16);

    // Carbonation residue is cleaned into the calcium-carbonate reagent already
    // used by TFG chromium chemistry. The 2:1 loss prevents a free closed loop.
    event.recipes.gtceu.centrifuge('tfg:lv_refine_calcium_carbonate_residue')
        .itemInputs('2x tfg:calcium_carbonate_residue_dust')
        .itemOutputs('gtceu:calcium_carbonate_dust')
        .duration(100)
        .EUt(16);

    // Tailings become existing concrete ingredients rather than direct concrete.
    // Eight units of waste recover one low-value mineral dust; importantly none
    // of these outputs are the mafic/intermediate/carbonate rock feedstocks used
    // to synthesize the renewable ores themselves.
    event.recipes.gtceu.centrifuge('tfg:lv_recycle_iron_silicate_tailings')
        .itemInputs('8x tfg:iron_silicate_tailings_dust')
        .itemOutputs('gtceu:stone_dust')
        .duration(160)
        .EUt(16);

    event.recipes.gtceu.centrifuge('tfg:lv_recycle_copper_silicate_tailings')
        .itemInputs('8x tfg:copper_silicate_tailings_dust')
        .itemOutputs('gtceu:stone_dust')
        .duration(160)
        .EUt(16);

    event.recipes.gtceu.centrifuge('tfg:lv_recycle_zinc_carbonate_tailings')
        .itemInputs('8x tfg:zinc_carbonate_tailings_dust')
        .itemOutputs('gtceu:calcite_dust')
        .duration(160)
        .EUt(16);

    // Impurity sludge is washed down to ordinary clay, another ingredient of the
    // existing low-yield concrete route. One poor ore produces at most one clay.
    event.recipes.gtceu.centrifuge('tfg:lv_recycle_iron_impurity_sludge')
        .itemInputs('8x tfg:iron_impurity_sludge_dust')
        .itemOutputs('gtceu:clay_dust')
        .duration(200)
        .EUt(16);

    event.recipes.gtceu.centrifuge('tfg:lv_recycle_copper_impurity_sludge')
        .itemInputs('4x tfg:copper_impurity_sludge_dust')
        .itemOutputs('gtceu:clay_dust')
        .duration(200)
        .EUt(16);

    event.recipes.gtceu.centrifuge('tfg:lv_recycle_zinc_impurity_sludge')
        .itemInputs('4x tfg:zinc_impurity_sludge_dust')
        .itemOutputs('gtceu:clay_dust')
        .duration(200)
        .EUt(16);

    // The marine sulfur plant starts from 8 B seawater for only 1 B spent brine.
    // Recovering two salt dust and most of one bucket of water is intentionally
    // well below the pack's fresh-salt-water separation yield per source bucket.
    event.recipes.gtceu.centrifuge('tfg:lv_recycle_spent_marine_brine')
        .inputFluids(Fluid.of('tfg:spent_marine_brine', 1000))
        .itemOutputs('2x gtceu:salt_dust')
        .outputFluids(Fluid.of('minecraft:water', 750))
        .duration(200)
        .EUt(LV);

    // LV neutralization trades recoverable acid for common gypsum and water.
    // These are deliberately separate Chemical Reactor recipes from the MV acid
    // reclamation recipes below, avoiding a partial-input recipe collision.
    event.recipes.gtceu.chemical_reactor('tfg:lv_neutralize_acidic_iron_wastewater')
        .itemInputs('4x tfc:powder/flux')
        .inputFluids(Fluid.of('tfg:acidic_iron_wastewater', 8000))
        .itemOutputs('4x gtceu:gypsum_dust')
        .outputFluids(Fluid.of('minecraft:water', 6000))
        .duration(400)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_neutralize_copper_sulfate_wastewater')
        .itemInputs('2x tfc:powder/flux')
        .inputFluids(Fluid.of('tfg:copper_sulfate_wastewater', 6000))
        .itemOutputs('2x gtceu:gypsum_dust')
        .outputFluids(Fluid.of('minecraft:water', 4500))
        .duration(320)
        .EUt(LV);

    // MV centrifugation reclaims only part of the acid investment. GregTech's
    // normal distillation then turns 3 B diluted H2SO4 into 2 B H2SO4, so these
    // correspond to 50% recovery for iron and 25% for copper respectively.
    event.recipes.gtceu.centrifuge('tfg:mv_reclaim_iron_wastewater_acid')
        .inputFluids(Fluid.of('tfg:acidic_iron_wastewater', 8000))
        .outputFluids(
            Fluid.of('gtceu:diluted_sulfuric_acid', 750),
            Fluid.of('minecraft:water', 6000)
        )
        .duration(600)
        .EUt(MV);

    event.recipes.gtceu.centrifuge('tfg:mv_reclaim_copper_wastewater_acid')
        .inputFluids(Fluid.of('tfg:copper_sulfate_wastewater', 6000))
        .outputFluids(
            Fluid.of('gtceu:diluted_sulfuric_acid', 375),
            Fluid.of('minecraft:water', 4500)
        )
        .duration(500)
        .EUt(MV);

    // Zinc chloride waste has two choices without a circuit-number fork. The LV
    // centrifuge recovers bulk salt/water; the MV Chemical Reactor reclaims weak
    // HCl instead. GregTech distillation converts 2 B diluted HCl into 1 B HCl,
    // making the latter a 50% recovery of the original 1 B leach-acid cost.
    event.recipes.gtceu.centrifuge('tfg:lv_desalinate_spent_chloride_brine')
        .inputFluids(Fluid.of('tfg:spent_chloride_brine', 6000))
        .itemOutputs('2x gtceu:salt_dust')
        .outputFluids(Fluid.of('minecraft:water', 4500))
        .duration(300)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:mv_reclaim_spent_chloride_hcl')
        .inputFluids(Fluid.of('tfg:spent_chloride_brine', 6000))
        .outputFluids(
            Fluid.of('gtceu:diluted_hydrochloric_acid', 1000),
            Fluid.of('minecraft:water', 4000)
        )
        .duration(600)
        .EUt(MV);

}
