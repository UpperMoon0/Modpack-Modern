// priority: 0
"use strict";

function registerTFGMaterialItemTags(event) {
	
	// Platline
	event.add('tfg:platinum_ore_group', 'gtceu:purified_pentlandite_ore')
	event.add('tfg:platinum_ore_group', 'gtceu:purified_irarsite_ore')
	event.add('tfg:platinum_ore_group', 'gtceu:purified_chalcopyrite_ore')
	event.add('tfg:platinum_ore_group', 'gtceu:purified_tetrahedrite_ore')
	event.add('tfg:platinum_ore_group', 'gtceu:purified_ruarsite_ore')
	event.add('tfg:platinum_ore_group', 'gtceu:purified_bornite_ore')
	event.add('tfg:platinum_ore_group', 'gtceu:purified_cooperite_ore')
	event.add('tfg:platinum_ore_group', 'gtceu:purified_chalcocite_ore')
	event.add('tfg:platinum_ore_group', 'gtceu:purified_ferhodsite_ore')
	
	// Renewable ore discovery seeds: any grade proves the player has found the mineral.
	for (const ore of ['hematite', 'malachite', 'sphalerite', 'cassiterite', 'garnierite', 'native_silver', 'native_gold']) {
		event.add('tfg:renewable_' + ore + '_seed', 'tfc:ore/poor_' + ore)
		event.add('tfg:renewable_' + ore + '_seed', 'tfc:ore/normal_' + ore)
		event.add('tfg:renewable_' + ore + '_seed', 'tfc:ore/rich_' + ore)
	}

	// GT raw-ore discovery seeds use explicit registered item IDs. Do not resolve
	// ChemicalHelper stacks during the tag event: Galena can resolve to an empty
	// ingredient there even though the poor/normal/rich raw items are registered.
	const gtRawOreSeeds = {
		redstone: ['gtceu:poor_raw_redstone', 'gtceu:raw_redstone', 'gtceu:rich_raw_redstone'],
		galena: ['gtceu:poor_raw_galena', 'gtceu:raw_galena', 'gtceu:rich_raw_galena'],
		cobaltite: ['gtceu:poor_raw_cobaltite', 'gtceu:raw_cobaltite', 'gtceu:rich_raw_cobaltite']
	}
	for (const [name, items] of Object.entries(gtRawOreSeeds)) {
		for (const item of items) {
			event.add('tfg:renewable_' + name + '_seed', item)
		}
	}
	event.add('tfg:renewable_arsenic_seed', 'gtceu:arsenic_dust')

	// Crafting components
	event.add('tfg:aluminium_oxide', '#forge:dusts/alumina')
	event.add('tfg:aluminium_oxide', '#forge:dusts/bauxite')
	event.add('tfg:aluminium_oxide', '#forge:dusts/sapphire')
	event.add('tfg:aluminium_oxide', '#forge:dusts/green_sapphire')

	event.remove('forge:raw_materials/cursecoal', 'beneath:cursecoal')
	event.add('forge:raw_materials/anthracite', 'beneath:cursecoal')
	event.add('forge:raw_materials/lignite', 'tfc:ore/lignite')
	event.add('forge:raw_materials/coal', 'tfc:ore/bituminous_coal')
}

function registerTFGMaterialBlockTags(event) {

	// Hide cast iron and vanilla stone ores from ALI
	event.removeAllTagsFrom('minecraft:raw_iron_block')
	
	let stone_ores = Ingredient.of('#forge:ores_in_ground/stone').itemIds.toArray().map(String);
	stone_ores.forEach(item => 
	{
		event.removeAllTagsFrom(item)
	})

	let iron_ores = Ingredient.of('#forge:ores/iron').itemIds.toArray().map(String);
	iron_ores.forEach(item => 
	{
		event.removeAllTagsFrom(item)
	})
}
