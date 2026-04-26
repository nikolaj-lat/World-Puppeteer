#!/usr/bin/env node

/**
 * Voyage World Config Validator
 *
 * Comprehensive standalone validation for world config JSON files.
 * Checks required fields, reference integrity, types, enums, and limits.
 *
 * Usage:
 *   node validate.js <world.json> [--json] [--verbose]
 *   node validate.js my-world.json
 *   node validate.js my-world.json --json > report.json
 *
 * Validates:
 *   - Required top-level fields
 *   - Required settings subfields
 *   - Entity reference integrity (NPC → location, item → slot, etc.)
 *   - Enum values (trigger types, NPC tiers, damage types, etc.)
 *   - Basic type checks
 *   - Character and count limits
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// ENUMS AND VALID VALUES
// ============================================================================

const VALID_TRIGGER_CONDITION_TYPES = [
  'story',
  'action',
  'story-text',
  'action-text',
  'player-level',
  'game-tick',
  'party-realm',
  'party-region',
  'party-location',
  'party-area',
  'player-resource',
  'known-entity',
  'player-traits',
  'quests-completed',
  'read-string',
  'read-number',
  'read-boolean',
  'read-array',
];

const VALID_TRIGGER_EFFECT_TYPES = [
  'story',
  'quest-progress',
  'party-realm',
  'party-region',
  'party-location',
  'party-area',
  'player-resource',
  'known-entity',
  'player-traits',
  'quest-init',
  'write-string',
  'write-number',
  'write-boolean',
  'write-array',
];

const VALID_NPC_TIERS = ['trivial', 'weak', 'average', 'strong', 'elite', 'boss', 'mythic'];

// Default damage types - used when world doesn't define custom types
const DEFAULT_DAMAGE_TYPES = [
  'piercing',
  'slashing',
  'bludgeoning',
  'poisoning',
  'fire',
  'lightning',
  'wind',
  'water',
  'arcane',
  'light',
  'dark',
  'psychic',
];

const VALID_ITEM_TIERS = ['weak', 'common', 'strong', 'epic', 'legendary'];

const VALID_STRING_OPERATORS = ['equals', 'notEquals', 'contains', 'notContains', 'regex'];
const VALID_NUMBER_OPERATORS = [
  'equals',
  'notEquals',
  'greaterThan',
  'lessThan',
  'greaterThanOrEqual',
  'lessThanOrEqual',
];
const VALID_BOOLEAN_OPERATORS = ['equals', 'notEquals'];
const VALID_ARRAY_OPERATORS = ['contains', 'notContains'];

const VALID_NUMBER_EFFECT_OPERATORS = ['add', 'subtract', 'multiply', 'divide', 'set'];
const VALID_BOOLEAN_EFFECT_OPERATORS = ['set', 'toggle'];
const VALID_ARRAY_EFFECT_OPERATORS = ['set', 'add', 'remove'];

// ============================================================================
// REQUIRED FIELDS
// ============================================================================

const REQUIRED_TOP_LEVEL = [
  'configVersion',
  'heroesVersion',
  'aiInstructions',
  'storySettings',
  'worldLore',
  'embeddings',
  'triggers',
  'storyStarts',
  'abilities',
  'npcTypes',
  'items',
  'realms',
  'regions',
  'locations',
  'factions',
  'npcs',
  'quests',
  'attributeSettings',
  'skills',
  'skillSettings',
  'traits',
  'traitCategories',
  'locationSettings',
  'itemSettings',
  'combatSettings',
  'otherSettings',
  'tipSettings',
  'resourceSettings',
  'death',
  'nameFilterSettings',
  'narratorStyle',
  'premadeCharacters',
  'authorSeeds',
  'characterArchetypes',
  'locationArchetypes',
  'regionArchetypes',
  'encounterElements',
  'randomNames',
  'mods',
];

const REQUIRED_ATTRIBUTE_SETTINGS = [
  'attributeNames',
  'startingAttributeValue',
  'startingAttributePoints',
  'attributeStatModifiers',
  'maxStartingAttribute',
  'lowAttributeThreshold',
  'lowAttributeTraits',
  'attributeBonusModifier',
];

const REQUIRED_SKILL_SETTINGS = [
  'trainingCooldown',
  'skillXPRewards',
  'skillBonusModifier',
  'xpFromNewSkill',
  'maxSkillLevel',
  'maxSkillSuccessLevel',
  'charXPPerSkillLevel',
  'baseXPFromSkillUpgrade',
  'additionalXPRequiredPerSkillLevel',
  'startingXPToLevelUpSkill',
  'baseChanceToLearnNewSkill',
  'skillLearningBonusModifier',
  'skillTypeDifficultyBonus',
];

const REQUIRED_COMBAT_SETTINGS = [
  'minCombatXP',
  'baseCombatXP',
  'abilityCooldown',
  'abilityBonus',
  'npcDailyHealingAmount',
  'damageTypes',
];

const REQUIRED_OTHER_SETTINGS = [
  'startingCharacterLevelUpRequirement',
  'extraRequiredXPPerCharacterLevel',
  'maxCharacterLevel',
  'npcHealthPerLevel',
  'npcMinHealth',
];

const REQUIRED_LOCATION_SETTINGS = [
  'regionSize',
  'simpleRadius',
  'complexRadius',
  'regionLocationCount',
  'regionFactionCount',
  'avgTravelDistance',
  'minTravelDistance',
  'encountersEnabled',
];

const REQUIRED_ITEM_SETTINGS = [
  'currencyName',
  'itemCategories',
  'itemSlots',
  'startingItems',
];

const REQUIRED_TIP_SETTINGS = [
  'tips',
  'tipDisplayEnabled',
  'tipTurnInterval',
  'tipMinimumTurns',
  'tipMaximumTurns',
];

const REQUIRED_DEATH = ['permadeath', 'instructions'];

const REQUIRED_RESOURCE_FIELDS = [
  'name',
  'initialValue',
  'maxValue',
  'rechargeRate',
  'restRechargeMultiplier',
  'gainPerLevel',
  'color',
];

// ============================================================================
// LIMITS (for validation)
// ============================================================================

const LIMITS = {
  total: 10_000_000,
  sections: {
    worldLore: 500_000,
    npcs: 1_000_000,
    locations: 1_000_000,
    npcTypes: 500_000,
    items: 100_000,
    factions: 100_000,
    regions: 100_000,
    traitCategories: 100_000,
    itemSettings: 5_000,
  },
  counts: {
    storyStarts: 100,
    semanticTriggers: 200,
    mechanicalTriggers: 500,
    abilities: 1_000,
    triggerConditions: 5,
    triggerEffects: 5,
    abilityRequirements: 10,
    triggerSize: 10_000,
  },
  fields: {
    worldBackground: 5_000,
    questGenerationGuidance: 5_000,
    narratorStyle: 2_000,
    deathInstructions: 4_000,
    aiInstructionIndividual: 5_000,
    aiInstructionCombined: 20_000,
    worldLoreEntry: 4_000,
    storyStartEntry: 4_000,
    itemDescription: 4_000,
    factionBasicInfo: 4_000,
    factionHiddenInfo: 4_000,
    npcTypeDescription: 8_000,
    npcCombined: 8_000,
    regionBasicInfo: 4_000,
    regionHiddenInfo: 4_000,
    locationBasicInfo: 4_000,
    locationHiddenInfo: 4_000,
    areaDescription: 4_000,
    traitDescription: 4_000,
    abilityDescription: 2_000,
    realmBasicInfo: 100_000,
    triggerConditionQuery: 1_000,
    triggerConditionValue: 100,
    triggerEffectInstruction: 1_000,
    triggerEffectValue: 100,
  },
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function createError(path, message, severity = 'error') {
  return { path, message, severity };
}

function getJsonLength(obj) {
  // Use pretty-printing (2-space indent) to match how world configs are stored
  return JSON.stringify(obj, null, 2).length;
}

function validateRequiredFields(config, errors) {
  // Top-level required fields
  for (const field of REQUIRED_TOP_LEVEL) {
    if (config[field] === undefined) {
      errors.push(createError(field, `Missing required field: ${field}`));
    }
  }

  // worldBackground (lives at top-level in tabs/world-background.json; build.js hoists into storySettings.worldBackground)
  if (config.storySettings && config.storySettings.worldBackground === undefined && config.worldBackground === undefined) {
    errors.push(createError('worldBackground', 'Missing required field: worldBackground (top-level in tabs/world-background.json, hoisted to storySettings.worldBackground in compiled config)'));
  }

  // attributeSettings subfields
  if (config.attributeSettings) {
    for (const field of REQUIRED_ATTRIBUTE_SETTINGS) {
      if (config.attributeSettings[field] === undefined) {
        errors.push(createError(`attributeSettings.${field}`, `Missing required field: attributeSettings.${field}`));
      }
    }
  }

  // skillSettings subfields
  if (config.skillSettings) {
    for (const field of REQUIRED_SKILL_SETTINGS) {
      if (config.skillSettings[field] === undefined) {
        errors.push(createError(`skillSettings.${field}`, `Missing required field: skillSettings.${field}`));
      }
    }
  }

  // combatSettings subfields
  if (config.combatSettings) {
    for (const field of REQUIRED_COMBAT_SETTINGS) {
      if (config.combatSettings[field] === undefined) {
        errors.push(createError(`combatSettings.${field}`, `Missing required field: combatSettings.${field}`));
      }
    }
  }

  // otherSettings subfields
  if (config.otherSettings) {
    for (const field of REQUIRED_OTHER_SETTINGS) {
      if (config.otherSettings[field] === undefined) {
        errors.push(createError(`otherSettings.${field}`, `Missing required field: otherSettings.${field}`));
      }
    }
  }

  // locationSettings subfields
  if (config.locationSettings) {
    for (const field of REQUIRED_LOCATION_SETTINGS) {
      if (config.locationSettings[field] === undefined) {
        errors.push(createError(`locationSettings.${field}`, `Missing required field: locationSettings.${field}`));
      }
    }
  }

  // itemSettings subfields
  if (config.itemSettings) {
    for (const field of REQUIRED_ITEM_SETTINGS) {
      if (config.itemSettings[field] === undefined) {
        errors.push(createError(`itemSettings.${field}`, `Missing required field: itemSettings.${field}`));
      }
    }
  }

  // tipSettings subfields
  if (config.tipSettings) {
    for (const field of REQUIRED_TIP_SETTINGS) {
      if (config.tipSettings[field] === undefined) {
        errors.push(createError(`tipSettings.${field}`, `Missing required field: tipSettings.${field}`));
      }
    }
  }

  // death subfields
  if (config.death) {
    for (const field of REQUIRED_DEATH) {
      if (config.death[field] === undefined) {
        errors.push(createError(`death.${field}`, `Missing required field: death.${field}`));
      }
    }
  }

  // resourceSettings - each resource must have required fields
  // The engine matches resource keys/names case-insensitively (NFC + toLowerCase + trim).
  // Two keys or names that normalize to the same value cause silent update failures —
  // so we enforce normalize-uniqueness rather than strict-lowercase here.
  if (config.resourceSettings) {
    const normalizeText = (value) => String(value ?? '').normalize('NFC').toLowerCase().trim();
    const seenKeys = new Map();
    const seenNames = new Map();
    for (const [resourceId, resource] of Object.entries(config.resourceSettings)) {
      const normalizedId = normalizeText(resourceId);
      if (seenKeys.has(normalizedId)) {
        errors.push(createError(
          `resourceSettings.${resourceId}`,
          `Resource key "${resourceId}" normalizes to the same value as "${seenKeys.get(normalizedId)}" — engine refuses ambiguous resource updates silently`,
        ));
      } else {
        seenKeys.set(normalizedId, resourceId);
      }
      for (const field of REQUIRED_RESOURCE_FIELDS) {
        if (resource[field] === undefined) {
          errors.push(createError(`resourceSettings.${resourceId}.${field}`, `Missing required field: resourceSettings.${resourceId}.${field}`));
        }
      }
      if (resource.name) {
        const normalizedName = normalizeText(resource.name);
        if (seenNames.has(normalizedName)) {
          errors.push(createError(
            `resourceSettings.${resourceId}.name`,
            `Resource name "${resource.name}" normalizes to the same value as "${seenNames.get(normalizedName)}" — engine refuses ambiguous resource updates silently`,
          ));
        } else {
          seenNames.set(normalizedName, resource.name);
        }
      }
      // Validate color format
      if (resource.color && !/^#[0-9a-fA-F]{6}$/.test(resource.color)) {
        errors.push(createError(`resourceSettings.${resourceId}.color`, `Invalid color format (expected #RRGGBB): ${resource.color}`));
      }
    }
  }
}

function validateVersionFields(config, errors) {
  if (config.configVersion !== undefined && config.configVersion !== 'V33') {
    errors.push(createError('configVersion', `Invalid configVersion: ${config.configVersion} (expected 'V33')`));
  }

  if (config.heroesVersion !== undefined && config.heroesVersion !== 33) {
    errors.push(createError('heroesVersion', `Invalid heroesVersion: ${config.heroesVersion} (expected 33)`));
  }
}

function validateReferenceIntegrity(config, errors) {
  const locationKeys = config.locations ? new Set(Object.keys(config.locations)) : new Set();
  const regionKeys = config.regions ? new Set(Object.keys(config.regions)) : new Set();
  const realmKeys = config.realms ? new Set(Object.keys(config.realms)) : new Set();
  const factionKeys = config.factions ? new Set(Object.keys(config.factions)) : new Set();
  const npcTypeKeys = config.npcTypes ? new Set(Object.keys(config.npcTypes)) : new Set();
  const abilityKeys = config.abilities ? new Set(Object.keys(config.abilities)) : new Set();
  const skillKeys = config.skills ? new Set(Object.keys(config.skills)) : new Set();

  // Get valid item categories and slots from itemSettings
  const validCategories = new Set(config.itemSettings?.itemCategories || []);
  const validSlots = new Set((config.itemSettings?.itemSlots || []).map((s) => s.slot));

  // NPC references
  if (config.npcs) {
    for (const [npcId, npc] of Object.entries(config.npcs)) {
      // currentLocation
      if (npc.currentLocation && !locationKeys.has(npc.currentLocation)) {
        errors.push(createError(`npcs.${npcId}.currentLocation`, `References non-existent location: ${npc.currentLocation}`));
      }

      // currentArea - check if valid area in that location
      if (npc.currentLocation && npc.currentArea && config.locations?.[npc.currentLocation]) {
        const location = config.locations[npc.currentLocation];
        if (location.areas && !location.areas[npc.currentArea]) {
          errors.push(createError(`npcs.${npcId}.currentArea`, `References non-existent area '${npc.currentArea}' in location '${npc.currentLocation}'`));
        }
      }

      // faction
      if (npc.faction && !factionKeys.has(npc.faction)) {
        errors.push(createError(`npcs.${npcId}.faction`, `References non-existent faction: ${npc.faction}`));
      }

      // type
      if (npc.type && !npcTypeKeys.has(npc.type)) {
        errors.push(createError(`npcs.${npcId}.type`, `References non-existent npcType: ${npc.type}`));
      }

      // tier validation
      if (npc.tier && !VALID_NPC_TIERS.includes(npc.tier)) {
        errors.push(createError(`npcs.${npcId}.tier`, `Invalid NPC tier: ${npc.tier}. Valid values: ${VALID_NPC_TIERS.join(', ')}`));
      }
    }
  }

  // Location references
  if (config.locations) {
    for (const [locId, location] of Object.entries(config.locations)) {
      if (location.region && !regionKeys.has(location.region)) {
        errors.push(createError(`locations.${locId}.region`, `References non-existent region: ${location.region}`));
      }
    }
  }

  // Region references
  if (config.regions) {
    for (const [regionId, region] of Object.entries(config.regions)) {
      if (region.realm && !realmKeys.has(region.realm)) {
        errors.push(createError(`regions.${regionId}.realm`, `References non-existent realm: ${region.realm}`));
      }
    }
  }

  // Quest references
  if (config.quests) {
    for (const [questId, quest] of Object.entries(config.quests)) {
      if (quest.questLocation && !locationKeys.has(quest.questLocation)) {
        errors.push(createError(`quests.${questId}.questLocation`, `References non-existent location: ${quest.questLocation}`));
      }
    }
  }

  // StoryStart references
  if (config.storyStarts) {
    const storyStarts = Array.isArray(config.storyStarts) ? config.storyStarts : Object.values(config.storyStarts);
    storyStarts.forEach((start, idx) => {
      const basePath = Array.isArray(config.storyStarts) ? `storyStarts[${idx}]` : `storyStarts.${idx}`;

      // locations array
      if (start.locations && Array.isArray(start.locations)) {
        start.locations.forEach((loc, locIdx) => {
          if (!locationKeys.has(loc)) {
            errors.push(createError(`${basePath}.locations[${locIdx}]`, `References non-existent location: ${loc}`));
          }
        });
      }

      // locationAreas - validate it's an array of area name strings
      if (start.locationAreas !== undefined) {
        if (!Array.isArray(start.locationAreas)) {
          errors.push(createError(`${basePath}.locationAreas`, `Expected array of area names, got ${typeof start.locationAreas}`));
        } else {
          // Validate each area name in the array
          start.locationAreas.forEach((areaName, areaIdx) => {
            if (typeof areaName !== 'string') {
              errors.push(createError(`${basePath}.locationAreas[${areaIdx}]`, `Expected string area name, got ${typeof areaName}`));
            } else {
              // Check if this area exists in any of the story start's locations
              const startLocations = start.locations || [];
              let areaFound = false;

              for (const locName of startLocations) {
                if (config.locations && config.locations[locName]) {
                  const location = config.locations[locName];
                  if (location.areas && location.areas[areaName]) {
                    areaFound = true;
                    break;
                  }
                }
              }

              if (!areaFound && startLocations.length > 0) {
                errors.push(createError(`${basePath}.locationAreas[${areaIdx}]`, `Area "${areaName}" does not exist in any of the story start's locations: ${startLocations.join(', ')}`));
              }
            }
          });
        }
      }
    });
  }

  // Item references
  if (config.items) {
    for (const [itemId, item] of Object.entries(config.items)) {
      // category
      if (item.category && validCategories.size > 0 && !validCategories.has(item.category)) {
        errors.push(createError(`items.${itemId}.category`, `Invalid item category: ${item.category}. Valid: ${[...validCategories].join(', ')}`));
      }

      // slot
      if (item.slot && validSlots.size > 0 && !validSlots.has(item.slot)) {
        errors.push(createError(`items.${itemId}.slot`, `Invalid item slot: ${item.slot}. Valid: ${[...validSlots].join(', ')}`));
      }

      // tier
      if (item.tier && !VALID_ITEM_TIERS.includes(item.tier)) {
        errors.push(createError(`items.${itemId}.tier`, `Invalid item tier: ${item.tier}. Valid: ${VALID_ITEM_TIERS.join(', ')}`));
      }
    }
  }

  // Trait references
  if (config.traits) {
    const itemKeys = config.items ? new Set(Object.keys(config.items)) : new Set();
    const resourceKeys = config.resourceSettings ? new Set(Object.keys(config.resourceSettings)) : new Set();
    const attributeNames = config.attributeSettings?.attributeNames
      ? new Set(config.attributeSettings.attributeNames.map(a => a.toLowerCase()))
      : new Set();

    for (const [traitId, trait] of Object.entries(config.traits)) {
      // abilities
      if (trait.abilities && Array.isArray(trait.abilities)) {
        trait.abilities.forEach((abilityId, idx) => {
          if (!abilityKeys.has(abilityId)) {
            errors.push(createError(`traits.${traitId}.abilities[${idx}]`, `References non-existent ability: ${abilityId}`));
          }
        });
      }

      // skills - validate skill references and format
      if (trait.skills && Array.isArray(trait.skills)) {
        trait.skills.forEach((skillRef, idx) => {
          // Skills must be objects with { skill: string, modifier: number }
          if (typeof skillRef === 'string') {
            errors.push(createError(`traits.${traitId}.skills[${idx}]`, `Expecting { skill: string, modifier: number } but instead got: "${skillRef}"`));
          } else if (typeof skillRef === 'object' && skillRef !== null) {
            if (skillRef.skill === undefined) {
              errors.push(createError(`traits.${traitId}.skills[${idx}].skill`, 'Missing required field: skill'));
            } else if (typeof skillRef.skill !== 'string') {
              errors.push(createError(`traits.${traitId}.skills[${idx}].skill`, `Expected string, got ${typeof skillRef.skill}`));
            } else if (!skillKeys.has(skillRef.skill)) {
              errors.push(createError(`traits.${traitId}.skills[${idx}]`, `References non-existent skill: ${skillRef.skill}`));
            }
            if (skillRef.modifier === undefined) {
              errors.push(createError(`traits.${traitId}.skills[${idx}].modifier`, 'Missing required field: modifier'));
            } else if (typeof skillRef.modifier !== 'number') {
              errors.push(createError(`traits.${traitId}.skills[${idx}].modifier`, `Expected number, got ${typeof skillRef.modifier}`));
            }
          } else {
            errors.push(createError(`traits.${traitId}.skills[${idx}]`, `Expected object with { skill: string, modifier: number }, got ${typeof skillRef}`));
          }
        });
      }

      // attributes - validate attribute references
      if (trait.attributes && Array.isArray(trait.attributes)) {
        trait.attributes.forEach((attrRef, idx) => {
          const attrName = typeof attrRef === 'string' ? attrRef : attrRef?.attribute;
          if (attrName && !attributeNames.has(attrName.toLowerCase())) {
            errors.push(createError(`traits.${traitId}.attributes[${idx}]`, `References non-existent attribute: ${attrName}. Valid: ${config.attributeSettings?.attributeNames?.join(', ') || 'none'}`));
          }
        });
      }

      // resources - validate resource references
      if (trait.resources && Array.isArray(trait.resources)) {
        trait.resources.forEach((resRef, idx) => {
          const resName = typeof resRef === 'string' ? resRef : resRef?.resource;
          if (resName && !resourceKeys.has(resName)) {
            errors.push(createError(`traits.${traitId}.resources[${idx}]`, `References non-existent resource: ${resName}. Valid: ${[...resourceKeys].join(', ') || 'none'}`));
          }
        });
      }

      // startingItems - validate item references and format
      if (trait.startingItems && Array.isArray(trait.startingItems)) {
        trait.startingItems.forEach((itemRef, idx) => {
          // Starting items must be objects with { item: string, quantity: number }
          if (typeof itemRef === 'string') {
            errors.push(createError(`traits.${traitId}.startingItems[${idx}]`, `Expecting { item: string, quantity: number } but instead got: "${itemRef}"`));
          } else if (typeof itemRef === 'object' && itemRef !== null) {
            if (itemRef.item === undefined) {
              errors.push(createError(`traits.${traitId}.startingItems[${idx}].item`, 'Missing required field: item'));
            } else if (typeof itemRef.item !== 'string') {
              errors.push(createError(`traits.${traitId}.startingItems[${idx}].item`, `Expected string, got ${typeof itemRef.item}`));
            } else if (!itemKeys.has(itemRef.item)) {
              errors.push(createError(`traits.${traitId}.startingItems[${idx}]`, `References non-existent item: ${itemRef.item}`));
            }
            if (itemRef.quantity === undefined) {
              errors.push(createError(`traits.${traitId}.startingItems[${idx}].quantity`, 'Missing required field: quantity'));
            } else if (typeof itemRef.quantity !== 'number') {
              errors.push(createError(`traits.${traitId}.startingItems[${idx}].quantity`, `Expected number, got ${typeof itemRef.quantity}`));
            }
          } else {
            errors.push(createError(`traits.${traitId}.startingItems[${idx}]`, `Expected object with { item: string, quantity: number }, got ${typeof itemRef}`));
          }
        });
      }
    }
  }

  // Skill validation (type, attribute, and required fields)
  if (config.skills) {
    const validSkillTypes = config.skillSettings?.skillTypeDifficultyBonus
      ? new Set(Object.keys(config.skillSettings.skillTypeDifficultyBonus))
      : null;
    const attributeNames = config.attributeSettings?.attributeNames
      ? new Set(config.attributeSettings.attributeNames.map(a => a.toLowerCase()))
      : new Set();

    for (const [skillId, skill] of Object.entries(config.skills)) {
      // Validate skill type
      if (validSkillTypes && skill.type && !validSkillTypes.has(skill.type)) {
        errors.push(createError(`skills.${skillId}.type`, `Invalid skill type: ${skill.type}. Valid: ${Array.from(validSkillTypes).join(', ')}`));
      }

      // Validate skill attribute
      if (skill.attribute && !attributeNames.has(skill.attribute.toLowerCase())) {
        errors.push(createError(`skills.${skillId}.attribute`, `References non-existent attribute: ${skill.attribute}. Valid: ${config.attributeSettings?.attributeNames?.join(', ') || 'none'}`));
      }

      // Validate startingItems is present (required field, can be empty array)
      if (skill.startingItems === undefined) {
        errors.push(createError(`skills.${skillId}.startingItems`, 'Missing required field: startingItems (use empty array [] if none)'));
      } else if (!Array.isArray(skill.startingItems)) {
        errors.push(createError(`skills.${skillId}.startingItems`, `Expected array, got ${typeof skill.startingItems}`));
      }
    }
  }

  // Ability requirement reference validation and schema validation
  // Schema (strict format):
  //   type: 'resource' | 'attribute' | 'skill' | 'characterLevel' | 'trait'
  //   variable: string (REQUIRED for all types)
  //   amount: number (REQUIRED for all types)
  // Note: both variable and amount are required on ALL requirement types
  if (config.abilities) {
    const traitKeys = config.traits ? new Set(Object.keys(config.traits)) : new Set();
    const resourceKeys = config.resourceSettings ? new Set(Object.keys(config.resourceSettings)) : new Set();
    const attributeNames = config.attributeSettings?.attributeNames
      ? new Set(config.attributeSettings.attributeNames.map(a => a.toLowerCase()))
      : new Set();

    // Valid requirement types
    const VALID_REQUIREMENT_TYPES = ['skill', 'trait', 'resource', 'attribute', 'characterLevel'];

    for (const [abilityId, ability] of Object.entries(config.abilities)) {
      if (ability.requirements && Array.isArray(ability.requirements)) {
        ability.requirements.forEach((req, idx) => {
          const reqPath = `abilities.${abilityId}.requirements[${idx}]`;

          // Validate requirement type
          if (!req.type) {
            errors.push(createError(`${reqPath}.type`, 'Missing required field: type'));
          } else if (!VALID_REQUIREMENT_TYPES.includes(req.type)) {
            errors.push(createError(`${reqPath}.type`, `Invalid requirement type: ${req.type}. Valid: ${VALID_REQUIREMENT_TYPES.join(', ')}`));
          }

          // All requirement types require both variable and amount
          if (req.variable === undefined) {
            errors.push(createError(`${reqPath}.variable`, 'Missing required field: variable'));
          }
          if (req.amount === undefined) {
            errors.push(createError(`${reqPath}.amount`, 'Missing required field: amount'));
          }

          // Additional validation based on requirement type (reference checks)
          if (req.type === 'skill' && req.variable !== undefined) {
            if (!skillKeys.has(req.variable)) {
              errors.push(createError(`${reqPath}.variable`, `References non-existent skill: ${req.variable}`));
            }
          } else if (req.type === 'trait' && req.variable !== undefined) {
            if (!traitKeys.has(req.variable)) {
              errors.push(createError(`${reqPath}.variable`, `References non-existent trait: ${req.variable}`));
            }
          } else if (req.type === 'resource' && req.variable !== undefined) {
            if (!resourceKeys.has(req.variable)) {
              errors.push(createError(`${reqPath}.variable`, `References non-existent resource: ${req.variable}. Valid: ${[...resourceKeys].join(', ')}`));
            }
          } else if (req.type === 'attribute' && req.variable !== undefined) {
            if (!attributeNames.has(req.variable.toLowerCase())) {
              errors.push(createError(`${reqPath}.variable`, `References non-existent attribute: ${req.variable}. Valid: ${config.attributeSettings?.attributeNames?.join(', ') || 'none'}`));
            }
          }
        });
      }
    }
  }

  // Item bonus validation
  if (config.items) {
    const attributeNames = config.attributeSettings?.attributeNames
      ? new Set(config.attributeSettings.attributeNames.map(a => a.toLowerCase()))
      : new Set();
    const resourceKeys = config.resourceSettings ? new Set(Object.keys(config.resourceSettings)) : new Set();
    const validBonusTypes = ['attribute', 'stat', 'resource', 'skill'];
    const validStatVariables = ['damage', 'armor', 'speed', 'health']; // common stat variables

    for (const [itemId, item] of Object.entries(config.items)) {
      if (item.bonuses && Array.isArray(item.bonuses)) {
        item.bonuses.forEach((bonus, idx) => {
          const bonusPath = `items.${itemId}.bonuses[${idx}]`;

          if (!bonus.type) {
            errors.push(createError(`${bonusPath}.type`, 'Missing required field: type'));
          } else if (!validBonusTypes.includes(bonus.type)) {
            errors.push(createError(`${bonusPath}.type`, `Invalid bonus type: ${bonus.type}. Valid: ${validBonusTypes.join(', ')}`));
          }

          if (bonus.variable === undefined) {
            errors.push(createError(`${bonusPath}.variable`, 'Missing required field: variable'));
          } else {
            // Validate variable based on bonus type
            if (bonus.type === 'attribute') {
              if (!attributeNames.has(bonus.variable.toLowerCase())) {
                errors.push(createError(`${bonusPath}.variable`, `Invalid attribute: ${bonus.variable}. Valid: ${config.attributeSettings?.attributeNames?.join(', ') || 'none'}`, 'warning'));
              }
            } else if (bonus.type === 'resource') {
              if (!resourceKeys.has(bonus.variable)) {
                errors.push(createError(`${bonusPath}.variable`, `Invalid resource: ${bonus.variable}. Valid: ${[...resourceKeys].join(', ') || 'none'}`, 'warning'));
              }
            } else if (bonus.type === 'stat') {
              // For stat type, we just warn about potentially invalid variables
              if (!validStatVariables.includes(bonus.variable.toLowerCase())) {
                errors.push(createError(`${bonusPath}.variable`, `Invalid variable "${bonus.variable}" - common stat variables are: ${validStatVariables.join(', ')}`, 'warning'));
              }
            }
          }

          if (bonus.value === undefined) {
            errors.push(createError(`${bonusPath}.value`, 'Missing required field: value'));
          } else if (typeof bonus.value !== 'number') {
            errors.push(createError(`${bonusPath}.value`, `Expected number, got ${typeof bonus.value}`));
          }
        });
      }
    }
  }
}

function validateTriggers(config, errors) {
  if (!config.triggers) return;

  const isArrayForm = Array.isArray(config.triggers);
  const triggerEntries = isArrayForm
    ? config.triggers.map((t, i) => [i, t])
    : Object.entries(config.triggers);

  triggerEntries.forEach(([key, trigger], idx) => {
    const basePath = isArrayForm ? `triggers[${idx}]` : `triggers.${key}`;

    // Name must match object key (engine re-fires non-recurring triggers when mismatched)
    if (!isArrayForm && typeof trigger.name === 'string' && trigger.name !== key) {
      errors.push(createError(`${basePath}.name`, `Trigger name "${trigger.name}" does not match key "${key}"`));
    }

    // Validate individual trigger size
    const triggerSize = JSON.stringify(trigger).length;
    if (triggerSize > LIMITS.counts.triggerSize) {
      errors.push(createError(basePath, `Trigger exceeds ${LIMITS.counts.triggerSize} chars: ${triggerSize}`));
    }

    // Validate conditions
    if (trigger.conditions) {
      if (trigger.conditions.length > LIMITS.counts.triggerConditions) {
        errors.push(createError(`${basePath}.conditions`, `Too many conditions: ${trigger.conditions.length} (max: ${LIMITS.counts.triggerConditions})`));
      }

      trigger.conditions.forEach((cond, condIdx) => {
        const condPath = `${basePath}.conditions[${condIdx}]`;

        // Type validation
        if (cond.type && !VALID_TRIGGER_CONDITION_TYPES.includes(cond.type)) {
          errors.push(createError(`${condPath}.type`, `Invalid condition type: ${cond.type}. Valid: ${VALID_TRIGGER_CONDITION_TYPES.join(', ')}`));
        }

        // Query length
        if (cond.query && cond.query.length > LIMITS.fields.triggerConditionQuery) {
          errors.push(createError(`${condPath}.query`, `Query too long: ${cond.query.length} chars (max: ${LIMITS.fields.triggerConditionQuery})`));
        }

        // Value length (if string)
        if (cond.value && typeof cond.value === 'string' && cond.value.length > LIMITS.fields.triggerConditionValue) {
          errors.push(createError(`${condPath}.value`, `Value too long: ${cond.value.length} chars (max: ${LIMITS.fields.triggerConditionValue})`));
        }

        // Operator validation based on condition type
        if (cond.operator) {
          const isStringCondition = ['story-text', 'action-text', 'party-realm', 'party-region', 'party-location', 'party-area', 'read-string'].includes(cond.type);
          const isNumberCondition = ['player-level', 'game-tick', 'player-resource', 'read-number'].includes(cond.type);
          const isBooleanCondition = ['read-boolean'].includes(cond.type);
          const isArrayCondition = ['player-traits', 'quests-completed', 'read-array'].includes(cond.type);

          if (isStringCondition && !VALID_STRING_OPERATORS.includes(cond.operator)) {
            errors.push(createError(`${condPath}.operator`, `Invalid operator for string condition: ${cond.operator}`));
          } else if (isNumberCondition && !VALID_NUMBER_OPERATORS.includes(cond.operator)) {
            errors.push(createError(`${condPath}.operator`, `Invalid operator for number condition: ${cond.operator}`));
          } else if (isBooleanCondition && !VALID_BOOLEAN_OPERATORS.includes(cond.operator)) {
            errors.push(createError(`${condPath}.operator`, `Invalid operator for boolean condition: ${cond.operator}`));
          } else if (isArrayCondition && !VALID_ARRAY_OPERATORS.includes(cond.operator)) {
            errors.push(createError(`${condPath}.operator`, `Invalid operator for array condition: ${cond.operator}`));
          }
        }
      });
    }

    // Validate effects
    if (trigger.effects) {
      if (trigger.effects.length > LIMITS.counts.triggerEffects) {
        errors.push(createError(`${basePath}.effects`, `Too many effects: ${trigger.effects.length} (max: ${LIMITS.counts.triggerEffects})`));
      }

      trigger.effects.forEach((effect, effectIdx) => {
        const effectPath = `${basePath}.effects[${effectIdx}]`;

        // Type validation
        if (effect.type && !VALID_TRIGGER_EFFECT_TYPES.includes(effect.type)) {
          errors.push(createError(`${effectPath}.type`, `Invalid effect type: ${effect.type}. Valid: ${VALID_TRIGGER_EFFECT_TYPES.join(', ')}`));
        }

        // Instruction length
        if (effect.instruction && effect.instruction.length > LIMITS.fields.triggerEffectInstruction) {
          errors.push(createError(`${effectPath}.instruction`, `Instruction too long: ${effect.instruction.length} chars (max: ${LIMITS.fields.triggerEffectInstruction})`));
        }

        // Value length (if string)
        if (effect.value && typeof effect.value === 'string' && effect.value.length > LIMITS.fields.triggerEffectValue) {
          errors.push(createError(`${effectPath}.value`, `Value too long: ${effect.value.length} chars (max: ${LIMITS.fields.triggerEffectValue})`));
        }

        // Operator validation for write effects
        if (effect.operator) {
          const isNumberEffect = ['player-resource', 'write-number'].includes(effect.type);
          const isBooleanEffect = ['write-boolean'].includes(effect.type);
          const isArrayEffect = ['write-array'].includes(effect.type);

          if (isNumberEffect && !VALID_NUMBER_EFFECT_OPERATORS.includes(effect.operator)) {
            errors.push(createError(`${effectPath}.operator`, `Invalid operator for number effect: ${effect.operator}`));
          } else if (isBooleanEffect && !VALID_BOOLEAN_EFFECT_OPERATORS.includes(effect.operator)) {
            errors.push(createError(`${effectPath}.operator`, `Invalid operator for boolean effect: ${effect.operator}`));
          } else if (isArrayEffect && !VALID_ARRAY_EFFECT_OPERATORS.includes(effect.operator)) {
            errors.push(createError(`${effectPath}.operator`, `Invalid operator for array effect: ${effect.operator}`));
          }
        }

        // Effects that require operator: "set" (party-location, party-area, party-region, party-realm)
        const effectsRequiringSetOperator = ['party-location', 'party-area', 'party-region', 'party-realm'];
        if (effectsRequiringSetOperator.includes(effect.type)) {
          if (effect.operator === undefined) {
            errors.push(createError(`${effectPath}.operator`, `Missing required operator: "set" for ${effect.type} effect`));
          } else if (effect.operator !== 'set') {
            errors.push(createError(`${effectPath}.operator`, `Invalid operator "${effect.operator}" for ${effect.type} effect (must be "set")`));
          }
        }
      });
    }
  });
}

function validateDamageTypes(config, errors) {
  // Use world's damage types if defined, otherwise fall back to engine defaults
  const validDamageTypes = config.combatSettings?.damageTypes ?? DEFAULT_DAMAGE_TYPES;

  // Check NPC damage types (vulnerabilities, resistances, immunities)
  if (config.npcs) {
    for (const [npcId, npc] of Object.entries(config.npcs)) {
      const checkDamageArray = (field) => {
        if (npc[field] && Array.isArray(npc[field])) {
          npc[field].forEach((type, idx) => {
            if (!validDamageTypes.includes(type)) {
              errors.push(createError(`npcs.${npcId}.${field}[${idx}]`, `Invalid damage type: ${type}. Valid: ${validDamageTypes.join(', ')}`));
            }
          });
        }
      };

      checkDamageArray('vulnerabilities');
      checkDamageArray('resistances');
      checkDamageArray('immunities');
    }
  }
}

function validateCharacterLimits(config, errors, warnings) {
  // Total config size
  const totalSize = getJsonLength(config);
  if (totalSize > LIMITS.total) {
    errors.push(createError('(total)', `Config too large: ${totalSize.toLocaleString()} chars (max: ${LIMITS.total.toLocaleString()})`));
  }

  // Section limits
  for (const [section, limit] of Object.entries(LIMITS.sections)) {
    if (config[section]) {
      const size = getJsonLength(config[section]);
      if (size > limit) {
        errors.push(createError(section, `Section too large: ${size.toLocaleString()} chars (max: ${limit.toLocaleString()})`));
      }
    }
  }

  // Count limits
  if (config.storyStarts) {
    const count = Array.isArray(config.storyStarts) ? config.storyStarts.length : Object.keys(config.storyStarts).length;
    if (count > LIMITS.counts.storyStarts) {
      errors.push(createError('storyStarts', `Too many story starts: ${count} (max: ${LIMITS.counts.storyStarts})`));
    }
  }

  if (config.triggers) {
    const triggers = Array.isArray(config.triggers) ? config.triggers : Object.values(config.triggers);
    const hasSemantic = (trigger) =>
      trigger.conditions && trigger.conditions.some((c) => c.type === 'story' || c.type === 'action');
    let semanticCount = 0;
    let mechanicalCount = 0;
    for (const trigger of triggers) {
      if (hasSemantic(trigger)) semanticCount++;
      else mechanicalCount++;
    }
    if (semanticCount > LIMITS.counts.semanticTriggers) {
      errors.push(createError('triggers', `Too many semantic triggers: ${semanticCount} (max: ${LIMITS.counts.semanticTriggers})`));
    }
    if (mechanicalCount > LIMITS.counts.mechanicalTriggers) {
      errors.push(createError('triggers', `Too many mechanical triggers: ${mechanicalCount} (max: ${LIMITS.counts.mechanicalTriggers})`));
    }
  }

  if (config.abilities) {
    const count = Object.keys(config.abilities).length;
    if (count > LIMITS.counts.abilities) {
      errors.push(createError('abilities', `Too many abilities: ${count} (max: ${LIMITS.counts.abilities})`));
    }
  }

  // Field limits
  if (config.storySettings?.worldBackground?.length > LIMITS.fields.worldBackground) {
    errors.push(createError('storySettings.worldBackground', `Too long: ${config.storySettings.worldBackground.length} chars (max: ${LIMITS.fields.worldBackground})`));
  }

  if (config.storySettings?.questGenerationGuidance?.length > LIMITS.fields.questGenerationGuidance) {
    errors.push(createError('storySettings.questGenerationGuidance', `Too long: ${config.storySettings.questGenerationGuidance.length} chars (max: ${LIMITS.fields.questGenerationGuidance})`));
  }

  if (config.narratorStyle?.length > LIMITS.fields.narratorStyle) {
    errors.push(createError('narratorStyle', `Too long: ${config.narratorStyle.length} chars (max: ${LIMITS.fields.narratorStyle})`));
  }

  if (config.death?.instructions?.length > LIMITS.fields.deathInstructions) {
    errors.push(createError('death.instructions', `Too long: ${config.death.instructions.length} chars (max: ${LIMITS.fields.deathInstructions})`));
  }

  // AI instruction limits
  if (config.aiInstructions) {
    let combinedTotal = 0;
    for (const [taskId, instructions] of Object.entries(config.aiInstructions)) {
      if (Array.isArray(instructions)) {
        instructions.forEach((instr, idx) => {
          const text = typeof instr === 'string' ? instr : instr?.instruction;
          if (text) {
            combinedTotal += text.length;
            if (text.length > LIMITS.fields.aiInstructionIndividual) {
              errors.push(createError(`aiInstructions.${taskId}[${idx}]`, `Instruction too long: ${text.length} chars (max: ${LIMITS.fields.aiInstructionIndividual})`));
            }
          }
        });
      }
    }
    if (combinedTotal > LIMITS.fields.aiInstructionCombined) {
      errors.push(createError('aiInstructions', `Combined AI instructions too long: ${combinedTotal} chars (max: ${LIMITS.fields.aiInstructionCombined})`));
    }
  }

  // Entry-level checks
  const checkEntryField = (section, entries, fieldName, limit, isArray = false) => {
    if (!entries) return;
    const items = isArray ? entries : Object.entries(entries);

    for (const item of items) {
      const [id, entry] = isArray ? [items.indexOf(item), item] : item;
      if (entry?.[fieldName] && entry[fieldName].length > limit) {
        const path = isArray ? `${section}[${id}].${fieldName}` : `${section}.${id}.${fieldName}`;
        errors.push(createError(path, `Too long: ${entry[fieldName].length} chars (max: ${limit})`));
      }
    }
  };

  // worldLore entries
  if (config.worldLore) {
    for (const [id, entry] of Object.entries(config.worldLore)) {
      if (entry?.text?.length > LIMITS.fields.worldLoreEntry) {
        errors.push(createError(`worldLore.${id}.text`, `Too long: ${entry.text.length} chars (max: ${LIMITS.fields.worldLoreEntry})`));
      }
    }
  }

  // NPC combined size
  if (config.npcs) {
    for (const [npcId, npc] of Object.entries(config.npcs)) {
      const size = getJsonLength(npc);
      if (size > LIMITS.fields.npcCombined) {
        errors.push(createError(`npcs.${npcId}`, `NPC too large: ${size} chars (max: ${LIMITS.fields.npcCombined})`));
      }
    }
  }

  checkEntryField('items', config.items, 'description', LIMITS.fields.itemDescription);
  checkEntryField('factions', config.factions, 'basicInfo', LIMITS.fields.factionBasicInfo);
  checkEntryField('factions', config.factions, 'hiddenInfo', LIMITS.fields.factionHiddenInfo);
  checkEntryField('npcTypes', config.npcTypes, 'description', LIMITS.fields.npcTypeDescription);
  checkEntryField('regions', config.regions, 'basicInfo', LIMITS.fields.regionBasicInfo);
  checkEntryField('regions', config.regions, 'hiddenInfo', LIMITS.fields.regionHiddenInfo);
  checkEntryField('locations', config.locations, 'basicInfo', LIMITS.fields.locationBasicInfo);
  checkEntryField('locations', config.locations, 'hiddenInfo', LIMITS.fields.locationHiddenInfo);
  checkEntryField('traits', config.traits, 'description', LIMITS.fields.traitDescription);
  checkEntryField('abilities', config.abilities, 'description', LIMITS.fields.abilityDescription);

  // Realm basicInfo
  if (config.realms) {
    for (const [realmId, realm] of Object.entries(config.realms)) {
      if (realm.basicInfo?.length > LIMITS.fields.realmBasicInfo) {
        errors.push(createError(`realms.${realmId}.basicInfo`, `Too long: ${realm.basicInfo.length} chars (max: ${LIMITS.fields.realmBasicInfo})`));
      }
    }
  }

  // Location areas
  if (config.locations) {
    const locationKeys = new Set(Object.keys(config.locations));
    for (const [locId, location] of Object.entries(config.locations)) {
      if (location.areas) {
        const areaKeys = new Set(Object.keys(location.areas));
        for (const [areaId, area] of Object.entries(location.areas)) {
          if (area.description?.length > LIMITS.fields.areaDescription) {
            errors.push(createError(`locations.${locId}.areas.${areaId}.description`, `Too long: ${area.description.length} chars (max: ${LIMITS.fields.areaDescription})`));
          }
          // Validate paths only reference areas within same location, not other locations
          if (area.paths && Array.isArray(area.paths)) {
            for (const pathTarget of area.paths) {
              if (locationKeys.has(pathTarget)) {
                errors.push(createError(`locations.${locId}.areas.${areaId}.paths`, `Invalid path "${pathTarget}" - paths must reference areas within the same location, not other locations`));
              } else if (!areaKeys.has(pathTarget)) {
                errors.push(createError(`locations.${locId}.areas.${areaId}.paths`, `Invalid path "${pathTarget}" - area does not exist in this location`));
              }
            }
          }
        }
      }
    }
  }


  // Ability requirements count
  if (config.abilities) {
    for (const [abilityId, ability] of Object.entries(config.abilities)) {
      if (ability.requirements?.length > LIMITS.counts.abilityRequirements) {
        errors.push(createError(`abilities.${abilityId}.requirements`, `Too many requirements: ${ability.requirements.length} (max: ${LIMITS.counts.abilityRequirements})`));
      }
    }
  }
}

function validateTypeChecks(config, errors) {
  // Basic type checks for settings fields

  const checkNumber = (path, value) => {
    if (value !== undefined && typeof value !== 'number') {
      errors.push(createError(path, `Expected number, got ${typeof value}`));
    }
  };

  const checkString = (path, value) => {
    if (value !== undefined && typeof value !== 'string') {
      errors.push(createError(path, `Expected string, got ${typeof value}`));
    }
  };

  const checkBoolean = (path, value) => {
    if (value !== undefined && typeof value !== 'boolean') {
      errors.push(createError(path, `Expected boolean, got ${typeof value}`));
    }
  };

  const checkArray = (path, value) => {
    if (value !== undefined && !Array.isArray(value)) {
      errors.push(createError(path, `Expected array, got ${typeof value}`));
    }
  };

  const checkObject = (path, value) => {
    if (value !== undefined && (typeof value !== 'object' || value === null || Array.isArray(value))) {
      errors.push(createError(path, `Expected object, got ${Array.isArray(value) ? 'array' : typeof value}`));
    }
  };

  // attributeSettings
  if (config.attributeSettings) {
    const as = config.attributeSettings;
    checkArray('attributeSettings.attributeNames', as.attributeNames);
    checkNumber('attributeSettings.startingAttributeValue', as.startingAttributeValue);
    checkNumber('attributeSettings.startingAttributePoints', as.startingAttributePoints);
    checkObject('attributeSettings.attributeStatModifiers', as.attributeStatModifiers);
    checkNumber('attributeSettings.maxStartingAttribute', as.maxStartingAttribute);
    checkNumber('attributeSettings.lowAttributeThreshold', as.lowAttributeThreshold);
    checkObject('attributeSettings.lowAttributeTraits', as.lowAttributeTraits);
    checkNumber('attributeSettings.attributeBonusModifier', as.attributeBonusModifier);

    // Validate attributeStatModifiers structure
    // Strict format: { "Attribute": { variable: "resourceName", amount: number } }
    // String format is NOT accepted
    if (as.attributeStatModifiers && typeof as.attributeStatModifiers === 'object') {
      const validAttributeNames = as.attributeNames ? new Set(as.attributeNames.map(a => a.toLowerCase())) : new Set();
      const validResources = config.resourceSettings ? Object.keys(config.resourceSettings) : [];

      for (const [attrId, modifier] of Object.entries(as.attributeStatModifiers)) {
        // Check that the attribute name is valid
        if (!validAttributeNames.has(attrId.toLowerCase())) {
          errors.push(createError(
            `attributeSettings.attributeStatModifiers.${attrId}`,
            `Invalid attribute "${attrId}" - must be one of: ${as.attributeNames?.join(', ') || 'none'}`
          ));
        }

        if (typeof modifier === 'string') {
          // String format is NOT valid - must be object { variable, amount }
          errors.push(createError(
            `attributeSettings.attributeStatModifiers.${attrId}`,
            `Expected { variable: string, amount: number } but got string "${modifier}"`
          ));
        } else if (modifier && typeof modifier === 'object') {
          // Required format: { variable, amount }
          if (modifier.amount === undefined) {
            errors.push(createError(`attributeSettings.attributeStatModifiers.${attrId}.amount`, 'Missing required field: amount'));
          } else {
            checkNumber(`attributeSettings.attributeStatModifiers.${attrId}.amount`, modifier.amount);
          }
          if (modifier.variable === undefined) {
            errors.push(createError(`attributeSettings.attributeStatModifiers.${attrId}.variable`, 'Missing required field: variable'));
          } else {
            checkString(`attributeSettings.attributeStatModifiers.${attrId}.variable`, modifier.variable);
            // Validate that variable references a valid resourceSettings key
            if (typeof modifier.variable === 'string' && config.resourceSettings) {
              if (!validResources.includes(modifier.variable.toLowerCase())) {
                errors.push(createError(
                  `attributeSettings.attributeStatModifiers.${attrId}.variable`,
                  `Invalid variable "${modifier.variable}" - must reference a valid resourceSettings key. Valid options: ${validResources.join(', ')}`
                ));
              }
            }
          }
        } else {
          errors.push(createError(
            `attributeSettings.attributeStatModifiers.${attrId}`,
            `Expected { variable: string, amount: number } but got ${typeof modifier}`
          ));
        }
      }
    }
  }

  // skillSettings
  if (config.skillSettings) {
    const ss = config.skillSettings;
    checkNumber('skillSettings.trainingCooldown', ss.trainingCooldown);
    checkObject('skillSettings.skillXPRewards', ss.skillXPRewards);
    checkNumber('skillSettings.skillBonusModifier', ss.skillBonusModifier);
    checkNumber('skillSettings.xpFromNewSkill', ss.xpFromNewSkill);
    checkNumber('skillSettings.maxSkillLevel', ss.maxSkillLevel);
    checkNumber('skillSettings.charXPPerSkillLevel', ss.charXPPerSkillLevel);
    checkNumber('skillSettings.baseXPFromSkillUpgrade', ss.baseXPFromSkillUpgrade);
    checkNumber('skillSettings.additionalXPRequiredPerSkillLevel', ss.additionalXPRequiredPerSkillLevel);
    checkNumber('skillSettings.startingXPToLevelUpSkill', ss.startingXPToLevelUpSkill);
    checkNumber('skillSettings.baseChanceToLearnNewSkill', ss.baseChanceToLearnNewSkill);
    checkNumber('skillSettings.skillLearningBonusModifier', ss.skillLearningBonusModifier);
    checkObject('skillSettings.skillTypeDifficultyBonus', ss.skillTypeDifficultyBonus);
  }

  // combatSettings
  if (config.combatSettings) {
    const cs = config.combatSettings;
    checkNumber('combatSettings.minCombatXP', cs.minCombatXP);
    checkNumber('combatSettings.baseCombatXP', cs.baseCombatXP);
    checkNumber('combatSettings.abilityCooldown', cs.abilityCooldown);
    checkNumber('combatSettings.abilityBonus', cs.abilityBonus);
    checkNumber('combatSettings.npcDailyHealingAmount', cs.npcDailyHealingAmount);
    checkArray('combatSettings.damageTypes', cs.damageTypes);
  }

  // otherSettings
  if (config.otherSettings) {
    const os = config.otherSettings;
    checkNumber('otherSettings.startingCharacterLevelUpRequirement', os.startingCharacterLevelUpRequirement);
    checkNumber('otherSettings.extraRequiredXPPerCharacterLevel', os.extraRequiredXPPerCharacterLevel);
    checkNumber('otherSettings.maxCharacterLevel', os.maxCharacterLevel);
    checkNumber('otherSettings.npcHealthPerLevel', os.npcHealthPerLevel);
    checkNumber('otherSettings.npcMinHealth', os.npcMinHealth);
  }

  // locationSettings
  if (config.locationSettings) {
    const ls = config.locationSettings;
    checkNumber('locationSettings.regionSize', ls.regionSize);
    checkNumber('locationSettings.simpleRadius', ls.simpleRadius);
    checkNumber('locationSettings.complexRadius', ls.complexRadius);
    checkNumber('locationSettings.regionLocationCount', ls.regionLocationCount);
    checkNumber('locationSettings.regionFactionCount', ls.regionFactionCount);
    checkNumber('locationSettings.avgTravelDistance', ls.avgTravelDistance);
    checkNumber('locationSettings.minTravelDistance', ls.minTravelDistance);
  }

  // itemSettings
  if (config.itemSettings) {
    const is = config.itemSettings;
    checkString('itemSettings.currencyName', is.currencyName);
    checkArray('itemSettings.itemCategories', is.itemCategories);
    checkArray('itemSettings.itemSlots', is.itemSlots);
    checkArray('itemSettings.startingItems', is.startingItems);

    // Validate itemSlots structure
    if (is.itemSlots && Array.isArray(is.itemSlots)) {
      is.itemSlots.forEach((slot, idx) => {
        if (slot.slot === undefined) {
          errors.push(createError(`itemSettings.itemSlots[${idx}].slot`, 'Missing required field: slot'));
        }
        if (slot.category === undefined) {
          errors.push(createError(`itemSettings.itemSlots[${idx}].category`, 'Missing required field: category'));
        }
        if (slot.quantity === undefined) {
          errors.push(createError(`itemSettings.itemSlots[${idx}].quantity`, 'Missing required field: quantity'));
        }
      });
    }
  }

  // tipSettings
  if (config.tipSettings) {
    const ts = config.tipSettings;
    checkArray('tipSettings.tips', ts.tips);
    checkBoolean('tipSettings.tipDisplayEnabled', ts.tipDisplayEnabled);
    checkNumber('tipSettings.tipTurnInterval', ts.tipTurnInterval);
    checkNumber('tipSettings.tipMinimumTurns', ts.tipMinimumTurns);
    checkNumber('tipSettings.tipMaximumTurns', ts.tipMaximumTurns);
  }

  // death
  if (config.death) {
    checkBoolean('death.permadeath', config.death.permadeath);
    checkString('death.instructions', config.death.instructions);
  }

  // resourceSettings
  if (config.resourceSettings) {
    for (const [resourceId, resource] of Object.entries(config.resourceSettings)) {
      checkString(`resourceSettings.${resourceId}.name`, resource.name);
      checkNumber(`resourceSettings.${resourceId}.initialValue`, resource.initialValue);
      checkNumber(`resourceSettings.${resourceId}.maxValue`, resource.maxValue);
      checkNumber(`resourceSettings.${resourceId}.rechargeRate`, resource.rechargeRate);
      checkNumber(`resourceSettings.${resourceId}.restRechargeMultiplier`, resource.restRechargeMultiplier);
      checkNumber(`resourceSettings.${resourceId}.gainPerLevel`, resource.gainPerLevel);
      checkString(`resourceSettings.${resourceId}.color`, resource.color);
    }
  }

  // npcTypes - require immunities, resistances, vulnerabilities as arrays (can be empty)
  if (config.npcTypes) {
    for (const [typeId, npcType] of Object.entries(config.npcTypes)) {
      if (npcType.immunities === undefined) {
        errors.push(createError(`npcTypes.${typeId}.immunities`, 'Missing required field: immunities (use empty array [] if none)'));
      } else {
        checkArray(`npcTypes.${typeId}.immunities`, npcType.immunities);
      }
      if (npcType.resistances === undefined) {
        errors.push(createError(`npcTypes.${typeId}.resistances`, 'Missing required field: resistances (use empty array [] if none)'));
      } else {
        checkArray(`npcTypes.${typeId}.resistances`, npcType.resistances);
      }
      if (npcType.vulnerabilities === undefined) {
        errors.push(createError(`npcTypes.${typeId}.vulnerabilities`, 'Missing required field: vulnerabilities (use empty array [] if none)'));
      } else {
        checkArray(`npcTypes.${typeId}.vulnerabilities`, npcType.vulnerabilities);
      }
    }
  }

  // traits - require unlockedBy and excludedBy as arrays (can be empty)
  if (config.traits) {
    for (const [traitId, trait] of Object.entries(config.traits)) {
      if (trait.unlockedBy === undefined) {
        errors.push(createError(`traits.${traitId}.unlockedBy`, 'Missing required field: unlockedBy (use empty array [] if none)'));
      } else {
        checkArray(`traits.${traitId}.unlockedBy`, trait.unlockedBy);
      }
      if (trait.excludedBy === undefined) {
        errors.push(createError(`traits.${traitId}.excludedBy`, 'Missing required field: excludedBy (use empty array [] if none)'));
      } else {
        checkArray(`traits.${traitId}.excludedBy`, trait.excludedBy);
      }
    }
  }

  // worldLore - validate each entry has a text field
  if (config.worldLore) {
    for (const [loreId, entry] of Object.entries(config.worldLore)) {
      if (entry && typeof entry === 'object') {
        if (entry.text === undefined) {
          errors.push(createError(`worldLore.${loreId}.text`, 'Missing required field: text'));
        } else {
          checkString(`worldLore.${loreId}.text`, entry.text);
        }
      }
    }
  }

  // storyStarts - validate locationAreas is an array of strings
  if (config.storyStarts) {
    const storyStarts = Array.isArray(config.storyStarts) ? config.storyStarts : Object.entries(config.storyStarts);
    for (const item of storyStarts) {
      const [startId, start] = Array.isArray(config.storyStarts) ? [storyStarts.indexOf(item), item] : item;
      if (start && start.locationAreas !== undefined) {
        if (!Array.isArray(start.locationAreas)) {
          errors.push(createError(`storyStarts.${startId}.locationAreas`, `Expected array of strings, got ${typeof start.locationAreas}`));
        }
      }
    }
  }
}

function validateUnknownFields(config, errors) {
  // Known fields per entity type
  const KNOWN_FIELDS = {
    npcs: new Set([
      'name', 'type', 'currentLocation', 'currentArea', 'gender', 'faction',
      'basicInfo', 'hiddenInfo', 'visualDescription', 'visualTags', 'personality',
      'abilities', 'aliases', 'level', 'hpMax', 'hpCurrent', 'tier', 'vulnerabilities',
      'resistances', 'immunities', 'activeBuffs', 'known', 'lastSeenLocation',
      'lastSeenArea', 'currentCoordinates', 'detailType', 'voiceTag',
      'questOriginArcId', 'questOriginQuestId', 'embedding',
      'embeddingId', 'portraitUrl', 'needsDetailGeneration', 'deathXPAwarded',
    ]),
    locations: new Set([
      'name', 'basicInfo', 'x', 'y', 'radius', 'region', 'complexityType',
      'detailType', 'areas', 'factions', 'hiddenInfo', 'visualTags', 'imageUrl',
      'embeddingId', 'known', 'visited', 'lastVisitedTick', 'visitedAreas',
      'questOriginArcId', 'questOriginQuestId',
    ]),
    regions: new Set([
      'name', 'basicInfo', 'x', 'y', 'realm', 'factions', 'hiddenInfo', 'known', 'imageUrl',
    ]),
    realms: new Set([
      'name', 'basicInfo', 'known',
    ]),
    factions: new Set([
      'name', 'basicInfo', 'factionType', 'hiddenInfo', 'embeddingId', 'detailType', 'known',
    ]),
    items: new Set([
      'name', 'category', 'description', 'bonuses', 'slot', 'mediaContent',
    ]),
    abilities: new Set([
      'name', 'description', 'requirements', 'bonus', 'cooldown',
    ]),
    skills: new Set([
      'name', 'attribute', 'type', 'description', 'startingItems',
    ]),
    traits: new Set([
      'name', 'description', 'quirk', 'attributes', 'skills', 'resources',
      'startingItems', 'abilities', 'unlockedBy', 'excludedBy',
    ]),
    npcTypes: new Set([
      'name', 'description', 'vulnerabilities', 'resistances', 'immunities',
    ]),
    quests: new Set([
      'name', 'questSource', 'questStatement', 'mainObjective', 'completionCondition',
      'questGiverNPC', 'questDesignBrief', 'conclusive', 'detailType', 'spatialRelationship', 'questLocation',
    ]),
    storyStarts: new Set([
      'name', 'description', 'storyStart', 'locations', 'locationAreas',
      'startingQuests', 'firstQuest', 'startingItems', 'startingPartyNPCs', 'isDefault',
    ]),
    worldLore: new Set([
      'text', 'embeddingId',
    ]),
    triggers: new Set([
      'name', 'conditions', 'effects', 'recurring', 'script', 'embeddingId',
    ]),
  };

  // Settings sub-objects
  const KNOWN_SETTINGS_FIELDS = {
    attributeSettings: new Set([
      'attributeNames', 'startingAttributeValue', 'startingAttributePoints',
      'maxStartingAttribute', 'attributeBonusModifier', 'lowAttributeThreshold',
      'lowAttributeTraits', 'attributeStatModifiers',
    ]),
    skillSettings: new Set([
      'trainingCooldown', 'skillBonusModifier', 'maxSkillLevel', 'maxSkillSuccessLevel',
      'startingXPToLevelUpSkill', 'additionalXPRequiredPerSkillLevel',
      'baseXPFromSkillUpgrade', 'charXPPerSkillLevel', 'baseChanceToLearnNewSkill',
      'skillLearningBonusModifier', 'xpFromNewSkill', 'skillTypeDifficultyBonus',
      'skillXPRewards',
    ]),
    locationSettings: new Set([
      'regionSize', 'simpleRadius', 'complexRadius', 'regionLocationCount',
      'regionFactionCount', 'avgTravelDistance', 'minTravelDistance', 'newRegionGenerationEnabled', 'encountersEnabled',
    ]),
    itemSettings: new Set([
      'currencyName', 'startingItems', 'itemCategories', 'itemSlots',
    ]),
    combatSettings: new Set([
      'baseCombatXP', 'minCombatXP', 'abilityCooldown', 'abilityBonus',
      'npcDailyHealingAmount', 'damageTypes',
    ]),
    otherSettings: new Set([
      'startingCharacterLevelUpRequirement', 'extraRequiredXPPerCharacterLevel',
      'maxCharacterLevel',
      'npcHealthPerLevel', 'npcMinHealth',
    ]),
    storySettings: new Set([
      'worldBackground', 'questGenerationGuidance',
    ]),
  };

  // Check entity collections
  for (const [section, knownFields] of Object.entries(KNOWN_FIELDS)) {
    const data = config[section];
    if (!data || typeof data !== 'object') continue;

    for (const [entityKey, entity] of Object.entries(data)) {
      if (!entity || typeof entity !== 'object') continue;
      for (const field of Object.keys(entity)) {
        if (!knownFields.has(field)) {
          errors.push(createError(
            `${section}.${entityKey}.${field}`,
            `Unknown field "${field}" - not in schema. Remove it or check for typos`
          ));
        }
      }
    }
  }

  // Check nested structures within entities
  const KNOWN_NESTED = {
    // Location areas
    locationArea: new Set(['name', 'description', 'paths']),
    // Ability requirements
    abilityRequirement: new Set(['type', 'variable', 'amount']),
    // Item bonuses
    itemBonus: new Set(['type', 'variable', 'value']),
    // Trait modifiers
    traitAttribute: new Set(['attribute', 'modifier']),
    traitSkill: new Set(['skill', 'modifier']),
    traitResource: new Set(['resource', 'modifier']),
    inventoryDef: new Set(['item', 'quantity']),
    // NPC active buffs
    activeBuff: new Set(['type', 'amount', 'duration', 'source', 'resource', 'attribute', 'skill', 'damageType']),
    // Resource settings entries
    resource: new Set(['name', 'initialValue', 'maxValue', 'rechargeRate', 'restRechargeMultiplier', 'gainPerLevel', 'color', 'isHealth', 'usageInstructions']),
    // Item slot entries
    itemSlot: new Set(['slot', 'category', 'quantity']),
    // Skill XP rewards
    skillXPRewards: new Set(['small', 'medium', 'large', 'huge']),
    // Trigger conditions (union of all condition types)
    triggerCondition: new Set(['type', 'operator', 'value', 'query', 'embeddingId', 'resource', 'entity', 'key']),
    // Trigger effects (union of all effect types)
    triggerEffect: new Set(['type', 'operator', 'value', 'instruction', 'questId', 'resource', 'entity', 'key']),
    // Attribute stat modifier entries
    attrStatModifier: new Set(['variable', 'amount']),
  };

  function checkNested(parentPath, obj, knownSet) {
    if (!obj || typeof obj !== 'object') return;
    for (const field of Object.keys(obj)) {
      if (!knownSet.has(field)) {
        errors.push(createError(
          `${parentPath}.${field}`,
          `Unknown field "${field}" - not in schema. Remove it or check for typos`
        ));
      }
    }
  }

  // Location areas
  if (config.locations) {
    for (const [locKey, loc] of Object.entries(config.locations)) {
      if (loc.areas && typeof loc.areas === 'object') {
        for (const [areaKey, area] of Object.entries(loc.areas)) {
          if (area && typeof area === 'object') {
            checkNested(`locations.${locKey}.areas.${areaKey}`, area, KNOWN_NESTED.locationArea);
          }
        }
      }
    }
  }

  // Ability requirements
  if (config.abilities) {
    for (const [abilKey, abil] of Object.entries(config.abilities)) {
      if (Array.isArray(abil.requirements)) {
        abil.requirements.forEach((req, i) => {
          checkNested(`abilities.${abilKey}.requirements[${i}]`, req, KNOWN_NESTED.abilityRequirement);
        });
      }
    }
  }

  // Item bonuses
  if (config.items) {
    for (const [itemKey, item] of Object.entries(config.items)) {
      if (Array.isArray(item.bonuses)) {
        item.bonuses.forEach((bonus, i) => {
          checkNested(`items.${itemKey}.bonuses[${i}]`, bonus, KNOWN_NESTED.itemBonus);
        });
      }
    }
  }

  // Trait nested arrays
  if (config.traits) {
    for (const [traitKey, trait] of Object.entries(config.traits)) {
      if (Array.isArray(trait.attributes)) {
        trait.attributes.forEach((mod, i) => {
          checkNested(`traits.${traitKey}.attributes[${i}]`, mod, KNOWN_NESTED.traitAttribute);
        });
      }
      if (Array.isArray(trait.skills)) {
        trait.skills.forEach((mod, i) => {
          checkNested(`traits.${traitKey}.skills[${i}]`, mod, KNOWN_NESTED.traitSkill);
        });
      }
      if (Array.isArray(trait.resources)) {
        trait.resources.forEach((mod, i) => {
          checkNested(`traits.${traitKey}.resources[${i}]`, mod, KNOWN_NESTED.traitResource);
        });
      }
      if (Array.isArray(trait.startingItems)) {
        trait.startingItems.forEach((item, i) => {
          checkNested(`traits.${traitKey}.startingItems[${i}]`, item, KNOWN_NESTED.inventoryDef);
        });
      }
    }
  }

  // NPC active buffs
  if (config.npcs) {
    for (const [npcKey, npc] of Object.entries(config.npcs)) {
      if (Array.isArray(npc.activeBuffs)) {
        npc.activeBuffs.forEach((buff, i) => {
          checkNested(`npcs.${npcKey}.activeBuffs[${i}]`, buff, KNOWN_NESTED.activeBuff);
        });
      }
    }
  }

  // Story start startingItems
  if (config.storyStarts) {
    for (const [startKey, start] of Object.entries(config.storyStarts)) {
      if (Array.isArray(start.startingItems)) {
        start.startingItems.forEach((item, i) => {
          checkNested(`storyStarts.${startKey}.startingItems[${i}]`, item, KNOWN_NESTED.inventoryDef);
        });
      }
    }
  }

  // Trigger conditions and effects
  if (config.triggers) {
    for (const [trigKey, trig] of Object.entries(config.triggers)) {
      if (Array.isArray(trig.conditions)) {
        trig.conditions.forEach((cond, i) => {
          checkNested(`triggers.${trigKey}.conditions[${i}]`, cond, KNOWN_NESTED.triggerCondition);
        });
      }
      if (Array.isArray(trig.effects)) {
        trig.effects.forEach((eff, i) => {
          checkNested(`triggers.${trigKey}.effects[${i}]`, eff, KNOWN_NESTED.triggerEffect);
        });
      }
    }
  }

  // Resource settings entries
  if (config.resourceSettings) {
    for (const [resKey, res] of Object.entries(config.resourceSettings)) {
      if (res && typeof res === 'object') {
        checkNested(`resourceSettings.${resKey}`, res, KNOWN_NESTED.resource);
      }
    }
  }

  // Attribute stat modifier entries
  if (config.attributeSettings?.attributeStatModifiers) {
    for (const [attrKey, mod] of Object.entries(config.attributeSettings.attributeStatModifiers)) {
      if (mod && typeof mod === 'object') {
        checkNested(`attributeSettings.attributeStatModifiers.${attrKey}`, mod, KNOWN_NESTED.attrStatModifier);
      }
    }
  }

  // Item slots
  if (config.itemSettings?.itemSlots && Array.isArray(config.itemSettings.itemSlots)) {
    config.itemSettings.itemSlots.forEach((slot, i) => {
      if (slot && typeof slot === 'object') {
        checkNested(`itemSettings.itemSlots[${i}]`, slot, KNOWN_NESTED.itemSlot);
      }
    });
  }

  // Skill XP rewards
  if (config.skillSettings?.skillXPRewards && typeof config.skillSettings.skillXPRewards === 'object') {
    checkNested('skillSettings.skillXPRewards', config.skillSettings.skillXPRewards, KNOWN_NESTED.skillXPRewards);
  }

  // Check settings sub-objects
  for (const [section, knownFields] of Object.entries(KNOWN_SETTINGS_FIELDS)) {
    const data = config[section];
    if (!data || typeof data !== 'object') continue;

    for (const field of Object.keys(data)) {
      if (!knownFields.has(field)) {
        errors.push(createError(
          `${section}.${field}`,
          `Unknown field "${field}" - not in schema. Remove it or check for typos`
        ));
      }
    }
  }
}

function validateNameKeyMatch(config, errors) {
  // Sections where the object key should exactly match the "name" field
  const sectionsToCheck = [
    'abilities',
    'items',
    'locations',
    'regions',
    'realms',
    'factions',
    'npcs',
    'npcTypes',
    'skills',
    'traits',
    'storyStarts',
    'triggers',
    'traitCategories',
    'resourceSettings',
  ];

  for (const section of sectionsToCheck) {
    if (!config[section] || typeof config[section] !== 'object') continue;

    for (const [key, entity] of Object.entries(config[section])) {
      if (entity && typeof entity === 'object' && entity.name) {
        if (key !== entity.name) {
          errors.push(createError(
            `${section}.${key}`,
            `Key "${key}" does not match name "${entity.name}"`
          ));
        }
      }
    }
  }
}

function validateLocationRequiredFields(config, errors) {
  if (!config.locations) return;

  // Required fields for locations
  const REQUIRED_LOCATION_FIELDS = ['basicInfo', 'complexityType', 'x', 'y', 'radius', 'region', 'detailType'];
  const VALID_COMPLEXITY_TYPES = ['simple', 'complex'];
  const VALID_DETAIL_TYPES = ['basic', 'detailed'];

  for (const [locId, location] of Object.entries(config.locations)) {
    // Check required fields
    for (const field of REQUIRED_LOCATION_FIELDS) {
      if (location[field] === undefined) {
        errors.push(createError(`locations.${locId}.${field}`, `Missing required field: ${field}`));
      }
    }

    // Validate complexityType enum
    if (location.complexityType && !VALID_COMPLEXITY_TYPES.includes(location.complexityType)) {
      errors.push(createError(`locations.${locId}.complexityType`, `Invalid complexityType: ${location.complexityType}. Valid: ${VALID_COMPLEXITY_TYPES.join(', ')}`));
    }

    // Validate detailType enum
    if (location.detailType && !VALID_DETAIL_TYPES.includes(location.detailType)) {
      errors.push(createError(`locations.${locId}.detailType`, `Invalid detailType: ${location.detailType}. Valid: ${VALID_DETAIL_TYPES.join(', ')}`));
    }


    // Validate x, y, radius are numbers
    if (location.x !== undefined && typeof location.x !== 'number') {
      errors.push(createError(`locations.${locId}.x`, `Expected number, got ${typeof location.x}`));
    }
    if (location.y !== undefined && typeof location.y !== 'number') {
      errors.push(createError(`locations.${locId}.y`, `Expected number, got ${typeof location.y}`));
    }
    if (location.radius !== undefined && typeof location.radius !== 'number') {
      errors.push(createError(`locations.${locId}.radius`, `Expected number, got ${typeof location.radius}`));
    }

    // Validate areas have required paths field
    if (location.areas && typeof location.areas === 'object') {
      for (const [areaId, area] of Object.entries(location.areas)) {
        if (area.paths === undefined) {
          errors.push(createError(`locations.${locId}.areas.${areaId}.paths`, 'Missing required field: paths (use empty array [] if none)'));
        } else if (!Array.isArray(area.paths)) {
          errors.push(createError(`locations.${locId}.areas.${areaId}.paths`, `Expected array, got ${typeof area.paths}`));
        }
      }
    }
  }
}

function validateRealmRequiredFields(config, errors) {
  if (!config.realms) return;

  // Realms require basicInfo field
  for (const [realmId, realm] of Object.entries(config.realms)) {
    if (realm.basicInfo === undefined) {
      errors.push(createError(`realms.${realmId}.basicInfo`, `Missing required field: basicInfo`));
    }
  }
}

function validateLocationCoordinates(config, errors) {
  if (!config.locations) return;

  const regionSize = config.locationSettings?.regionSize;
  if (!regionSize) {
    // Skip coordinate validation if regionSize is not defined
    return;
  }
  const halfSize = regionSize / 2;

  const locations = Object.entries(config.locations);

  for (const [locId, location] of locations) {
    const x = location.x;
    const y = location.y;
    const radius = location.radius || 0;

    // Check if coordinates are defined
    if (x === undefined || y === undefined) {
      continue; // Skip - other validation will catch missing required fields
    }

    // Check bounds: location + radius must stay within -halfSize to halfSize
    if (x - radius < -halfSize || x + radius > halfSize) {
      errors.push(createError(
        `locations.${locId}.x`,
        `Location x (${x}) with radius (${radius}) exceeds region bounds (-${halfSize} to ${halfSize})`
      ));
    }

    if (y - radius < -halfSize || y + radius > halfSize) {
      errors.push(createError(
        `locations.${locId}.y`,
        `Location y (${y}) with radius (${radius}) exceeds region bounds (-${halfSize} to ${halfSize})`
      ));
    }
  }

  // Group locations by region for overlap checking
  // Coordinates are relative to region, so only check within same region
  const locationsByRegion = {};
  for (const [locId, location] of locations) {
    const region = location.region || '_unknown_';
    if (!locationsByRegion[region]) {
      locationsByRegion[region] = [];
    }
    locationsByRegion[region].push([locId, location]);
  }

  // Check for overlapping locations within each region
  for (const regionLocations of Object.values(locationsByRegion)) {
    for (let i = 0; i < regionLocations.length; i++) {
      const [locId1, loc1] = regionLocations[i];
      const x1 = loc1.x;
      const y1 = loc1.y;
      const r1 = loc1.radius || 0;

      if (x1 === undefined || y1 === undefined) continue;

      for (let j = i + 1; j < regionLocations.length; j++) {
        const [locId2, loc2] = regionLocations[j];
        const x2 = loc2.x;
        const y2 = loc2.y;
        const r2 = loc2.radius || 0;

        if (x2 === undefined || y2 === undefined) continue;

        // Calculate distance between centers
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

        // Check if circles overlap (distance < sum of radii)
        if (distance < r1 + r2) {
          errors.push(createError(
            `locations.${locId1}`,
            `Overlaps with ${locId2} in region "${loc1.region}" (distance: ${distance.toFixed(1)}, combined radii: ${r1 + r2})`
          ));
        }
      }
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

function validate(config) {
  const errors = [];
  const warnings = [];

  validateVersionFields(config, errors);
  validateRequiredFields(config, errors);
  validateReferenceIntegrity(config, errors);
  validateTriggers(config, errors);
  validateDamageTypes(config, errors);
  validateCharacterLimits(config, errors, warnings);
  validateTypeChecks(config, errors);
  validateNameKeyMatch(config, errors);
  validateLocationRequiredFields(config, errors);
  validateRealmRequiredFields(config, errors);
  validateLocationCoordinates(config, errors);
  validateUnknownFields(config, errors);

  return { errors, warnings };
}

function printReport(result, inputPath, verbose) {
  console.log('═'.repeat(70));
  console.log('  VOYAGE WORLD CONFIG VALIDATION REPORT');
  console.log(`  File: ${path.basename(inputPath)}`);
  console.log('═'.repeat(70));

  if (result.errors.length === 0) {
    console.log('\n  ✅ No validation errors found\n');
  } else {
    console.log(`\n  ❌ ${result.errors.length} validation error${result.errors.length > 1 ? 's' : ''} found\n`);

    // Group errors by category
    const byCategory = {
      'Missing Fields': [],
      'Invalid References': [],
      'Invalid Types/Values': [],
      'Unknown Fields': [],
      'Limit Violations': [],
      'Location Coordinates': [],
      'Other': [],
    };

    for (const error of result.errors) {
      if (error.message.includes('Missing required')) {
        byCategory['Missing Fields'].push(error);
      } else if (error.message.includes('Unknown field')) {
        byCategory['Unknown Fields'].push(error);
      } else if (error.message.includes('References non-existent') || error.message.includes('Invalid') && (error.message.includes('category') || error.message.includes('slot') || error.message.includes('tier') || error.message.includes('type'))) {
        byCategory['Invalid References'].push(error);
      } else if (error.message.includes('Too long') || error.message.includes('Too many') || error.message.includes('too large')) {
        byCategory['Limit Violations'].push(error);
      } else if (error.message.includes('exceeds region bounds') || error.message.includes('Overlaps with')) {
        byCategory['Location Coordinates'].push(error);
      } else if (error.message.includes('Expected') || error.message.includes('Invalid')) {
        byCategory['Invalid Types/Values'].push(error);
      } else {
        byCategory['Other'].push(error);
      }
    }

    for (const [category, errors] of Object.entries(byCategory)) {
      if (errors.length === 0) continue;

      console.log(`─ ${category} (${errors.length}) ${'─'.repeat(50 - category.length)}`);
      for (const error of errors) {
        console.log(`  🔴 ${error.path}`);
        if (verbose) {
          console.log(`     ${error.message}`);
        }
      }
      console.log('');
    }
  }

  if (result.warnings.length > 0) {
    console.log(`  ⚠️  ${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''}\n`);
    for (const warning of result.warnings) {
      console.log(`  🟡 ${warning.path}`);
      if (verbose) {
        console.log(`     ${warning.message}`);
      }
    }
    console.log('');
  }

  console.log('═'.repeat(70));
  if (result.errors.length === 0) {
    console.log('  ✅ Validation passed');
  } else {
    console.log(`  ❌ Validation failed with ${result.errors.length} error${result.errors.length > 1 ? 's' : ''}`);
    if (!verbose) {
      console.log('  Run with --verbose for detailed error messages');
    }
  }
  console.log('═'.repeat(70));
}

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const verbose = args.includes('--verbose') || args.includes('-v');
  const inputPath = args.find((a) => !a.startsWith('-')) || path.join(__dirname, '../../tabs');

  if (args.includes('--help') || args.includes('-h')) {
    console.error('Usage: node validate.js [world.json | directory] [--json] [--verbose]');
    console.error('');
    console.error('Validates a Voyage world config JSON file or directory of JSON files.');
    console.error('');
    console.error('Options:');
    console.error('  --json     Output as JSON (for programmatic use)');
    console.error('  --verbose  Show detailed error messages');
    console.error('');
    console.error('Checks:');
    console.error('  - Required top-level fields');
    console.error('  - Required settings subfields');
    console.error('  - Entity reference integrity (NPC → location, etc.)');
    console.error('  - Enum values (trigger types, NPC tiers, damage types)');
    console.error('  - Basic type checks');
    console.error('  - Character and count limits');
    console.error('  - Name-key matching');
    console.error('');
    console.error('Example:');
    console.error('  node validate.js my-world.json');
    console.error('  node validate.js my-world.json --verbose');
    console.error('  node validate.js ./tabs/');
    process.exit(1);
  }

  const fullPath = path.resolve(inputPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`Error: Path not found: ${inputPath}`);
    process.exit(1);
  }

  // Check if input is a directory
  const stats = fs.statSync(fullPath);
  let config;
  let displayPath = inputPath;

  if (stats.isDirectory()) {
    // Merge all JSON files in directory
    const jsonFiles = fs.readdirSync(fullPath)
      .filter(f => f.endsWith('.json'))
      .sort()
      .map(f => path.join(fullPath, f));

    if (jsonFiles.length === 0) {
      console.error(`Error: No JSON files found in ${inputPath}`);
      process.exit(1);
    }

    config = {};
    for (const file of jsonFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(content);
        Object.assign(config, parsed);
      } catch (err) {
        if (err instanceof SyntaxError) {
          console.error(`Error: Invalid JSON in ${path.basename(file)}`);
          console.error(`  ${err.message}`);
        } else {
          console.error(`Error reading ${path.basename(file)}: ${err.message}`);
        }
        process.exit(1);
      }
    }
    displayPath = `${inputPath} (${jsonFiles.length} files)`;
  } else {
    // Single file
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      config = JSON.parse(content);
    } catch (err) {
      if (err instanceof SyntaxError) {
        console.error(`Error: Invalid JSON in ${inputPath}`);
        console.error(`  ${err.message}`);
      } else {
        console.error(`Error reading ${inputPath}: ${err.message}`);
      }
      process.exit(1);
    }
  }

  const result = validate(config);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printReport(result, displayPath, verbose);
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main();
