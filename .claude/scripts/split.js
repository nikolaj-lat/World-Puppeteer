#!/usr/bin/env node

/**
 * Voyage World Config Split Tool
 *
 * Splits a world config JSON into logical section files for easier editing.
 *
 * Usage:
 *   node split.js <world.json> [output-directory]
 *   node split.js my-world.json ./sections/
 *
 * Creates these files (granular split for easier editing):
 *   - settings.json       (game balance: attributes, skills, combat, items)
 *   - realms.json         (realm definitions)
 *   - regions.json        (region definitions)
 *   - locations.json      (location definitions with areas)
 *   - npcs.json           (NPC definitions)
 *   - npc-types.json      (NPC type templates)
 *   - factions.json       (faction definitions)
 *   - items.json          (item definitions)
 *   - skills.json         (skill definitions)
 *   - traits.json         (traits and traitCategories)
 *   - abilities.json      (ability definitions)
 *   - story-starts.json   (story start scenarios)
 *   - triggers.json       (trigger definitions)
 *   - quests.json         (quest definitions)
 *   - world-lore.json     (worldLore entries)
 *   - world-background.json (storySettings with worldBackground)
 *   - ai-instructions.json (aiInstructions, narratorStyle, resourceSettings, death)
 *   - archetypes.json (authorSeeds, characterArchetypes, locationArchetypes,
 *                            regionArchetypes, encounterElements)
 *   - premade-characters.json (premadeCharacters)
 *   - meta.json           (version, embeddings, tipSettings, nameFilterSettings,
 *                          randomNames, mods)
 */

const fs = require('fs');
const path = require('path');

// Granular sections - each potentially large section gets its own file
const SECTIONS = {
  settings: [
    'attributeSettings',
    'skillSettings',
    'locationSettings',
    'itemSettings',
    'combatSettings',
    'otherSettings',
  ],
  realms: ['realms'],
  regions: ['regions'],
  locations: ['locations'],
  npcs: ['npcs'],
  'npc-types': ['npcTypes'],
  factions: ['factions'],
  items: ['items'],
  skills: ['skills'],
  traits: ['traitCategories', 'traits'],
  abilities: ['abilities'],
  'story-starts': ['storyStarts'],
  triggers: ['triggers'],
  quests: ['quests'],
  'world-lore': ['worldLore'],
  'world-background': ['worldBackground'],
  'ai-instructions': ['aiInstructions', 'narratorStyle', 'death', 'resourceSettings', 'storySettings'],
  'archetypes': [
    'authorSeeds',
    'characterArchetypes',
    'locationArchetypes',
    'regionArchetypes',
    'encounterElements',
  ],
  'premade-characters': ['premadeCharacters'],
  meta: [
    'configVersion',
    'heroesVersion',
    'embeddings',
    'tipSettings',
    'nameFilterSettings',
    'randomNames',
    'mods',
  ],
};

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node split.js <world.json> [output-directory]');
    console.error('');
    console.error('Splits a world config into granular section files.');
    console.error('Output defaults to tabs/ directory if not specified.');
    console.error('');
    console.error('  - settings.json        (attributes, skills, combat, items)');
    console.error('  - realms.json          (realm definitions)');
    console.error('  - regions.json         (region definitions)');
    console.error('  - locations.json       (location definitions)');
    console.error('  - npcs.json            (NPC definitions)');
    console.error('  - npc-types.json       (NPC type templates)');
    console.error('  - factions.json        (faction definitions)');
    console.error('  - items.json           (item definitions)');
    console.error('  - skills.json          (skill definitions)');
    console.error('  - traits.json          (traits and traitCategories)');
    console.error('  - abilities.json       (ability definitions)');
    console.error('  - story-starts.json    (story start scenarios)');
    console.error('  - triggers.json        (trigger definitions)');
    console.error('  - quests.json          (quest definitions)');
    console.error('  - world-lore.json      (worldLore entries)');
    console.error('  - world-background.json (storySettings with worldBackground)');
    console.error('  - ai-instructions.json (AI instructions, narrator style, resources, death)');
    console.error('  - archetypes.json (author seeds, character/location/region archetypes)');
    console.error('  - premade-characters.json (premade character options)');
    console.error('  - meta.json            (version, embeddings, tips, name filter, random names, mods)');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const outputDir = args[1] ? path.resolve(args[1]) : path.join(__dirname, '../../tabs');

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  let config;
  try {
    const content = fs.readFileSync(inputPath, 'utf-8');
    config = JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${inputPath}: ${err.message}`);
    process.exit(1);
  }

  // Create output directory if needed
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Hoist storySettings.worldBackground to top-level so it can live in its own file.
  // build.js re-nests it under storySettings on merge.
  if (config.storySettings && typeof config.storySettings === 'object'
      && 'worldBackground' in config.storySettings) {
    config.worldBackground = config.storySettings.worldBackground;
    delete config.storySettings.worldBackground;
    if (Object.keys(config.storySettings).length === 0) {
      delete config.storySettings;
    }
  }

  // Track which keys we've assigned
  const assigned = new Set();

  // Create section files
  for (const [sectionName, keys] of Object.entries(SECTIONS)) {
    const section = {};

    for (const key of keys) {
      if (config[key] !== undefined) {
        section[key] = config[key];
        assigned.add(key);
      }
    }

    if (Object.keys(section).length > 0) {
      const outputPath = path.join(outputDir, `${sectionName}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(section, null, 2));
      console.log(`Created: ${sectionName}.json (${Object.keys(section).length} fields)`);
    }
  }

  // Check for unassigned keys
  const unassigned = Object.keys(config).filter(k => !assigned.has(k));
  if (unassigned.length > 0) {
    console.log(`\nWarning: Unassigned fields added to meta.json: ${unassigned.join(', ')}`);

    // Add unassigned to meta
    const metaPath = path.join(outputDir, 'meta.json');
    let meta = {};
    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }

    for (const key of unassigned) {
      meta[key] = config[key];
    }

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }

  console.log(`\nSplit complete. Files written to: ${outputDir}`);
  console.log('\nTo reassemble, run:');
  console.log(`  node merge.js world.json ${Object.keys(SECTIONS).map(s => `${s}.json`).join(' ')}`);
}

main();
