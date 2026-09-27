// priority: 0
"use strict";

/**
 * LV renewable-ore intermediates.
 *
 * These materials are intentionally non-decomposable. Their only purpose is to
 * carry state between the renewable synthesis stages; they must not expose
 * alternate decomposition paths that bypass the normal TFG ore chain.
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
}
