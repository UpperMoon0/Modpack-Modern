// priority: 0
"use strict";

/**
 * Multi-tier renewable industrial ores and strategic elements.
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
function registerTFGRenewableOreRecipes(event) {
    const LV = GTValues.VA[GTValues.LV];
    const MV = GTValues.VA[GTValues.MV];
    const HV = GTValues.VA[GTValues.HV];

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


    // ---------------------------------------------------------------------
    // LV expansion: Redstone, Tin and Lead.
    // Higher-tier common materials below increase batch yield instead of
    // multiplying EU per ore purely because their recipes run at higher voltage.
    // ---------------------------------------------------------------------

    // Redstone: fictional mineralization, but grounded in the pack's existing
    // silicate / iron / sulfur chemistry. 2 poor raw Redstone per 96k EU batch.
    event.recipes.gtceu.mixer('tfg:lv_renewable_redstone_slurry')
        .itemInputs('24x tfg:igneous_felsic_dust', '4x gtceu:quartzite_dust')
        .inputFluids(Fluid.of('minecraft:water', 8000))
        .outputFluids(Fluid.of('tfg:redstone_mineral_slurry', 8000))
        .duration(500)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_redstone_leach')
        .inputFluids(
            Fluid.of('tfg:redstone_mineral_slurry', 8000),
            Fluid.of('gtceu:hydrochloric_acid', 500)
        )
        .itemOutputs('12x tfg:redstone_silicate_tailings_dust')
        .outputFluids(Fluid.of('tfg:purified_redstone_liquor', 6000))
        .duration(600)
        .EUt(LV);

    event.recipes.gtceu.centrifuge('tfg:lv_renewable_redstone_concentration')
        .inputFluids(Fluid.of('tfg:purified_redstone_liquor', 6000))
        .itemOutputs('8x tfg:redstone_crystal_precursor_dust')
        .outputFluids(Fluid.of('minecraft:water', 4000))
        .duration(400)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_redstone_mineralization')
        .itemInputs('8x tfg:redstone_crystal_precursor_dust', '2x tfg:iron_hydroxide_precipitate_dust')
        .inputFluids(
            Fluid.of('gtceu:hydrogen_sulfide', 250),
            Fluid.of('gtceu:oxygen', 500)
        )
        .itemOutputs('8x tfg:redstone_mineralized_precursor_dust')
        .duration(700)
        .EUt(LV);

    event.recipes.gtceu.autoclave('tfg:lv_renewable_poor_redstone')
        .itemInputs('8x tfg:redstone_mineralized_precursor_dust')
        .notConsumable('#tfg:renewable_redstone_seed')
        .inputFluids(Fluid.of('minecraft:water', 4000))
        .itemOutputs(ChemicalHelper.get(TFGTagPrefix.poorRawOre, GTMaterials.Redstone, 2))
        .duration(1000)
        .EUt(LV);

    // Tin: alkaline roast -> sodium stannate -> hydrated oxide -> seeded Cassiterite.
    // 1 poor Cassiterite per 111k EU batch.
    event.recipes.gtceu.electric_blast_furnace('tfg:lv_renewable_tin_alkaline_roast')
        .itemInputs('24x tfg:igneous_felsic_dust', '8x gtceu:sodium_hydroxide_dust', '4x tfc:powder/soda_ash')
        .itemOutputs('12x tfg:tin_alkaline_calcine_dust', '12x tfg:tin_silicate_residue_dust')
        .duration(900)
        .EUt(LV)
        .blastFurnaceTemp(1000);

    event.recipes.gtceu.mixer('tfg:lv_renewable_sodium_stannate')
        .itemInputs('12x tfg:tin_alkaline_calcine_dust')
        .inputFluids(Fluid.of('minecraft:water', 8000))
        .outputFluids(Fluid.of('tfg:sodium_stannate_liquor', 6000))
        .duration(600)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_hydrated_tin_oxide')
        .inputFluids(
            Fluid.of('tfg:sodium_stannate_liquor', 6000),
            Fluid.of('gtceu:hydrochloric_acid', 1000)
        )
        .itemOutputs('8x tfg:hydrated_tin_oxide_dust')
        .outputFluids(Fluid.of('tfg:spent_alkaline_brine', 6000))
        .duration(800)
        .EUt(LV);

    event.recipes.gtceu.centrifuge('tfg:lv_renewable_tin_oxide_precursor')
        .itemInputs('8x tfg:hydrated_tin_oxide_dust')
        .itemOutputs('8x tfg:tin_oxide_precursor_dust')
        .outputFluids(Fluid.of('minecraft:water', 1000))
        .duration(300)
        .EUt(LV);

    event.recipes.gtceu.autoclave('tfg:lv_renewable_poor_cassiterite')
        .itemInputs('8x tfg:tin_oxide_precursor_dust')
        .notConsumable('#tfg:renewable_cassiterite_seed')
        .inputFluids(Fluid.of('minecraft:water', 4000))
        .itemOutputs('tfc:ore/poor_cassiterite')
        .duration(1100)
        .EUt(LV);

    // Shared chloride-brine lixiviant. Preparation is a utility cost shared by
    // Lead and Silver and is not counted in either core per-ore timing contract.
    event.recipes.gtceu.mixer('tfg:lv_renewable_chloride_brine_lixiviant')
        .inputFluids(
            Fluid.of('tfc:salt_water', 6000),
            Fluid.of('gtceu:hydrochloric_acid', 1000)
        )
        .outputFluids(Fluid.of('tfg:chloride_brine_lixiviant', 7000))
        .duration(200)
        .EUt(LV);

    // Lead: chloride leach -> purified Pb liquor -> sulfide precipitation.
    // The silver-bearing residue is a feedstock for the dedicated Silver plant.
    event.recipes.gtceu.chemical_bath('tfg:lv_renewable_lead_chloride_leach')
        .itemInputs('32x tfg:metamorphic_dust')
        .inputFluids(Fluid.of('tfg:chloride_brine_lixiviant', 7000))
        .itemOutputs('24x tfg:lead_leached_concentrate_dust')
        .duration(800)
        .EUt(LV);

    event.recipes.gtceu.centrifuge('tfg:lv_renewable_lead_liquor_purification')
        .itemInputs('24x tfg:lead_leached_concentrate_dust')
        .itemOutputs('16x tfg:lead_gangue_dust', '4x tfg:argentiferous_residue_dust')
        .outputFluids(Fluid.of('tfg:purified_lead_liquor', 6000))
        .duration(500)
        .EUt(LV);

    event.recipes.gtceu.chemical_reactor('tfg:lv_renewable_galena_precipitation')
        .inputFluids(
            Fluid.of('tfg:purified_lead_liquor', 6000),
            Fluid.of('gtceu:hydrogen_sulfide', 500)
        )
        .itemOutputs('8x tfg:galena_precursor_dust')
        .outputFluids(Fluid.of('tfg:spent_chloride_brine', 6000))
        .duration(800)
        .EUt(LV);

    event.recipes.gtceu.autoclave('tfg:lv_renewable_poor_galena')
        .itemInputs('8x tfg:galena_precursor_dust')
        .notConsumable('#tfg:renewable_galena_seed')
        .inputFluids(Fluid.of('minecraft:water', 4000))
        .itemOutputs(ChemicalHelper.get(TFGTagPrefix.poorRawOre, GTMaterials.Galena, 1))
        .duration(1400)
        .EUt(LV);

    // ---------------------------------------------------------------------
    // MV expansion: Nickel, Silver, Arsenic and Cobaltite.
    // Nickel and Silver are normal industrial materials, so MV recipes process
    // four ore outputs per batch. Cobaltite stays deliberately expensive.
    // ---------------------------------------------------------------------

    // Shared sulfate pressure lixiviant keeps Autoclave recipes to one fluid input.
    // Its utility-preparation cost is separate from the normalized core ore chains.
    event.recipes.gtceu.mixer('tfg:mv_renewable_sulfate_pressure_lixiviant')
        .inputFluids(
            Fluid.of('gtceu:sulfuric_acid', 3000),
            Fluid.of('minecraft:water', 4500)
        )
        .outputFluids(Fluid.of('tfg:sulfate_pressure_lixiviant', 7500))
        .duration(200)
        .EUt(MV);

    event.recipes.gtceu.electric_blast_furnace('tfg:mv_renewable_nickel_laterite_activation')
        .itemInputs('48x tfg:igneous_mafic_dust')
        .itemOutputs('24x tfg:activated_nickel_laterite_dust')
        .duration(700)
        .EUt(MV)
        .blastFurnaceTemp(1200);

    event.recipes.gtceu.autoclave('tfg:mv_renewable_nickel_pressure_leach')
        .itemInputs('24x tfg:activated_nickel_laterite_dust')
        .inputFluids(Fluid.of('tfg:sulfate_pressure_lixiviant', 7500))
        .itemOutputs('12x tfg:nickel_iron_silica_residue_dust')
        .outputFluids(Fluid.of('tfg:nickel_sulfate_leachate', 8000))
        .duration(1100)
        .EUt(MV);

    event.recipes.gtceu.centrifuge('tfg:mv_renewable_nickel_liquor_purification')
        .inputFluids(Fluid.of('tfg:nickel_sulfate_leachate', 8000))
        .outputFluids(Fluid.of('tfg:purified_nickel_liquor', 6000))
        .duration(500)
        .EUt(MV);

    event.recipes.gtceu.chemical_reactor('tfg:mv_renewable_nickel_hydroxide')
        .itemInputs('12x gtceu:sodium_hydroxide_dust')
        .inputFluids(Fluid.of('tfg:purified_nickel_liquor', 6000))
        .itemOutputs('16x tfg:nickel_hydroxide_precipitate_dust')
        .outputFluids(Fluid.of('tfg:nickel_sulfate_wastewater', 6000))
        .duration(700)
        .EUt(MV);

    event.recipes.gtceu.mixer('tfg:mv_renewable_nickel_silicate_gel')
        .itemInputs('16x tfg:nickel_hydroxide_precipitate_dust', '8x tfg:nickel_iron_silica_residue_dust')
        .inputFluids(Fluid.of('minecraft:water', 4000))
        .itemOutputs('16x tfg:nickel_silicate_gel_dust')
        .duration(400)
        .EUt(MV);

    event.recipes.gtceu.autoclave('tfg:mv_renewable_poor_garnierite')
        .itemInputs('16x tfg:nickel_silicate_gel_dust')
        .notConsumable('#tfg:renewable_garnierite_seed')
        .inputFluids(Fluid.of('minecraft:water', 4000))
        .itemOutputs('4x tfc:ore/poor_garnierite')
        .duration(800)
        .EUt(MV);

    event.recipes.gtceu.electric_blast_furnace('tfg:mv_renewable_silver_chlorination_roast')
        .itemInputs('32x tfg:metamorphic_dust')
        .inputFluids(Fluid.of('gtceu:chlorine', 2000))
        .itemOutputs('16x tfg:silver_chloride_calcine_dust', '16x tfg:silver_silicate_residue_dust')
        .duration(700)
        .EUt(MV)
        .blastFurnaceTemp(1100);

    // Galena's argentiferous residue can substitute for half the fresh calcine input.
    event.recipes.gtceu.chemical_bath('tfg:mv_renewable_silver_chloride_leach')
        .itemInputs('16x tfg:silver_chloride_calcine_dust')
        .inputFluids(Fluid.of('tfg:chloride_brine_lixiviant', 4000))
        .itemOutputs('16x tfg:silver_leached_calcine_dust')
        .duration(600)
        .EUt(MV);

    event.recipes.gtceu.chemical_bath('tfg:mv_renewable_silver_from_galena_residue')
        .itemInputs('8x tfg:argentiferous_residue_dust')
        .inputFluids(Fluid.of('tfg:chloride_brine_lixiviant', 2000))
        .itemOutputs('8x tfg:silver_leached_calcine_dust')
        .duration(400)
        .EUt(MV);

    event.recipes.gtceu.centrifuge('tfg:mv_renewable_silver_chloride_precipitation')
        .itemInputs('16x tfg:silver_leached_calcine_dust')
        .itemOutputs('16x tfg:silver_chloride_precipitate_dust')
        .outputFluids(Fluid.of('tfg:depleted_silver_brine', 6000))
        .duration(500)
        .EUt(MV);

    event.recipes.gtceu.chemical_reactor('tfg:mv_renewable_silver_reduction')
        .itemInputs('16x tfg:silver_chloride_precipitate_dust')
        .inputFluids(Fluid.of('gtceu:hydrogen', 1000))
        .itemOutputs('16x tfg:silver_nuclei_dust')
        .outputFluids(Fluid.of('gtceu:hydrochloric_acid', 1000))
        .duration(600)
        .EUt(MV);

    event.recipes.gtceu.autoclave('tfg:mv_renewable_poor_native_silver')
        .itemInputs('16x tfg:silver_nuclei_dust')
        .notConsumable('#tfg:renewable_native_silver_seed')
        .inputFluids(Fluid.of('minecraft:water', 4000))
        .itemOutputs('4x tfc:ore/poor_native_silver')
        .duration(1200)
        .EUt(MV);

    // Arsenic: a complete renewable element chain. It terminates in normal
    // gtceu:arsenic_dust, not a renewable arsenic ore item.
    event.recipes.gtceu.electric_blast_furnace('tfg:mv_renewable_arsenic_roast')
        .itemInputs('32x tfg:metamorphic_dust')
        .inputFluids(Fluid.of('gtceu:oxygen', 1000))
        .itemOutputs('16x tfg:arsenic_bearing_calcine_dust', '16x tfg:arsenic_silicate_tailings_dust')
        .duration(800)
        .EUt(MV)
        .blastFurnaceTemp(1100);

    event.recipes.gtceu.chemical_bath('tfg:mv_renewable_arsenic_leach')
        .itemInputs('16x tfg:arsenic_bearing_calcine_dust')
        .inputFluids(Fluid.of('gtceu:diluted_hydrochloric_acid', 6000))
        .itemOutputs('16x tfg:arsenic_leached_concentrate_dust')
        .duration(700)
        .EUt(MV);

    event.recipes.gtceu.centrifuge('tfg:mv_renewable_arsenic_oxide_concentration')
        .itemInputs('16x tfg:arsenic_leached_concentrate_dust')
        .itemOutputs('8x tfg:arsenic_oxide_concentrate_dust')
        .outputFluids(Fluid.of('tfg:arsenic_spent_liquor', 4000))
        .duration(500)
        .EUt(MV);

    event.recipes.gtceu.chemical_reactor('tfg:mv_renewable_arsenic_reduction')
        .itemInputs('8x tfg:arsenic_oxide_concentrate_dust')
        .notConsumable('#tfg:renewable_arsenic_seed')
        .inputFluids(Fluid.of('gtceu:hydrogen', 3000))
        .itemOutputs('4x gtceu:arsenic_dust')
        .outputFluids(Fluid.of('minecraft:water', 3000))
        .duration(1600)
        .EUt(MV);

    event.recipes.gtceu.electric_blast_furnace('tfg:mv_renewable_cobalt_oxidative_roast')
        .itemInputs('40x tfg:igneous_intermediate_dust')
        .inputFluids(Fluid.of('gtceu:oxygen', 1000))
        .itemOutputs('20x tfg:cobalt_oxidized_calcine_dust')
        .duration(900)
        .EUt(MV)
        .blastFurnaceTemp(1300);

    event.recipes.gtceu.autoclave('tfg:mv_renewable_cobalt_pressure_leach')
        .itemInputs('20x tfg:cobalt_oxidized_calcine_dust')
        .inputFluids(Fluid.of('tfg:sulfate_pressure_lixiviant', 5000))
        .outputFluids(Fluid.of('tfg:cobalt_sulfate_leachate', 8000))
        .duration(1000)
        .EUt(MV);

    event.recipes.gtceu.centrifuge('tfg:mv_renewable_cobalt_liquor_purification')
        .inputFluids(Fluid.of('tfg:cobalt_sulfate_leachate', 8000))
        .itemOutputs('8x tfg:cobalt_impurity_sludge_dust')
        .outputFluids(Fluid.of('tfg:purified_cobalt_liquor', 6000))
        .duration(500)
        .EUt(MV);

    event.recipes.gtceu.chemical_reactor('tfg:mv_renewable_cobalt_hydroxide')
        .itemInputs('8x gtceu:sodium_hydroxide_dust')
        .inputFluids(Fluid.of('tfg:purified_cobalt_liquor', 6000))
        .itemOutputs('12x tfg:cobalt_hydroxide_precipitate_dust')
        .outputFluids(Fluid.of('tfg:cobalt_sulfate_wastewater', 6000))
        .duration(700)
        .EUt(MV);

    // The Cobaltite mineralization stage consumes renewable elemental arsenic.
    event.recipes.gtceu.chemical_reactor('tfg:mv_renewable_cobaltite_precursor')
        .itemInputs('12x tfg:cobalt_hydroxide_precipitate_dust', '4x gtceu:arsenic_dust')
        .inputFluids(Fluid.of('gtceu:hydrogen_sulfide', 1000))
        .itemOutputs('12x tfg:cobaltite_precursor_dust')
        .duration(900)
        .EUt(MV);

    event.recipes.gtceu.autoclave('tfg:mv_renewable_poor_cobaltite')
        .itemInputs('12x tfg:cobaltite_precursor_dust')
        .notConsumable('#tfg:renewable_cobaltite_seed')
        .inputFluids(Fluid.of('minecraft:water', 4000))
        .itemOutputs(ChemicalHelper.get(TFGTagPrefix.poorRawOre, GTMaterials.Cobaltite, 2))
        .duration(1000)
        .EUt(MV);

    // ---------------------------------------------------------------------
    // HV expansion: Gold. Gold is intentionally not normalized to a full 16x
    // HV batch; it remains a genuinely expensive strategic material.
    // ---------------------------------------------------------------------

    event.recipes.gtceu.large_chemical_reactor('tfg:hv_renewable_aqua_regia')
        .inputFluids(
            Fluid.of('gtceu:hydrochloric_acid', 3000),
            Fluid.of('gtceu:nitric_acid', 1000)
        )
        .outputFluids(Fluid.of('tfg:aqua_regia', 4000))
        .duration(200)
        .EUt(HV);

    event.recipes.gtceu.electric_blast_furnace('tfg:hv_renewable_gold_refractory_roast')
        .itemInputs('48x tfg:igneous_felsic_dust')
        .itemOutputs('24x tfg:refractory_gold_calcine_dust', '24x tfg:gold_refractory_tailings_dust')
        .duration(400)
        .EUt(HV)
        .blastFurnaceTemp(1600);

    event.recipes.gtceu.large_chemical_reactor('tfg:hv_renewable_gold_aqua_regia_leach')
        .itemInputs('24x tfg:refractory_gold_calcine_dust')
        .inputFluids(
            Fluid.of('tfg:aqua_regia', 4000),
            Fluid.of('minecraft:water', 4000)
        )
        .outputFluids(Fluid.of('tfg:chloroauric_leachate', 8000))
        .duration(600)
        .EUt(HV);

    event.recipes.gtceu.centrifuge('tfg:hv_renewable_gold_liquor_purification')
        .inputFluids(Fluid.of('tfg:chloroauric_leachate', 8000))
        .outputFluids(
            Fluid.of('tfg:purified_gold_chloride', 6000),
            Fluid.of('tfg:spent_aqua_regia', 2000)
        )
        .duration(400)
        .EUt(HV);

    event.recipes.gtceu.large_chemical_reactor('tfg:hv_renewable_gold_reduction')
        .inputFluids(
            Fluid.of('tfg:purified_gold_chloride', 6000),
            Fluid.of('gtceu:hydrogen', 1000)
        )
        .itemOutputs('16x tfg:gold_nuclei_dust')
        .outputFluids(Fluid.of('gtceu:hydrochloric_acid', 1000))
        .duration(600)
        .EUt(HV);

    event.recipes.gtceu.autoclave('tfg:hv_renewable_poor_native_gold')
        .itemInputs('16x tfg:gold_nuclei_dust')
        .notConsumable('#tfg:renewable_native_gold_seed')
        .inputFluids(Fluid.of('minecraft:water', 4000))
        .itemOutputs('4x tfc:ore/poor_native_gold')
        .duration(1100)
        .EUt(HV);

    // ---------------------------------------------------------------------
    // Secondary uses and recovery paths for every new side stream.
    // ---------------------------------------------------------------------

    event.recipes.gtceu.centrifuge('tfg:lv_recycle_redstone_silicate_tailings')
        .itemInputs('8x tfg:redstone_silicate_tailings_dust')
        .itemOutputs('gtceu:silicon_dioxide_dust')
        .duration(160)
        .EUt(16);

    event.recipes.gtceu.centrifuge('tfg:lv_recycle_tin_silicate_residue')
        .itemInputs('8x tfg:tin_silicate_residue_dust')
        .itemOutputs('gtceu:silicon_dioxide_dust')
        .duration(160)
        .EUt(16);

    event.recipes.gtceu.chemical_reactor('tfg:lv_recycle_spent_alkaline_brine')
        .itemInputs('gtceu:silicon_dioxide_dust')
        .inputFluids(Fluid.of('tfg:spent_alkaline_brine', 6000))
        .outputFluids(
            Fluid.of('tfg:sodium_silicate', 1000),
            Fluid.of('minecraft:water', 4000)
        )
        .duration(400)
        .EUt(LV);

    event.recipes.gtceu.centrifuge('tfg:lv_recycle_lead_gangue')
        .itemInputs('8x tfg:lead_gangue_dust')
        .itemOutputs('gtceu:stone_dust', 'gtceu:calcite_dust')
        .duration(200)
        .EUt(16);

    // The four residue left by one Nickel batch can be separately valorized.
    event.recipes.gtceu.centrifuge('tfg:mv_recycle_nickel_iron_silica_residue')
        .itemInputs('4x tfg:nickel_iron_silica_residue_dust')
        .itemOutputs('gtceu:iron_dust', 'gtceu:silicon_dioxide_dust')
        .duration(240)
        .EUt(MV);

    event.recipes.gtceu.chemical_reactor('tfg:mv_recycle_nickel_sulfate_wastewater')
        .itemInputs('2x tfc:powder/flux')
        .inputFluids(Fluid.of('tfg:nickel_sulfate_wastewater', 6000))
        .itemOutputs('2x gtceu:gypsum_dust')
        .outputFluids(Fluid.of('minecraft:water', 4500))
        .duration(320)
        .EUt(MV);

    event.recipes.gtceu.centrifuge('tfg:mv_recycle_silver_silicate_residue')
        .itemInputs('8x tfg:silver_silicate_residue_dust')
        .itemOutputs('gtceu:silicon_dioxide_dust')
        .duration(180)
        .EUt(MV);

    event.recipes.gtceu.centrifuge('tfg:mv_recycle_depleted_silver_brine')
        .inputFluids(Fluid.of('tfg:depleted_silver_brine', 6000))
        .itemOutputs('2x gtceu:salt_dust')
        .outputFluids(Fluid.of('minecraft:water', 4000))
        .duration(300)
        .EUt(MV);

    event.recipes.gtceu.centrifuge('tfg:mv_recycle_arsenic_silicate_tailings')
        .itemInputs('8x tfg:arsenic_silicate_tailings_dust')
        .itemOutputs('gtceu:silicon_dioxide_dust')
        .duration(180)
        .EUt(MV);

    event.recipes.gtceu.chemical_reactor('tfg:mv_recycle_arsenic_spent_liquor')
        .inputFluids(Fluid.of('tfg:arsenic_spent_liquor', 4000))
        .outputFluids(
            Fluid.of('gtceu:diluted_hydrochloric_acid', 1000),
            Fluid.of('minecraft:water', 2500)
        )
        .duration(300)
        .EUt(MV);

    event.recipes.gtceu.centrifuge('tfg:mv_recycle_cobalt_impurity_sludge')
        .itemInputs('8x tfg:cobalt_impurity_sludge_dust')
        .itemOutputs('gtceu:clay_dust')
        .duration(200)
        .EUt(MV);

    event.recipes.gtceu.chemical_reactor('tfg:mv_recycle_cobalt_sulfate_wastewater')
        .itemInputs('2x tfc:powder/flux')
        .inputFluids(Fluid.of('tfg:cobalt_sulfate_wastewater', 6000))
        .itemOutputs('2x gtceu:gypsum_dust')
        .outputFluids(Fluid.of('minecraft:water', 4500))
        .duration(320)
        .EUt(MV);

    event.recipes.gtceu.centrifuge('tfg:hv_recycle_gold_refractory_tailings')
        .itemInputs('8x tfg:gold_refractory_tailings_dust')
        .itemOutputs('gtceu:silicon_dioxide_dust')
        .duration(200)
        .EUt(HV);

    event.recipes.gtceu.large_chemical_reactor('tfg:hv_recover_spent_aqua_regia')
        .inputFluids(Fluid.of('tfg:spent_aqua_regia', 2000))
        .outputFluids(
            Fluid.of('gtceu:diluted_hydrochloric_acid', 1000),
            Fluid.of('minecraft:water', 750)
        )
        .duration(300)
        .EUt(HV);

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
