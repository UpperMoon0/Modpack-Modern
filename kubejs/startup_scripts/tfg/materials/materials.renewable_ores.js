// priority: 0
"use strict";

/**
 * Multi-tier renewable resource intermediates.
 *
 * These materials are intentionally non-decomposable. Process intermediates
 * carry state between renewable synthesis stages, while waste materials may only
 * be reclaimed through explicit recipes whose yields cannot bypass the ore gate.
 *
 * @param {Internal.MaterialEventJS} event
 */
function registerTFGRenewableOreMaterials(event) {
    const noDecomp = GTMaterialFlags.DISABLE_DECOMPOSITION;

    // Shared / iron line fluids
    event.create('tfg:mafic_mineral_slurry')
        .liquid(new GTFluidBuilder().temperature(323))
        .color(0x555c56)
        .flags(noDecomp);

    event.create('tfg:iron_bearing_leachate')
        .liquid(new GTFluidBuilder().temperature(343))
        .color(0x8f6138)
        .flags(noDecomp);

    event.create('tfg:purified_iron_liquor')
        .liquid(new GTFluidBuilder().temperature(323))
        .color(0xa36a34)
        .flags(noDecomp);

    event.create('tfg:acidic_iron_wastewater')
        .liquid(new GTFluidBuilder().temperature(303))
        .color(0x55483b)
        .flags(noDecomp);

    // Copper line fluids
    event.create('tfg:copper_bearing_leachate')
        .liquid(new GTFluidBuilder().temperature(333))
        .color(0x3f8874)
        .flags(noDecomp);

    event.create('tfg:purified_copper_liquor')
        .liquid(new GTFluidBuilder().temperature(313))
        .color(0x27a881)
        .flags(noDecomp);

    event.create('tfg:copper_sulfate_wastewater')
        .liquid(new GTFluidBuilder().temperature(303))
        .color(0x52736b)
        .flags(noDecomp);

    // Zinc line fluids
    event.create('tfg:zinc_bearing_leachate')
        .liquid(new GTFluidBuilder().temperature(333))
        .color(0x9c9978)
        .flags(noDecomp);

    event.create('tfg:purified_zinc_liquor')
        .liquid(new GTFluidBuilder().temperature(313))
        .color(0xc4c092)
        .flags(noDecomp);

    event.create('tfg:zinc_sulfide_slurry')
        .liquid(new GTFluidBuilder().temperature(303))
        .color(0xd6c98b)
        .flags(noDecomp);

    event.create('tfg:spent_chloride_brine')
        .liquid(new GTFluidBuilder().temperature(303))
        .color(0x8f8b77)
        .flags(noDecomp);

    // Renewable marine sulfur line.
    event.create('tfg:sulfate_rich_brine')
        .liquid(new GTFluidBuilder().temperature(303))
        .color(0xb6c8c6)
        .flags(noDecomp);

    event.create('tfg:spent_marine_brine')
        .liquid(new GTFluidBuilder().temperature(303))
        .color(0x8f9d99)
        .flags(noDecomp);

    // Solid intermediates and deliberately low-value waste streams.
    event.create('tfg:iron_silicate_tailings')
        .dust()
        .color(0x756c62)
        .flags(noDecomp);

    event.create('tfg:copper_silicate_tailings')
        .dust()
        .color(0x66756d)
        .flags(noDecomp);

    event.create('tfg:zinc_carbonate_tailings')
        .dust()
        .color(0x8c8974)
        .flags(noDecomp);

    event.create('tfg:iron_impurity_sludge')
        .dust()
        .color(0x5f4a37)
        .flags(noDecomp);

    event.create('tfg:iron_hydroxide_precipitate')
        .dust()
        .color(0xb17942)
        .flags(noDecomp);

    event.create('tfg:copper_impurity_sludge')
        .dust()
        .color(0x49675d)
        .flags(noDecomp);

    event.create('tfg:basic_copper_carbonate')
        .dust()
        .color(0x25a56d)
        .flags(noDecomp);

    event.create('tfg:zinc_impurity_sludge')
        .dust()
        .color(0x817d69)
        .flags(noDecomp);

    event.create('tfg:sphalerite_crystals')
        .dust()
        .color(0xd6bd69)
        .flags(noDecomp);

    event.create('tfg:marine_gypsum')
        .dust()
        .color(0xe5e0cf)
        .flags(noDecomp);

    event.create('tfg:calcium_sulfide')
        .dust()
        .color(0xc7bd88)
        .flags(noDecomp);

    event.create('tfg:calcium_carbonate_residue')
        .dust()
        .color(0xc8c5b5)
        .flags(noDecomp);

    // Renewable Redstone line.
    event.create('tfg:redstone_mineral_slurry').liquid(new GTFluidBuilder().temperature(333)).color(0x8f2f2f).flags(noDecomp);
    event.create('tfg:purified_redstone_liquor').liquid(new GTFluidBuilder().temperature(323)).color(0xb33b3b).flags(noDecomp);
    event.create('tfg:redstone_crystal_precursor').dust().color(0xc24141).flags(noDecomp);
    event.create('tfg:redstone_mineralized_precursor').dust().color(0xd34a44).flags(noDecomp);
    event.create('tfg:redstone_silicate_tailings').dust().color(0x776b67).flags(noDecomp);

    // Renewable Tin / Cassiterite line.
    event.create('tfg:tin_alkaline_calcine').dust().color(0x9b9b93).flags(noDecomp);
    event.create('tfg:sodium_stannate_liquor').liquid(new GTFluidBuilder().temperature(353)).color(0xc9d0c2).flags(noDecomp);
    event.create('tfg:hydrated_tin_oxide').dust().color(0xd7d6c8).flags(noDecomp);
    event.create('tfg:tin_oxide_precursor').dust().color(0xc7c7bc).flags(noDecomp);
    event.create('tfg:tin_silicate_residue').dust().color(0x8d887c).flags(noDecomp);
    event.create('tfg:spent_alkaline_brine').liquid(new GTFluidBuilder().temperature(313)).color(0xa8ad9c).flags(noDecomp);

    // Shared chloride-brine lixiviant for Lead and Silver hydrometallurgy.
    event.create('tfg:chloride_brine_lixiviant').liquid(new GTFluidBuilder().temperature(333)).color(0xa5aa96).flags(noDecomp);

    // Renewable Lead / Galena line.
    event.create('tfg:lead_leached_concentrate').dust().color(0x8f8b91).flags(noDecomp);
    event.create('tfg:purified_lead_liquor').liquid(new GTFluidBuilder().temperature(323)).color(0xb0abb3).flags(noDecomp);
    event.create('tfg:galena_precursor').dust().color(0x6f6b73).flags(noDecomp);
    event.create('tfg:lead_gangue').dust().color(0x77716c).flags(noDecomp);
    event.create('tfg:argentiferous_residue').dust().color(0xa49fa4).flags(noDecomp);

    // Shared sulfate pressure lixiviant for Nickel and Cobalt autoclaves.
    event.create('tfg:sulfate_pressure_lixiviant').liquid(new GTFluidBuilder().temperature(373)).color(0x9a9a83).flags(noDecomp);

    // Renewable Nickel / Garnierite line.
    event.create('tfg:activated_nickel_laterite').dust().color(0x8d7f58).flags(noDecomp);
    event.create('tfg:nickel_sulfate_leachate').liquid(new GTFluidBuilder().temperature(393)).color(0x6f8f72).flags(noDecomp);
    event.create('tfg:purified_nickel_liquor').liquid(new GTFluidBuilder().temperature(343)).color(0x8fb27d).flags(noDecomp);
    event.create('tfg:nickel_hydroxide_precipitate').dust().color(0x91aa76).flags(noDecomp);
    event.create('tfg:nickel_silicate_gel').dust().color(0x9aa86f).flags(noDecomp);
    event.create('tfg:nickel_iron_silica_residue').dust().color(0x725b48).flags(noDecomp);
    event.create('tfg:nickel_sulfate_wastewater').liquid(new GTFluidBuilder().temperature(313)).color(0x718078).flags(noDecomp);

    // Renewable Silver line.
    event.create('tfg:silver_chloride_calcine').dust().color(0xc9c4b0).flags(noDecomp);
    event.create('tfg:silver_leached_calcine').dust().color(0xb6b09e).flags(noDecomp);
    event.create('tfg:silver_chloride_precipitate').dust().color(0xd8d5c7).flags(noDecomp);
    event.create('tfg:silver_nuclei').dust().color(0xd5d8d8).flags(noDecomp);
    event.create('tfg:silver_silicate_residue').dust().color(0x89857c).flags(noDecomp);
    event.create('tfg:depleted_silver_brine').liquid(new GTFluidBuilder().temperature(313)).color(0x8f8c84).flags(noDecomp);

    // Renewable Arsenic line. Final product is normal GT arsenic dust.
    event.create('tfg:arsenic_bearing_calcine').dust().color(0x9b704e).flags(noDecomp);
    event.create('tfg:arsenic_leached_concentrate').dust().color(0x8f6b4d).flags(noDecomp);
    event.create('tfg:arsenic_oxide_concentrate').dust().color(0xb58a62).flags(noDecomp);
    event.create('tfg:arsenic_silicate_tailings').dust().color(0x7c6f65).flags(noDecomp);
    event.create('tfg:arsenic_spent_liquor').liquid(new GTFluidBuilder().temperature(313)).color(0x81766d).flags(noDecomp);

    // Renewable Cobaltite line.
    event.create('tfg:cobalt_oxidized_calcine').dust().color(0x5f6d89).flags(noDecomp);
    event.create('tfg:cobalt_sulfate_leachate').liquid(new GTFluidBuilder().temperature(393)).color(0x6679a0).flags(noDecomp);
    event.create('tfg:purified_cobalt_liquor').liquid(new GTFluidBuilder().temperature(343)).color(0x7891bb).flags(noDecomp);
    event.create('tfg:cobalt_hydroxide_precipitate').dust().color(0x7185a8).flags(noDecomp);
    event.create('tfg:cobaltite_precursor').dust().color(0x566070).flags(noDecomp);
    event.create('tfg:cobalt_impurity_sludge').dust().color(0x665b56).flags(noDecomp);
    event.create('tfg:cobalt_sulfate_wastewater').liquid(new GTFluidBuilder().temperature(313)).color(0x697681).flags(noDecomp);

    // Renewable Gold line.
    event.create('tfg:aqua_regia').liquid(new GTFluidBuilder().temperature(303)).color(0xd59b38).flags(noDecomp);
    event.create('tfg:refractory_gold_calcine').dust().color(0x9a8758).flags(noDecomp);
    event.create('tfg:chloroauric_leachate').liquid(new GTFluidBuilder().temperature(353)).color(0xd2a744).flags(noDecomp);
    event.create('tfg:purified_gold_chloride').liquid(new GTFluidBuilder().temperature(333)).color(0xe0b84a).flags(noDecomp);
    event.create('tfg:gold_nuclei').dust().color(0xe4bd45).flags(noDecomp);
    event.create('tfg:gold_refractory_tailings').dust().color(0x796d5e).flags(noDecomp);
    event.create('tfg:spent_aqua_regia').liquid(new GTFluidBuilder().temperature(313)).color(0x9b8760).flags(noDecomp);

}
