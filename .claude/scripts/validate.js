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
  'quest-status',
  'narrative-event-status',
  'npc-relationship',
  'npc-relationship-stage',
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
  'quest-objective-reveal',
  'quest-objective-complete',
  'quest-next-step-set',
  'quest-next-step-clear',
  'party-next-step-set',
  'party-next-step-clear',
  'quest-complete',
  'narrative-event-start',
  'npc-relationship',
  'win-game',
  'lose-game',
  'end-game',
  'music-track-set',
  'music-track-clear',
];

// Known status values for quest-status / narrative-event-status conditions.
// Unrecognized values only warn (engine compares raw strings).
const VALID_QUEST_STATUSES = ['hidden', 'available', 'expired', 'accepted', 'completed', 'abandoned', 'rejected'];
const VALID_NARRATIVE_EVENT_STATUSES = ['inactive', 'active', 'stopped', 'completed'];
const VALID_QUEST_OBJECTIVE_STATUSES = ['hidden', 'active', 'completed'];
const VALID_NEXT_STEP_SOURCES = ['objective', 'narrative-event'];
const VALID_TRIGGER_SCOPES = ['party', 'player'];
const VALID_EFFECT_TARGETS = ['allPlayers', 'satisfyingPlayers'];

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

// win-game / lose-game / end-game optional fields
const VALID_END_GAME_SCOPES = ['game', 'players'];
const VALID_END_GAME_OUTCOMES = ['won', 'lost', 'ended'];

const VALID_NUMBER_EFFECT_OPERATORS = ['add', 'subtract', 'multiply', 'divide', 'set'];
const VALID_BOOLEAN_EFFECT_OPERATORS = ['set', 'toggle'];
const VALID_ARRAY_EFFECT_OPERATORS = ['set', 'add', 'remove'];

// ============================================================================
// REQUIRED FIELDS
// ============================================================================

const REQUIRED_TOP_LEVEL = [
  'aiInstructions',
  'storySettings',
  'worldLore',
  'triggers',
  'questTriggers',
  'storyStarts',
  'abilities',
  'npcTypes',
  'itemTypes',
  'realms',
  'regions',
  'locations',
  'factions',
  'npcs',
  'quests',
  'arcs',
  'narrativeEvents',
  'attributeSettings',
  'skills',
  'skillSettings',
  'traits',
  'traitCategories',
  'locationSettings',
  'itemSettings',
  'combatSettings',
  'otherSettings',
  'progressionSettings',
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
  'heroesVersion',
  'characterCreationSettings',
  'endGame',
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
  'npcHealthPerLevel',
  'npcMinHealth',
];

const REQUIRED_PROGRESSION_SETTINGS = [
  'startingCharacterLevelUpRequirement',
  'extraRequiredXPPerCharacterLevel',
  'maxCharacterLevel',
  'abilityPointEveryLevels',
  'abilityPointsPerGrant',
  'attributePointEveryLevels',
  'attributePointsPerGrant',
  'maxAttributeValue',
  'traitPickEveryLevels',
  'traitPicksPerGrant',
  'locationDiscoveryXP',
  'levelUpTraitPool',
  'milestoneTitles',
];

const REQUIRED_LOCATION_SETTINGS = [
  'regionSize',
  'simpleRadius',
  'complexRadius',
  'regionLocationCount',
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
  total: 12_500_000,
  sections: {
    worldLore: 1_000_000,
    npcs: 2_000_000,
    locations: 2_000_000,
    npcTypes: 500_000,
    itemTypes: 250_000,
    factions: 100_000,
    regions: 500_000,
    realms: 100_000,
    traitCategories: 100_000,
    traits: 1_750_000,
    gameModes: 100_000,
    itemSettings: 5_000,
    nameFilterSettings: 150_000,
  },
  counts: {
    // The engine only fails when the count exceeds 101
    storyStarts: 101,
    semanticTriggers: 500,
    mechanicalTriggers: 4_000,
    abilities: 1_500,
    triggerConditions: 5,
    triggerEffects: 10,
    abilityRequirements: 10,
    traitRequirements: 10,
    startingTraitSelections: 40,
    triggerSize: 10_000,
    premadeCharacters: 100,
    itemCategories: 40,
    itemSlots: 60,
    damageTypes: 40,
    attributeNames: 30,
    // Engine keeps only the first 32 voices in the catalog
    worldVoices: 32,
  },
  fields: {
    worldBackground: 5_000,
    questGenerationGuidance: 5_000,
    narratorStyle: 2_000,
    deathInstructions: 4_000,
    aiInstructionIndividual: 5_000,
    aiInstructionCombined: 20_000,
    // generateNPCIntents gets a larger allowance than other AI tasks
    aiInstructionIndividualNPCIntents: 8_000,
    // Per-task combined allowances that differ from aiInstructionCombined
    aiInstructionCombinedByTask: {
      generateStory: 30_000,
      generateNPCIntents: 40_000,
      generateNPCUpdates: 24_000,
      generateNPCDetails: 26_000,
    },
    gameModeNpcIntentInstructions: 5_000,
    // worldVoices entries are sanitized (truncated/clamped) by the engine, never rejected
    worldVoiceLabel: 64,
    worldVoiceTag: 256,
    worldVoiceInstructions: 1_000,
    worldLoreEntry: 4_000,
    storyStartEntry: 8_000,
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
    // Combined budget over description + traitNarrativeEffects per trait; creators
    // decide how to split it between the two fields
    traitTextTotal: 6_000,
    abilityDescription: 2_000,
    realmBasicInfo: 100_000,
    triggerConditionQuery: 1_000,
    triggerConditionValue: 100,
    triggerEffectInstruction: 1_000,
    triggerEffectValue: 100,
    currencyName: 64,
  },
  // Per-element character limits for settings arrays
  settingsEntries: {
    itemCategory: 60,
    itemSlotName: 64,
    itemSlotCategory: 60,
    damageType: 60,
    attributeName: 64,
    nameFilterReplacement: 64,
    premadeCharacter: 20_000,
  },
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

// Engine matches resource keys/names case-insensitively (NFC + toLowerCase + trim).
// Reference checks against resource keys must use this same normalization.
function normalizeText(value) {
  return String(value ?? '').normalize('NFC').toLowerCase().trim();
}

function buildResourceKeySet(config) {
  return config.resourceSettings
    ? new Set(Object.keys(config.resourceSettings).map(normalizeText))
    : new Set();
}

function createError(path, message, severity = 'error') {
  return { path, message, severity };
}

function getJsonLength(obj) {
  // Compact JSON: the platform measures every size limit against compact serialization
  return JSON.stringify(obj).length;
}

// Per-task charged baselines for AI instructions: content up to the checkpoint is
// exempt from the per-task and total size caps ("free growth"). generateNPCDetails
// additionally protects a fixed allowance above its checkpoint.
const AI_TASK_CHARGED_BASELINES = {
  generateStory: 13_069,
  generateInitialStart: 1_434,
  generateActionInfo: 13,
  generateCharacterBackground: 1_815,
  generateNPCIntents: 11_031,
  generateNewNPC: 13,
  generateNPCDetails: 13,
  generateNPCUpdates: 1_861,
  generateLocationDetails: 13,
  generateRegionDetails: 13,
  generateEncounters: 13,
  ItemGenerationAndUsage: 13,
  summarization: 13,
  generateLearnedAbilities: 13,
};
const AI_TASK_PROTECTED_BASELINES = {
  generateNPCDetails: 13 + 6_000,
};

function getTaskFreeAiGrowth(taskId, actualLength) {
  const charged = AI_TASK_CHARGED_BASELINES[taskId] ?? 0;
  const protectedBaseline = Math.max(AI_TASK_PROTECTED_BASELINES[taskId] ?? charged, charged);
  return Math.max(0, Math.min(actualLength, protectedBaseline) - charged);
}

function getFreeAiInstructionsGrowth(config) {
  let total = 0;
  for (const [taskId, instructions] of Object.entries(config.aiInstructions ?? {})) {
    total += getTaskFreeAiGrowth(taskId, getJsonLength(instructions));
  }
  return total;
}

const OPTIONAL_TOP_LEVEL = [
  'gameModes',
  'characterCreationMusic',
  'imagePromptConfiguration',
  'imageModelSource',
  // Authored voice catalog referenced by npcs[].worldVoiceId / premadeCharacters[].worldVoiceId
  'worldVoices',
  // Required by the V36 schema, but the engine falls back to its own defaults
  // when omitted, and stages must cover -100..100 with no gap when present.
  'relationshipStages',
  // Same omit-for-defaults shape, and stricter: the platform REJECTS an empty
  // catalog (the section merges atomically), so present-but-empty is never valid.
  'gameplayMusicSettings',
  // Top-level in the merged tabs shape (tabs/world-background.json); build.js
  // hoists it into storySettings.worldBackground in the compiled config.
  'worldBackground',
];

function validateRequiredFields(config, errors) {
  // Top-level required fields
  for (const field of REQUIRED_TOP_LEVEL) {
    if (config[field] === undefined) {
      errors.push(createError(field, `Missing required field: ${field}`));
    }
  }

  // Unknown top-level fields
  const knownTopLevel = new Set([...REQUIRED_TOP_LEVEL, ...OPTIONAL_TOP_LEVEL]);
  for (const field of Object.keys(config)) {
    if (!knownTopLevel.has(field)) {
      errors.push(createError(field, `Unknown field: ${field} — remove it`));
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

  // progressionSettings subfields
  if (config.progressionSettings) {
    for (const field of REQUIRED_PROGRESSION_SETTINGS) {
      if (config.progressionSettings[field] === undefined) {
        errors.push(createError(`progressionSettings.${field}`, `Missing required field: progressionSettings.${field}`));
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

function validateReferenceIntegrity(config, errors) {
  const locationKeys = config.locations ? new Set(Object.keys(config.locations)) : new Set();
  const regionKeys = config.regions ? new Set(Object.keys(config.regions)) : new Set();
  const realmKeys = config.realms ? new Set(Object.keys(config.realms)) : new Set();
  const factionKeys = config.factions ? new Set(Object.keys(config.factions)) : new Set();
  const npcTypeKeys = config.npcTypes ? new Set(Object.keys(config.npcTypes)) : new Set();
  const abilityKeys = config.abilities ? new Set(Object.keys(config.abilities)) : new Set();
  const skillKeys = config.skills ? new Set(Object.keys(config.skills)) : new Set();
  const worldVoiceKeys = config.worldVoices && typeof config.worldVoices === 'object' && !Array.isArray(config.worldVoices)
    ? new Set(Object.keys(config.worldVoices))
    : new Set();

  // Get valid item categories and slots from itemSettings
  const validCategories = new Set(config.itemSettings?.itemCategories || []);
  const itemSlotDefs = Array.isArray(config.itemSettings?.itemSlots) ? config.itemSettings.itemSlots : [];
  const validSlots = new Set(itemSlotDefs.map((s) => s.slot));

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

      // worldVoiceId must be a key of the worldVoices catalog
      if (npc.worldVoiceId !== undefined && !worldVoiceKeys.has(npc.worldVoiceId)) {
        errors.push(createError(`npcs.${npcId}.worldVoiceId`, `References non-existent world voice: ${npc.worldVoiceId}${worldVoiceKeys.size === 0 ? ' (worldVoices is missing)' : ''}`));
      }
    }
  }

  // Premade character voice references
  (Array.isArray(config.premadeCharacters) ? config.premadeCharacters : []).forEach((pc, i) => {
    if (pc && typeof pc === 'object' && pc.worldVoiceId !== undefined && !worldVoiceKeys.has(pc.worldVoiceId)) {
      errors.push(createError(`premadeCharacters[${i}].worldVoiceId`, `References non-existent world voice: ${pc.worldVoiceId}${worldVoiceKeys.size === 0 ? ' (worldVoices is missing)' : ''}`));
    }
  });

  // npcLevelRange invariants: min/max must be positive whole numbers and min <= max
  const isPositiveWholeNumber = (v) => typeof v === 'number' && Number.isInteger(v) && v > 0;
  const validateNpcLevelRange = (entityType, entityId, levelRange) => {
    if (!levelRange || typeof levelRange !== 'object' || Array.isArray(levelRange)) return;
    const { min, max } = levelRange;
    if (!isPositiveWholeNumber(min) || !isPositiveWholeNumber(max)) {
      errors.push(createError(`${entityType}.${entityId}.npcLevelRange`, `npcLevelRange must use positive whole numbers for min and max`));
      return;
    }
    if (min > max) {
      errors.push(createError(`${entityType}.${entityId}.npcLevelRange`, `npcLevelRange min (${min}) must be less than or equal to max (${max})`));
    }
  };

  // Location references
  if (config.locations) {
    for (const [locId, location] of Object.entries(config.locations)) {
      if (location.region && !regionKeys.has(location.region)) {
        errors.push(createError(`locations.${locId}.region`, `References non-existent region: ${location.region}`));
      }
      (Array.isArray(location.factions) ? location.factions : []).forEach((faction, i) => {
        if (!factionKeys.has(faction)) {
          errors.push(createError(`locations.${locId}.factions[${i}]`, `References non-existent faction: ${faction}`));
        }
      });
      validateNpcLevelRange('locations', locId, location.npcLevelRange);
    }
  }

  // Region references
  if (config.regions) {
    for (const [regionId, region] of Object.entries(config.regions)) {
      if (region.realm && !realmKeys.has(region.realm)) {
        errors.push(createError(`regions.${regionId}.realm`, `References non-existent realm: ${region.realm}`));
      }
      (Array.isArray(region.factions) ? region.factions : []).forEach((faction, i) => {
        if (!factionKeys.has(faction)) {
          errors.push(createError(`regions.${regionId}.factions[${i}]`, `References non-existent faction: ${faction}`));
        }
      });
      validateNpcLevelRange('regions', regionId, region.npcLevelRange);
    }
  }

  // Quest references
  if (config.quests) {
    const narrativeEventKeys = config.narrativeEvents ? new Set(Object.keys(config.narrativeEvents)) : new Set();

    for (const [questId, quest] of Object.entries(config.quests)) {
      if (quest.questLocation && !locationKeys.has(quest.questLocation)) {
        errors.push(createError(`quests.${questId}.questLocation`, `References non-existent location: ${quest.questLocation}`));
      }

      // completionCondition must be an object (union of two shapes):
      //   { type: 'story', query: string } or { type: 'narrative-event-completed', eventId: string }
      if (quest.completionCondition !== undefined) {
        const cc = quest.completionCondition;
        const ccPath = `quests.${questId}.completionCondition`;
        if (typeof cc === 'string') {
          errors.push(createError(ccPath, `Legacy string completionCondition - must be an object {type:'story',query} or {type:'narrative-event-completed',eventId}`));
        } else if (!cc || typeof cc !== 'object' || Array.isArray(cc)) {
          errors.push(createError(ccPath, `must be an object {type:'story',query} or {type:'narrative-event-completed',eventId}`));
        } else if (cc.type === 'story') {
          if (typeof cc.query !== 'string') {
            errors.push(createError(`${ccPath}.query`, 'Missing required field: query'));
          } else if (cc.query.trim() === '') {
            errors.push(createError(`${ccPath}.query`, 'Empty completion condition query - quest will not auto-complete', 'warning'));
          }
        } else if (cc.type === 'narrative-event-completed') {
          if (typeof cc.eventId !== 'string' || cc.eventId === '') {
            errors.push(createError(`${ccPath}.eventId`, 'Missing required field: eventId'));
          } else if (!narrativeEventKeys.has(cc.eventId)) {
            errors.push(createError(`${ccPath}.eventId`, `References non-existent narrative event: ${cc.eventId}`));
          }
        } else {
          errors.push(createError(`${ccPath}.type`, `Invalid completionCondition type: ${cc.type}. Valid: story, narrative-event-completed`));
        }
      }

      // objectives - record of { id, text, status } keyed by objective id
      if (quest.objectives !== undefined) {
        if (!quest.objectives || typeof quest.objectives !== 'object' || Array.isArray(quest.objectives)) {
          errors.push(createError(`quests.${questId}.objectives`, `Expected object, got ${Array.isArray(quest.objectives) ? 'array' : typeof quest.objectives}`));
        } else {
          for (const [objKey, objective] of Object.entries(quest.objectives)) {
            const objPath = `quests.${questId}.objectives.${objKey}`;
            if (!objective || typeof objective !== 'object' || Array.isArray(objective)) {
              errors.push(createError(objPath, `Expected object with { id, text, status }, got ${Array.isArray(objective) ? 'array' : typeof objective}`));
              continue;
            }
            if (objective.id === undefined) {
              errors.push(createError(`${objPath}.id`, 'Missing required field: id'));
            } else if (objective.id !== objKey) {
              errors.push(createError(`${objPath}.id`, `Objective id "${objective.id}" does not match key "${objKey}"`, 'warning'));
            }
            if (typeof objective.text !== 'string' || objective.text === '') {
              errors.push(createError(`${objPath}.text`, 'Missing required field: text'));
            }
            if (objective.status === undefined) {
              errors.push(createError(`${objPath}.status`, 'Missing required field: status'));
            } else if (!VALID_QUEST_OBJECTIVE_STATUSES.includes(objective.status)) {
              errors.push(createError(`${objPath}.status`, `Invalid objective status: ${objective.status}. Valid: ${VALID_QUEST_OBJECTIVE_STATUSES.join(', ')}`));
            }
          }
        }
      }

      // activeObjectiveId must reference an objectives key
      if (quest.activeObjectiveId !== undefined) {
        const objectiveKeys = quest.objectives && typeof quest.objectives === 'object' && !Array.isArray(quest.objectives)
          ? new Set(Object.keys(quest.objectives))
          : new Set();
        if (!objectiveKeys.has(quest.activeObjectiveId)) {
          errors.push(createError(`quests.${questId}.activeObjectiveId`, `References non-existent objective: ${quest.activeObjectiveId}`));
        }
      }

      // nextStep - { text: string, source: 'objective' | 'narrative-event' }
      if (quest.nextStep !== undefined) {
        const ns = quest.nextStep;
        const nsPath = `quests.${questId}.nextStep`;
        if (!ns || typeof ns !== 'object' || Array.isArray(ns)) {
          errors.push(createError(nsPath, `Expected object with { text, source }, got ${Array.isArray(ns) ? 'array' : typeof ns}`));
        } else {
          if (typeof ns.text !== 'string' || ns.text === '') {
            errors.push(createError(`${nsPath}.text`, 'Missing required field: text'));
          }
          if (ns.source === undefined) {
            errors.push(createError(`${nsPath}.source`, 'Missing required field: source'));
          } else if (!VALID_NEXT_STEP_SOURCES.includes(ns.source)) {
            errors.push(createError(`${nsPath}.source`, `Invalid source: ${ns.source}. Valid: ${VALID_NEXT_STEP_SOURCES.join(', ')}`));
          }
        }
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

      // startingPartyNPCs must reference authored NPCs
      if (start.startingPartyNPCs && Array.isArray(start.startingPartyNPCs)) {
        const npcKeys = config.npcs ? new Set(Object.keys(config.npcs)) : new Set();
        start.startingPartyNPCs.forEach((npcName, npcIdx) => {
          if (!npcKeys.has(npcName)) {
            errors.push(createError(`${basePath}.startingPartyNPCs[${npcIdx}]`, `References non-existent NPC: ${npcName}`));
          }
        });
      }

      // allowPlayerInput only survives on the built-in "Write Your Own" story start
      if (start.allowPlayerInput !== undefined && start.name !== 'Write Your Own') {
        errors.push(createError(`${basePath}.allowPlayerInput`, 'allowPlayerInput is reserved for the built-in Write Your Own story start and is dropped otherwise', 'warning'));
      }

      // locationAreas - validate it's an array of area name strings
      if (start.locationAreas !== undefined) {
        if (!Array.isArray(start.locationAreas)) {
          errors.push(createError(`${basePath}.locationAreas`, `Expected array of area names, got ${typeof start.locationAreas}`));
        } else {
          // One area per location at most: the engine pairs areas with locations by index
          const startLocationCount = Array.isArray(start.locations) ? start.locations.length : 0;
          if (start.locationAreas.length > startLocationCount) {
            errors.push(createError(`${basePath}.locationAreas`, `Has ${start.locationAreas.length} entries but the story start only lists ${startLocationCount} locations (locationAreas must not exceed locations)`));
          }
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
  if (config.itemTypes) {
    for (const [itemId, item] of Object.entries(config.itemTypes)) {
      // category
      if (item.category && validCategories.size > 0 && !validCategories.has(item.category)) {
        errors.push(createError(`itemTypes.${itemId}.category`, `Invalid item category: ${item.category}. Valid: ${[...validCategories].join(', ')}`));
      }

      // slot
      if (item.slot && validSlots.size > 0 && !validSlots.has(item.slot)) {
        errors.push(createError(`itemTypes.${itemId}.slot`, `Invalid item slot: ${item.slot}. Valid: ${[...validSlots].join(', ')}`));
      } else if (item.slot && item.category && validSlots.has(item.slot)) {
        // A slot belongs to one category; the engine rejects items whose slot is defined for another category
        const slotCategories = itemSlotDefs.filter((s) => s.slot === item.slot).map((s) => s.category);
        if (!slotCategories.includes(item.category)) {
          errors.push(createError(`itemTypes.${itemId}.slot`, `Slot "${item.slot}" is defined for category ${slotCategories.map((c) => `"${c}"`).join(', ')}, not "${item.category}"`, 'warning'));
        }
      }
    }
  }

  // Trait references
  if (config.traits) {
    const itemKeys = config.itemTypes ? new Set(Object.keys(config.itemTypes)) : new Set();
    const resourceKeys = buildResourceKeySet(config);
    const attributeNames = config.attributeSettings?.attributeNames
      ? new Set(config.attributeSettings.attributeNames.map(a => a.toLowerCase()))
      : new Set();

    const traitKeys = new Set(Object.keys(config.traits));

    for (const [traitId, trait] of Object.entries(config.traits)) {
      // unlockedBy / excludedBy reference other traits by key
      for (const field of ['unlockedBy', 'excludedBy']) {
        (Array.isArray(trait[field]) ? trait[field] : []).forEach((ref, idx) => {
          if (!traitKeys.has(ref)) {
            errors.push(createError(`traits.${traitId}.${field}[${idx}]`, `References non-existent trait: ${ref}`, 'warning'));
          }
        });
      }

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
          if (resName && !resourceKeys.has(normalizeText(resName))) {
            errors.push(createError(`traits.${traitId}.resources[${idx}]`, `References non-existent resource: ${resName}. Valid: ${Object.keys(config.resourceSettings || {}).join(', ') || 'none'}`));
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

  // Requirement reference validation and schema validation, shared by
  // abilities.*.requirements and traits.*.requirements.
  // Schema (union of two shapes):
  //   referenced:     { type: 'resource' | 'attribute' | 'skill' | 'trait', variable: string, amount: number }
  //   characterLevel: { type: 'characterLevel', amount: number }  // no variable
  // Note: variable is required for referenced types and must be omitted for characterLevel.
  const requirementTraitKeys = config.traits ? new Set(Object.keys(config.traits)) : new Set();
  const requirementResourceKeys = buildResourceKeySet(config);
  const requirementAttributeNames = config.attributeSettings?.attributeNames
    ? new Set(config.attributeSettings.attributeNames.map(a => a.toLowerCase()))
    : new Set();

  // Valid requirement types
  const VALID_REQUIREMENT_TYPES = ['skill', 'trait', 'resource', 'attribute', 'characterLevel'];

  const validateRequirementEntry = (reqPath, req) => {
    // Validate requirement type
    if (!req.type) {
      errors.push(createError(`${reqPath}.type`, 'Missing required field: type'));
    } else if (!VALID_REQUIREMENT_TYPES.includes(req.type)) {
      errors.push(createError(`${reqPath}.type`, `Invalid requirement type: ${req.type}. Valid: ${VALID_REQUIREMENT_TYPES.join(', ')}`));
    }

    // amount is required on all requirement types
    if (req.amount === undefined) {
      errors.push(createError(`${reqPath}.amount`, 'Missing required field: amount'));
    }
    // variable is required for referenced types and must be omitted for characterLevel
    if (req.type === 'characterLevel') {
      if (req.variable !== undefined) {
        errors.push(createError(`${reqPath}.variable`, 'characterLevel requirements must not include a variable'));
      }
    } else if (req.variable === undefined) {
      errors.push(createError(`${reqPath}.variable`, 'Missing required field: variable'));
    }

    // Additional validation based on requirement type (reference checks)
    if (req.type === 'skill' && req.variable !== undefined) {
      if (!skillKeys.has(req.variable)) {
        errors.push(createError(`${reqPath}.variable`, `References non-existent skill: ${req.variable}`));
      }
    } else if (req.type === 'trait' && req.variable !== undefined) {
      if (!requirementTraitKeys.has(req.variable)) {
        errors.push(createError(`${reqPath}.variable`, `References non-existent trait: ${req.variable}`));
      }
    } else if (req.type === 'resource' && req.variable !== undefined) {
      if (!requirementResourceKeys.has(normalizeText(req.variable))) {
        errors.push(createError(`${reqPath}.variable`, `References non-existent resource: ${req.variable}. Valid: ${Object.keys(config.resourceSettings || {}).join(', ')}`));
      }
    } else if (req.type === 'attribute' && req.variable !== undefined) {
      if (!requirementAttributeNames.has(req.variable.toLowerCase())) {
        errors.push(createError(`${reqPath}.variable`, `References non-existent attribute: ${req.variable}. Valid: ${config.attributeSettings?.attributeNames?.join(', ') || 'none'}`));
      }
    }
  };

  if (config.abilities) {
    for (const [abilityId, ability] of Object.entries(config.abilities)) {
      if (ability.requirements && Array.isArray(ability.requirements)) {
        ability.requirements.forEach((req, idx) => {
          validateRequirementEntry(`abilities.${abilityId}.requirements[${idx}]`, req);
        });
      }
    }
  }

  if (config.traits) {
    for (const [traitId, trait] of Object.entries(config.traits)) {
      if (trait.requirements && Array.isArray(trait.requirements)) {
        trait.requirements.forEach((req, idx) => {
          validateRequirementEntry(`traits.${traitId}.requirements[${idx}]`, req);
        });
      }
    }
  }

  // Item bonus validation
  if (config.itemTypes) {
    const attributeNames = config.attributeSettings?.attributeNames
      ? new Set(config.attributeSettings.attributeNames.map(a => a.toLowerCase()))
      : new Set();
    const resourceKeys = buildResourceKeySet(config);
    const validBonusTypes = ['attribute', 'stat', 'resource', 'skill'];
    const validStatVariables = ['damage', 'armor', 'speed', 'health']; // common stat variables

    for (const [itemId, item] of Object.entries(config.itemTypes)) {
      if (item.bonuses && Array.isArray(item.bonuses)) {
        item.bonuses.forEach((bonus, idx) => {
          const bonusPath = `itemTypes.${itemId}.bonuses[${idx}]`;

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
              if (!resourceKeys.has(normalizeText(bonus.variable))) {
                errors.push(createError(`${bonusPath}.variable`, `Invalid resource: ${bonus.variable}. Valid: ${Object.keys(config.resourceSettings || {}).join(', ') || 'none'}`, 'warning'));
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

// Reference key sets shared by trigger effect validation and narrative event
// onCompleteEffects validation (same effect schema in both places).
function buildQuestEventRefs(config) {
  return {
    questKeys: config.quests ? new Set(Object.keys(config.quests)) : new Set(),
    narrativeEventKeys: config.narrativeEvents ? new Set(Object.keys(config.narrativeEvents)) : new Set(),
  };
}

// Validates a single trigger effect (also used for narrativeEvents.*.onCompleteEffects).
function validateTriggerEffect(effectPath, effect, refs, config, errors) {
  if (!effect || typeof effect !== 'object' || Array.isArray(effect)) {
    errors.push(createError(effectPath, `Expected effect object, got ${Array.isArray(effect) ? 'array' : typeof effect}`));
    return;
  }

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
    const isNumberEffect = ['player-resource', 'write-number', 'npc-relationship'].includes(effect.type);
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

  // target - optional, only meaningful on player-resource / player-traits effects
  if (effect.target !== undefined && !VALID_EFFECT_TARGETS.includes(effect.target)) {
    errors.push(createError(`${effectPath}.target`, `Invalid target: ${effect.target}. Valid: ${VALID_EFFECT_TARGETS.join(', ')}`));
  }

  // Quest / narrative-event effects: per-type required fields and references.
  // None of these use operator/value.
  const effectsRequiringQuestId = [
    'quest-objective-reveal',
    'quest-objective-complete',
    'quest-next-step-set',
    'quest-next-step-clear',
    'quest-complete',
  ];
  if (effectsRequiringQuestId.includes(effect.type)) {
    if (effect.questId === undefined) {
      errors.push(createError(`${effectPath}.questId`, 'Missing required field: questId'));
    } else if (!refs.questKeys.has(effect.questId)) {
      errors.push(createError(`${effectPath}.questId`, `References non-existent quest: ${effect.questId}`));
    }
  }

  if (['quest-objective-reveal', 'quest-objective-complete'].includes(effect.type)) {
    if (effect.objectiveId === undefined) {
      errors.push(createError(`${effectPath}.objectiveId`, 'Missing required field: objectiveId'));
    } else if (typeof effect.questId === 'string' && refs.questKeys.has(effect.questId)) {
      const quest = config.quests[effect.questId];
      const objectiveKeys = quest?.objectives && typeof quest.objectives === 'object' && !Array.isArray(quest.objectives)
        ? new Set(Object.keys(quest.objectives))
        : new Set();
      if (!objectiveKeys.has(effect.objectiveId)) {
        errors.push(createError(`${effectPath}.objectiveId`, `References non-existent objective "${effect.objectiveId}" in quest "${effect.questId}"`));
      }
    }
  }

  if (['quest-next-step-set', 'party-next-step-set'].includes(effect.type)) {
    if (typeof effect.text !== 'string' || effect.text === '') {
      errors.push(createError(`${effectPath}.text`, 'Missing required field: text'));
    }
    if (effect.source === undefined) {
      errors.push(createError(`${effectPath}.source`, 'Missing required field: source'));
    } else if (!VALID_NEXT_STEP_SOURCES.includes(effect.source)) {
      errors.push(createError(`${effectPath}.source`, `Invalid source: ${effect.source}. Valid: ${VALID_NEXT_STEP_SOURCES.join(', ')}`));
    }
  }

  if (effect.type === 'narrative-event-start') {
    if (effect.eventId === undefined) {
      errors.push(createError(`${effectPath}.eventId`, 'Missing required field: eventId'));
    } else if (!refs.narrativeEventKeys.has(effect.eventId)) {
      errors.push(createError(`${effectPath}.eventId`, `References non-existent narrative event: ${effect.eventId}`));
    }
  }

  if (effect.type === 'npc-relationship') {
    if (typeof effect.npc !== 'string' || effect.npc === '') {
      errors.push(createError(`${effectPath}.npc`, 'Missing required field: npc'));
    }
  }

  if (effect.type === 'music-track-set') {
    if (typeof effect.trackId !== 'string' || effect.trackId === '') {
      errors.push(createError(`${effectPath}.trackId`, 'Missing required field: trackId'));
    } else {
      const tracks = config.gameplayMusicSettings?.tracks;
      const trackKeys = tracks && typeof tracks === 'object' && !Array.isArray(tracks)
        ? Object.keys(tracks)
        : [];
      if (!trackKeys.includes(effect.trackId)) {
        errors.push(createError(`${effectPath}.trackId`, `References non-existent music track: ${effect.trackId} (not in gameplayMusicSettings.tracks)`));
      }
    }
  }

  if (['win-game', 'lose-game', 'end-game'].includes(effect.type)) {
    if (effect.endScope !== undefined && !VALID_END_GAME_SCOPES.includes(effect.endScope)) {
      errors.push(createError(`${effectPath}.endScope`, `Invalid endScope: ${effect.endScope}. Valid: ${VALID_END_GAME_SCOPES.join(', ')}`));
    }
    if (effect.othersOutcome !== undefined && !VALID_END_GAME_OUTCOMES.includes(effect.othersOutcome)) {
      errors.push(createError(`${effectPath}.othersOutcome`, `Invalid othersOutcome: ${effect.othersOutcome}. Valid: ${VALID_END_GAME_OUTCOMES.join(', ')}`));
    }
  }
}

function validateTriggers(config, errors) {
  const refs = buildQuestEventRefs(config);
  validateTriggerSection('triggers', config.triggers, refs, config, errors);
  validateTriggerSection('questTriggers', config.questTriggers, refs, config, errors);
}

// Structural rules for the authored gameplay music catalog. The section merges
// atomically on the platform, so when present it must be complete and valid on its own.
const GAMEPLAY_MUSIC_LIMITS = {
  catalogJsonLength: 250_000,
  families: 48,
  familyKeyLength: 128,
  variantsPerFamily: 12,
  matchTagsPerFamily: 24,
  matchTagLength: 64,
  urlLength: 2_048,
  characterCreationTrackIdLength: 128,
};
const VALID_GAMEPLAY_MUSIC_CUES = [
  'character-creation', 'combat', 'travel', 'near-death', 'dying', 'dead', 'recovery',
];

function validateGameplayMusicSettings(config, errors) {
  const settings = config.gameplayMusicSettings;
  if (settings === undefined) return;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    errors.push(createError('gameplayMusicSettings', `Expected object, got ${Array.isArray(settings) ? 'array' : typeof settings}`));
    return;
  }

  const catalogLength = getJsonLength(settings);
  if (catalogLength > GAMEPLAY_MUSIC_LIMITS.catalogJsonLength) {
    errors.push(createError('gameplayMusicSettings', `Catalog too large: ${catalogLength.toLocaleString()} chars (max: ${GAMEPLAY_MUSIC_LIMITS.catalogJsonLength.toLocaleString()})`));
  }

  const tracks = settings.tracks;
  if (!tracks || typeof tracks !== 'object' || Array.isArray(tracks)) {
    errors.push(createError('gameplayMusicSettings.tracks', 'Missing required field: tracks (object of track families)'));
  } else {
    const familyKeys = Object.keys(tracks);
    if (familyKeys.length === 0) {
      errors.push(createError('gameplayMusicSettings.tracks', 'Catalog must contain at least one track family (or omit gameplayMusicSettings entirely to use the engine defaults)'));
    }
    if (familyKeys.length > GAMEPLAY_MUSIC_LIMITS.families) {
      errors.push(createError('gameplayMusicSettings.tracks', `Too many track families: ${familyKeys.length} (max: ${GAMEPLAY_MUSIC_LIMITS.families})`));
    }
    for (const [familyKey, family] of Object.entries(tracks)) {
      const path = `gameplayMusicSettings.tracks.${familyKey}`;
      if (familyKey.trim() === '') {
        errors.push(createError(path, 'Track family key must be non-empty'));
      }
      if (familyKey.length > GAMEPLAY_MUSIC_LIMITS.familyKeyLength) {
        errors.push(createError(path, `Family key too long: ${familyKey.length} chars (max: ${GAMEPLAY_MUSIC_LIMITS.familyKeyLength})`));
      }
      if (!family || typeof family !== 'object' || Array.isArray(family)) {
        errors.push(createError(path, `Expected object, got ${Array.isArray(family) ? 'array' : typeof family}`));
        continue;
      }
      const variants = family.variants;
      if (!Array.isArray(variants) || variants.length === 0) {
        errors.push(createError(`${path}.variants`, 'Each track family needs at least one variant'));
      } else {
        if (variants.length > GAMEPLAY_MUSIC_LIMITS.variantsPerFamily) {
          errors.push(createError(`${path}.variants`, `Too many variants: ${variants.length} (max: ${GAMEPLAY_MUSIC_LIMITS.variantsPerFamily})`));
        }
        variants.forEach((variant, i) => {
          if (!variant || typeof variant !== 'object') return;
          const urls = ['url', 'narrationUrl', 'gameplayUrl'].map((k) => variant[k]).filter((u) => typeof u === 'string' && u !== '');
          if (urls.length === 0) {
            errors.push(createError(`${path}.variants[${i}]`, 'Variant needs at least one of url, narrationUrl, gameplayUrl'));
          }
          urls.forEach((url) => {
            if (url.length > GAMEPLAY_MUSIC_LIMITS.urlLength) {
              errors.push(createError(`${path}.variants[${i}]`, `URL too long: ${url.length} chars (max: ${GAMEPLAY_MUSIC_LIMITS.urlLength})`));
            }
            let parsed;
            try { parsed = new URL(url); } catch { parsed = undefined; }
            if (!parsed || parsed.protocol !== 'https:' || !parsed.hostname) {
              errors.push(createError(`${path}.variants[${i}]`, `Variant URLs must be https: ${url}`));
            }
          });
        });
      }
      const matchTags = family.matchTags;
      if (matchTags !== undefined) {
        if (!Array.isArray(matchTags)) {
          errors.push(createError(`${path}.matchTags`, `Expected array, got ${typeof matchTags}`));
        } else {
          if (matchTags.length > GAMEPLAY_MUSIC_LIMITS.matchTagsPerFamily) {
            errors.push(createError(`${path}.matchTags`, `Too many match tags: ${matchTags.length} (max: ${GAMEPLAY_MUSIC_LIMITS.matchTagsPerFamily})`));
          }
          matchTags.forEach((tag, i) => {
            if (typeof tag !== 'string' || tag.trim() === '') {
              errors.push(createError(`${path}.matchTags[${i}]`, 'Match tags must be non-empty strings'));
            } else if (tag.length > GAMEPLAY_MUSIC_LIMITS.matchTagLength) {
              errors.push(createError(`${path}.matchTags[${i}]`, `Match tag too long: ${tag.length} chars (max: ${GAMEPLAY_MUSIC_LIMITS.matchTagLength})`));
            }
          });
        }
      }
      const cues = family.cues;
      if (cues !== undefined && Array.isArray(cues)) {
        cues.forEach((cue, i) => {
          if (!VALID_GAMEPLAY_MUSIC_CUES.includes(cue)) {
            errors.push(createError(`${path}.cues[${i}]`, `Invalid cue: ${cue}. Valid: ${VALID_GAMEPLAY_MUSIC_CUES.join(', ')}`));
          }
        });
      }
    }
    const trackId = settings.characterCreationTrackId;
    if (typeof trackId !== 'string') {
      errors.push(createError('gameplayMusicSettings.characterCreationTrackId', 'Missing required field: characterCreationTrackId'));
    } else {
      if (trackId.length > GAMEPLAY_MUSIC_LIMITS.characterCreationTrackIdLength) {
        errors.push(createError('gameplayMusicSettings.characterCreationTrackId', `Too long: ${trackId.length} chars (max: ${GAMEPLAY_MUSIC_LIMITS.characterCreationTrackIdLength})`));
      }
      if (trackId !== '' && !Object.hasOwn(tracks ?? {}, trackId)) {
        errors.push(createError('gameplayMusicSettings.characterCreationTrackId', `References non-existent track family: ${trackId}`));
      }
    }
  }
}

// When customization is disabled, players can only pick premade characters, so the
// world must actually ship usable premades.
function validateCharacterCreationSettings(config, errors) {
  if (config.characterCreationSettings?.customizationEnabled !== false) return;

  const premades = Array.isArray(config.premadeCharacters) ? config.premadeCharacters : [];
  if (premades.length === 0) {
    errors.push(createError('premadeCharacters', 'customizationEnabled is false, so at least one premade character is required'));
    return;
  }
  const seenNames = new Set();
  premades.forEach((pc, i) => {
    const name = typeof pc?.name === 'string' ? pc.name.trim() : '';
    if (!name) {
      errors.push(createError(`premadeCharacters[${i}].name`, 'customizationEnabled is false, so every premade character needs a name'));
      return;
    }
    const normalized = name.toLowerCase();
    if (seenNames.has(normalized)) {
      errors.push(createError(`premadeCharacters[${i}].name`, `Duplicate premade character name: ${pc.name}`));
    }
    seenNames.add(normalized);
  });
}

// Trait category entries: subcategory shape plus reference integrity of trait lists
function validateTraitCategories(config, errors) {
  if (!config.traitCategories || typeof config.traitCategories !== 'object') return;
  const traitKeys = config.traits ? new Set(Object.keys(config.traits)) : new Set();

  for (const [categoryId, category] of Object.entries(config.traitCategories)) {
    if (!category || typeof category !== 'object' || Array.isArray(category)) continue;
    const basePath = `traitCategories.${categoryId}`;

    (Array.isArray(category.traits) ? category.traits : []).forEach((traitName, i) => {
      if (!traitKeys.has(traitName)) {
        errors.push(createError(`${basePath}.traits[${i}]`, `References non-existent trait: ${traitName}`));
      }
    });

    if (category.subcategories !== undefined) {
      if (!Array.isArray(category.subcategories)) {
        errors.push(createError(`${basePath}.subcategories`, `Expected array, got ${typeof category.subcategories}`));
        continue;
      }
      category.subcategories.forEach((sub, i) => {
        const subPath = `${basePath}.subcategories[${i}]`;
        if (!sub || typeof sub !== 'object' || Array.isArray(sub)) {
          errors.push(createError(subPath, `Expected object, got ${Array.isArray(sub) ? 'array' : typeof sub}`));
          return;
        }
        if (typeof sub.name !== 'string' || sub.name.trim() === '') {
          errors.push(createError(`${subPath}.name`, 'Missing required field: name'));
        }
        if (!Array.isArray(sub.traits)) {
          errors.push(createError(`${subPath}.traits`, 'Missing required field: traits (array of trait names)'));
        } else {
          sub.traits.forEach((traitName, j) => {
            if (!traitKeys.has(traitName)) {
              errors.push(createError(`${subPath}.traits[${j}]`, `References non-existent trait: ${traitName}`));
            }
          });
        }
      });
    }
  }
}

// When relationshipStages is present it must cover every score from -100 to 100 with
// no gaps or overlaps; omitting the section entirely uses the engine defaults instead.
function validateRelationshipStages(config, errors) {
  const stages = config.relationshipStages;
  if (stages === undefined) return;

  if (!Array.isArray(stages)) {
    errors.push(createError('relationshipStages', `Expected array, got ${typeof stages}`));
    return;
  }

  if (stages.length === 0) {
    errors.push(createError('relationshipStages', 'Relationship stages must cover every score from -100 to 100. Omit the section entirely to use the engine defaults.'));
    return;
  }

  const validStages = [];
  const names = new Set();

  stages.forEach((stage, index) => {
    const path = `relationshipStages[${index}]`;
    if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
      errors.push(createError(path, `Expected object, got ${Array.isArray(stage) ? 'array' : typeof stage}`));
      return;
    }

    const label = typeof stage.name === 'string' && stage.name.trim() ? `"${stage.name}"` : `${index + 1}`;

    if (typeof stage.name !== 'string' || stage.name.trim() === '') {
      errors.push(createError(`${path}.name`, `Relationship stage ${index + 1} must have a non-empty name`));
    } else {
      const normalizedName = stage.name.trim().toLowerCase();
      if (names.has(normalizedName)) {
        errors.push(createError(`${path}.name`, `Relationship stage name "${stage.name}" is duplicated`));
      }
      names.add(normalizedName);
    }

    if (typeof stage.minScore !== 'number' || typeof stage.maxScore !== 'number' ||
        !Number.isFinite(stage.minScore) || !Number.isFinite(stage.maxScore)) {
      errors.push(createError(path, `Relationship stage ${label} must use finite numeric minScore and maxScore values`));
      return;
    }

    if (!Number.isInteger(stage.minScore) || !Number.isInteger(stage.maxScore)) {
      errors.push(createError(path, `Relationship stage ${label} must use whole-number minScore and maxScore values`));
      return;
    }

    if (stage.minScore < -100 || stage.maxScore > 100) {
      errors.push(createError(path, `Relationship stage ${label} must stay within -100 to 100`));
    }

    if (stage.minScore > stage.maxScore) {
      errors.push(createError(path, `Relationship stage ${label} minScore must be less than or equal to maxScore`));
      return;
    }

    if (typeof stage.name === 'string' && stage.name.trim()) {
      validStages.push({ index, name: stage.name, minScore: stage.minScore, maxScore: stage.maxScore });
    }
  });

  if (validStages.length === 0) return;

  const sortedStages = [...validStages].sort((left, right) => left.minScore - right.minScore);
  let expectedMinScore = -100;
  for (const stage of sortedStages) {
    if (stage.minScore < expectedMinScore) {
      errors.push(createError(`relationshipStages[${stage.index}]`, `Relationship stage "${stage.name}" overlaps another stage`));
    } else if (stage.minScore > expectedMinScore) {
      errors.push(createError(`relationshipStages[${stage.index}].minScore`, `Relationship stages must cover every score from -100 to 100. Missing ${expectedMinScore} to ${stage.minScore - 1}`));
    }
    expectedMinScore = Math.max(expectedMinScore, stage.maxScore + 1);
  }

  if (expectedMinScore <= 100) {
    const lastStage = sortedStages[sortedStages.length - 1];
    errors.push(createError(`relationshipStages[${lastStage.index}].maxScore`, `Relationship stages must cover every score from -100 to 100. Missing ${expectedMinScore} to 100`));
  }
}

function validateTriggerSection(section, triggersValue, refs, config, errors) {
  if (!triggersValue) return;

  const isArrayForm = Array.isArray(triggersValue);
  const triggerEntries = isArrayForm
    ? triggersValue.map((t, i) => [i, t])
    : Object.entries(triggersValue);

  triggerEntries.forEach(([key, trigger], idx) => {
    const basePath = isArrayForm ? `${section}[${idx}]` : `${section}.${key}`;

    // Name must match object key (engine re-fires non-recurring triggers when mismatched)
    if (!isArrayForm && typeof trigger.name === 'string' && trigger.name !== key) {
      errors.push(createError(`${basePath}.name`, `Trigger name "${trigger.name}" does not match key "${key}"`));
    }

    // Validate individual trigger size
    const triggerSize = JSON.stringify(trigger).length;
    if (triggerSize > LIMITS.counts.triggerSize) {
      errors.push(createError(basePath, `Trigger exceeds ${LIMITS.counts.triggerSize} chars: ${triggerSize}`));
    }

    // Optional scope field
    if (trigger.scope !== undefined && !VALID_TRIGGER_SCOPES.includes(trigger.scope)) {
      errors.push(createError(`${basePath}.scope`, `Invalid scope: ${trigger.scope}. Valid: ${VALID_TRIGGER_SCOPES.join(', ')}`));
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
          const isStringCondition = ['story-text', 'action-text', 'party-realm', 'party-region', 'party-location', 'party-area', 'read-string', 'quest-status', 'narrative-event-status', 'npc-relationship-stage'].includes(cond.type);
          const isNumberCondition = ['player-level', 'game-tick', 'player-resource', 'read-number', 'npc-relationship'].includes(cond.type);
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

        // quest-status conditions require a questId referencing an existing quest
        if (cond.type === 'quest-status') {
          if (cond.questId === undefined) {
            errors.push(createError(`${condPath}.questId`, 'Missing required field: questId'));
          } else if (!refs.questKeys.has(cond.questId)) {
            errors.push(createError(`${condPath}.questId`, `References non-existent quest: ${cond.questId}`));
          }
          if (['equals', 'notEquals'].includes(cond.operator) && typeof cond.value === 'string' && !VALID_QUEST_STATUSES.includes(cond.value)) {
            errors.push(createError(`${condPath}.value`, `Unrecognized quest status: ${cond.value}. Known statuses: ${VALID_QUEST_STATUSES.join(', ')}`, 'warning'));
          }
        }

        // narrative-event-status conditions require an eventId referencing an existing narrative event
        if (cond.type === 'narrative-event-status') {
          if (cond.eventId === undefined) {
            errors.push(createError(`${condPath}.eventId`, 'Missing required field: eventId'));
          } else if (!refs.narrativeEventKeys.has(cond.eventId)) {
            errors.push(createError(`${condPath}.eventId`, `References non-existent narrative event: ${cond.eventId}`));
          }
          if (['equals', 'notEquals'].includes(cond.operator) && typeof cond.value === 'string' && !VALID_NARRATIVE_EVENT_STATUSES.includes(cond.value)) {
            errors.push(createError(`${condPath}.value`, `Unrecognized narrative event status: ${cond.value}. Known statuses: ${VALID_NARRATIVE_EVENT_STATUSES.join(', ')}`, 'warning'));
          }
        }

        // npc-relationship / npc-relationship-stage conditions require an npc name
        if (['npc-relationship', 'npc-relationship-stage'].includes(cond.type)) {
          if (typeof cond.npc !== 'string' || cond.npc === '') {
            errors.push(createError(`${condPath}.npc`, 'Missing required field: npc'));
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
        validateTriggerEffect(`${basePath}.effects[${effectIdx}]`, effect, refs, config, errors);
      });
    }
  });
}

function validateNarrativeEvents(config, errors) {
  if (!config.narrativeEvents) return;

  const refs = buildQuestEventRefs(config);

  for (const [eventId, event] of Object.entries(config.narrativeEvents)) {
    const basePath = `narrativeEvents.${eventId}`;

    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      errors.push(createError(basePath, `Expected object, got ${Array.isArray(event) ? 'array' : typeof event}`));
      continue;
    }

    if (typeof event.title !== 'string' || event.title.trim() === '') {
      errors.push(createError(`${basePath}.title`, 'Missing required field: title'));
    }

    if (typeof event.beats !== 'string' || event.beats.trim() === '') {
      errors.push(createError(`${basePath}.beats`, 'Missing required field: beats'));
    }

    // targetTurns - optional positive whole number
    if (event.targetTurns !== undefined &&
        (typeof event.targetTurns !== 'number' || !Number.isInteger(event.targetTurns) || event.targetTurns < 1)) {
      errors.push(createError(`${basePath}.targetTurns`, `targetTurns must be a positive whole number, got ${JSON.stringify(event.targetTurns)}`));
    }

    // onCompleteEffects - optional array validated like trigger effects
    if (event.onCompleteEffects !== undefined) {
      if (!Array.isArray(event.onCompleteEffects)) {
        errors.push(createError(`${basePath}.onCompleteEffects`, `Expected array, got ${typeof event.onCompleteEffects}`));
      } else {
        event.onCompleteEffects.forEach((effect, idx) => {
          validateTriggerEffect(`${basePath}.onCompleteEffects[${idx}]`, effect, refs, config, errors);
        });
      }
    }
  }
}

function validateArcs(config, errors) {
  if (!config.arcs) return;

  if (typeof config.arcs !== 'object' || Array.isArray(config.arcs)) {
    errors.push(createError('arcs', `Expected object, got ${Array.isArray(config.arcs) ? 'array' : typeof config.arcs}`));
    return;
  }

  for (const [arcId, arc] of Object.entries(config.arcs)) {
    if (!arc || typeof arc !== 'object' || Array.isArray(arc)) {
      errors.push(createError(`arcs.${arcId}`, `Expected object, got ${Array.isArray(arc) ? 'array' : typeof arc}`));
      continue;
    }

    if (typeof arc.id !== 'string' || arc.id.trim() === '') {
      errors.push(createError(`arcs.${arcId}.id`, 'Missing required field: id'));
    } else if (arc.id !== arcId) {
      errors.push(createError(`arcs.${arcId}.id`, `Id "${arc.id}" does not match key "${arcId}"`));
    }
  }
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

  // Check trait damage types (vulnerabilities, resistances, immunities)
  if (config.traits) {
    for (const [traitId, trait] of Object.entries(config.traits)) {
      const checkDamageArray = (field) => {
        if (trait[field] && Array.isArray(trait[field])) {
          trait[field].forEach((type, idx) => {
            if (!validDamageTypes.includes(type)) {
              errors.push(createError(`traits.${traitId}.${field}[${idx}]`, `Invalid damage type: ${type}. Valid: ${validDamageTypes.join(', ')}`));
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
  // Total config size. The platform exempts growth in engine-default AI instructions
  // ("free growth"), so the same credit is subtracted here; the platform is additionally
  // slightly more lenient because it also credits base-instruction growth shipped after
  // these checkpoints.
  const freeAiGrowth = getFreeAiInstructionsGrowth(config);
  const totalSize = getJsonLength(config) - freeAiGrowth;
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

  // Settings array count limits
  const checkArrayCount = (arr, path, limit) => {
    if (Array.isArray(arr) && arr.length > limit) {
      errors.push(createError(path, `Too many entries: ${arr.length} (max: ${limit})`));
    }
  };
  checkArrayCount(config.premadeCharacters, 'premadeCharacters', LIMITS.counts.premadeCharacters);
  checkArrayCount(config.itemSettings?.itemCategories, 'itemSettings.itemCategories', LIMITS.counts.itemCategories);
  checkArrayCount(config.itemSettings?.itemSlots, 'itemSettings.itemSlots', LIMITS.counts.itemSlots);
  checkArrayCount(config.combatSettings?.damageTypes, 'combatSettings.damageTypes', LIMITS.counts.damageTypes);
  checkArrayCount(config.attributeSettings?.attributeNames, 'attributeSettings.attributeNames', LIMITS.counts.attributeNames);

  // currencyName field limit
  if (typeof config.itemSettings?.currencyName === 'string' && config.itemSettings.currencyName.length > LIMITS.fields.currencyName) {
    errors.push(createError('itemSettings.currencyName', `Too long: ${config.itemSettings.currencyName.length} chars (max: ${LIMITS.fields.currencyName})`));
  }

  // Settings array per-entry character limits
  const checkEntryLength = (path, value, limit) => {
    if (typeof value === 'string' && value.length > limit) {
      errors.push(createError(path, `Too long: ${value.length} chars (max: ${limit})`));
    }
  };
  (config.itemSettings?.itemCategories ?? []).forEach((cat, i) =>
    checkEntryLength(`itemSettings.itemCategories[${i}]`, cat, LIMITS.settingsEntries.itemCategory));
  (config.itemSettings?.itemSlots ?? []).forEach((slot, i) => {
    if (slot && typeof slot === 'object') {
      checkEntryLength(`itemSettings.itemSlots[${i}].slot`, slot.slot, LIMITS.settingsEntries.itemSlotName);
      checkEntryLength(`itemSettings.itemSlots[${i}].category`, slot.category, LIMITS.settingsEntries.itemSlotCategory);
    }
  });
  (config.combatSettings?.damageTypes ?? []).forEach((dt, i) =>
    checkEntryLength(`combatSettings.damageTypes[${i}]`, dt, LIMITS.settingsEntries.damageType));
  (config.attributeSettings?.attributeNames ?? []).forEach((an, i) =>
    checkEntryLength(`attributeSettings.attributeNames[${i}]`, an, LIMITS.settingsEntries.attributeName));
  if (config.nameFilterSettings && typeof config.nameFilterSettings === 'object') {
    for (const [key, entry] of Object.entries(config.nameFilterSettings)) {
      if (Array.isArray(entry?.replacements)) {
        entry.replacements.forEach((rep, i) =>
          checkEntryLength(`nameFilterSettings.${key}.replacements[${i}]`, rep, LIMITS.settingsEntries.nameFilterReplacement));
      }
    }
  }
  (config.premadeCharacters ?? []).forEach((pc, i) => {
    const len = getJsonLength(pc);
    if (len > LIMITS.settingsEntries.premadeCharacter) {
      errors.push(createError(`premadeCharacters[${i}]`, `Too long: ${len} chars (max: ${LIMITS.settingsEntries.premadeCharacter})`));
    }
  });

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

  // AI instruction limits.
  // Each task's instructions may be an array of strings/objects OR an object of
  // named instruction sections ({ sectionName: text }). Check both forms, and
  // enforce the combined limit PER TASK (matches the engine).
  if (config.aiInstructions) {
    for (const [taskId, instructions] of Object.entries(config.aiInstructions)) {
      // Some tasks get a larger allowance than the standard per-task limit
      const individualLimit = taskId === 'generateNPCIntents'
        ? LIMITS.fields.aiInstructionIndividualNPCIntents
        : LIMITS.fields.aiInstructionIndividual;
      const combinedLimit = LIMITS.fields.aiInstructionCombinedByTask[taskId]
        ?? LIMITS.fields.aiInstructionCombined;
      let taskTotal = 0;
      const checkText = (label, text) => {
        if (typeof text === 'string' && text) {
          taskTotal += text.length;
          if (text.length > individualLimit) {
            errors.push(createError(label, `Instruction too long: ${text.length} chars (max: ${individualLimit})`));
          }
        }
      };
      if (Array.isArray(instructions)) {
        instructions.forEach((instr, idx) =>
          checkText(`aiInstructions.${taskId}[${idx}]`, typeof instr === 'string' ? instr : instr?.instruction));
      } else if (instructions && typeof instructions === 'object') {
        for (const [key, val] of Object.entries(instructions)) {
          checkText(`aiInstructions.${taskId}.${key}`, val);
        }
      }
      // The combined cap is measured on compact JSON of the whole task map, minus the
      // engine-default free-growth credit
      const taskJsonLength = getJsonLength(instructions);
      const chargedLength = taskJsonLength - getTaskFreeAiGrowth(taskId, taskJsonLength);
      if (chargedLength > combinedLimit) {
        errors.push(createError(`aiInstructions.${taskId}`, `Combined task instructions too long: ${chargedLength} chars (max: ${combinedLimit})`));
      }
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

  checkEntryField('itemTypes', config.itemTypes, 'description', LIMITS.fields.itemDescription);
  checkEntryField('factions', config.factions, 'basicInfo', LIMITS.fields.factionBasicInfo);
  checkEntryField('factions', config.factions, 'hiddenInfo', LIMITS.fields.factionHiddenInfo);
  checkEntryField('npcTypes', config.npcTypes, 'description', LIMITS.fields.npcTypeDescription);
  checkEntryField('regions', config.regions, 'basicInfo', LIMITS.fields.regionBasicInfo);
  checkEntryField('regions', config.regions, 'hiddenInfo', LIMITS.fields.regionHiddenInfo);
  checkEntryField('locations', config.locations, 'basicInfo', LIMITS.fields.locationBasicInfo);
  checkEntryField('locations', config.locations, 'hiddenInfo', LIMITS.fields.locationHiddenInfo);
  if (config.traits && typeof config.traits === 'object') {
    for (const [traitId, trait] of Object.entries(config.traits)) {
      if (!trait || typeof trait !== 'object') continue;
      const descLen = typeof trait.description === 'string' ? trait.description.length : 0;
      const effectsLen = typeof trait.traitNarrativeEffects === 'string' ? trait.traitNarrativeEffects.length : 0;
      const combined = descLen + effectsLen;
      if (combined > LIMITS.fields.traitTextTotal) {
        errors.push(createError(`traits.${traitId}`, `Combined description and traitNarrativeEffects too long: ${combined} chars (max: ${LIMITS.fields.traitTextTotal})`));
      }
    }
  }
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

  // Trait requirements count
  if (config.traits) {
    for (const [traitId, trait] of Object.entries(config.traits)) {
      if (trait.requirements?.length > LIMITS.counts.traitRequirements) {
        errors.push(createError(`traits.${traitId}.requirements`, `Too many requirements: ${trait.requirements.length} (max: ${LIMITS.counts.traitRequirements})`));
      }
    }
  }

  // Starting trait selections: sum of maxSelections across all trait categories,
  // and each premade character's traits array, must stay within the same cap.
  if (config.traitCategories && typeof config.traitCategories === 'object') {
    const totalSelections = Object.values(config.traitCategories).reduce((sum, category) => {
      const n = category?.maxSelections;
      return sum + (typeof n === 'number' && n > 0 ? n : 0);
    }, 0);
    if (totalSelections > LIMITS.counts.startingTraitSelections) {
      errors.push(createError('traitCategories', `Too many starting trait selections: ${totalSelections} (max: ${LIMITS.counts.startingTraitSelections}, sum of maxSelections across all categories)`));
    }
  }
  (config.premadeCharacters ?? []).forEach((pc, i) => {
    if (Array.isArray(pc?.traits) && pc.traits.length > LIMITS.counts.startingTraitSelections) {
      errors.push(createError(`premadeCharacters[${i}].traits`, `Too many traits: ${pc.traits.length} (max: ${LIMITS.counts.startingTraitSelections})`));
    }
  });
}

function validateTypeChecks(config, errors) {
  // The V36 schema only accepts the literal 36
  if (config.heroesVersion !== undefined && config.heroesVersion !== 36) {
    errors.push(createError('heroesVersion', `Invalid heroesVersion: ${JSON.stringify(config.heroesVersion)} (must be the number 36)`));
  }

  // imageModelSource replaced the old imageModelSources object; it is a plain string id
  if (config.imageModelSource !== undefined && typeof config.imageModelSource !== 'string') {
    errors.push(createError('imageModelSource', `Expected string, got ${Array.isArray(config.imageModelSource) ? 'array' : typeof config.imageModelSource}`));
  }

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
      const validResourceKeys = buildResourceKeySet(config);
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
              if (!validResourceKeys.has(normalizeText(modifier.variable))) {
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
    checkNumber('otherSettings.npcHealthPerLevel', os.npcHealthPerLevel);
    checkNumber('otherSettings.npcMinHealth', os.npcMinHealth);
    checkBoolean('otherSettings.visualNovelModeByDefault', os.visualNovelModeByDefault);
  }

  // locationSettings
  if (config.locationSettings) {
    const ls = config.locationSettings;
    checkNumber('locationSettings.regionSize', ls.regionSize);
    checkNumber('locationSettings.simpleRadius', ls.simpleRadius);
    checkNumber('locationSettings.complexRadius', ls.complexRadius);
    checkNumber('locationSettings.regionLocationCount', ls.regionLocationCount);
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
      if (trait.traitNarrativeEffects === undefined) {
        errors.push(createError(`traits.${traitId}.traitNarrativeEffects`, 'Missing required field: traitNarrativeEffects'));
      } else {
        checkString(`traits.${traitId}.traitNarrativeEffects`, trait.traitNarrativeEffects);
      }
      if (trait.requirements === undefined) {
        errors.push(createError(`traits.${traitId}.requirements`, 'Missing required field: requirements (use empty array [] if none)'));
      } else {
        checkArray(`traits.${traitId}.requirements`, trait.requirements);
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

function validateProgressionSettings(config, errors) {
  if (!config.progressionSettings) return;
  const ps = config.progressionSettings;

  // All numeric fields must be positive whole numbers, except
  // extraRequiredXPPerCharacterLevel which may be 0 (flat XP curve).
  const positiveIntFields = [
    'startingCharacterLevelUpRequirement',
    'maxCharacterLevel',
    'abilityPointEveryLevels',
    'abilityPointsPerGrant',
    'attributePointEveryLevels',
    'attributePointsPerGrant',
    'maxAttributeValue',
    'traitPickEveryLevels',
    'traitPicksPerGrant',
    'locationDiscoveryXP',
  ];
  for (const field of positiveIntFields) {
    const value = ps[field];
    if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value) || value < 1)) {
      errors.push(createError(`progressionSettings.${field}`, `Must be a positive whole number (>= 1), got ${JSON.stringify(value)}`));
    }
  }
  const extraXP = ps.extraRequiredXPPerCharacterLevel;
  if (extraXP !== undefined && (typeof extraXP !== 'number' || !Number.isInteger(extraXP) || extraXP < 0)) {
    errors.push(createError('progressionSettings.extraRequiredXPPerCharacterLevel', `Must be a non-negative whole number (>= 0), got ${JSON.stringify(extraXP)}`));
  }

  // levelUpTraitPool - each entry must reference an existing trait (exact key match first, then name match)
  if (ps.levelUpTraitPool !== undefined) {
    if (!Array.isArray(ps.levelUpTraitPool)) {
      errors.push(createError('progressionSettings.levelUpTraitPool', `Expected array, got ${typeof ps.levelUpTraitPool}`));
    } else {
      const traitKeys = config.traits ? new Set(Object.keys(config.traits)) : new Set();
      const traitNames = config.traits
        ? new Set(Object.values(config.traits).map((t) => t?.name).filter((n) => typeof n === 'string'))
        : new Set();
      ps.levelUpTraitPool.forEach((traitRef, idx) => {
        if (typeof traitRef !== 'string') {
          errors.push(createError(`progressionSettings.levelUpTraitPool[${idx}]`, `Expected string, got ${typeof traitRef}`));
        } else if (!traitKeys.has(traitRef) && !traitNames.has(traitRef)) {
          errors.push(createError(`progressionSettings.levelUpTraitPool[${idx}]`, `References non-existent trait: ${traitRef}`));
        }
      });
    }
  }

  // milestoneTitles - array of { levelGranted, title } with unique levels
  if (ps.milestoneTitles !== undefined) {
    if (!Array.isArray(ps.milestoneTitles)) {
      errors.push(createError('progressionSettings.milestoneTitles', `Expected array, got ${typeof ps.milestoneTitles}`));
    } else {
      const seenLevels = new Map();
      ps.milestoneTitles.forEach((milestone, idx) => {
        const milestonePath = `progressionSettings.milestoneTitles[${idx}]`;
        if (!milestone || typeof milestone !== 'object' || Array.isArray(milestone)) {
          errors.push(createError(milestonePath, `Expected object with { levelGranted, title }, got ${Array.isArray(milestone) ? 'array' : typeof milestone}`));
          return;
        }
        const level = milestone.levelGranted;
        if (level === undefined) {
          errors.push(createError(`${milestonePath}.levelGranted`, 'Missing required field: levelGranted'));
        } else if (typeof level !== 'number' || !Number.isInteger(level) || level < 1) {
          errors.push(createError(`${milestonePath}.levelGranted`, `Must be a positive whole number (>= 1), got ${JSON.stringify(level)}`));
        } else if (seenLevels.has(level)) {
          errors.push(createError(`${milestonePath}.levelGranted`, `Duplicate levelGranted ${level} (also used at milestoneTitles[${seenLevels.get(level)}])`));
        } else {
          seenLevels.set(level, idx);
        }
        if (milestone.title === undefined) {
          errors.push(createError(`${milestonePath}.title`, 'Missing required field: title'));
        } else if (typeof milestone.title !== 'string' || milestone.title.trim() === '') {
          errors.push(createError(`${milestonePath}.title`, 'title must be a non-empty string'));
        }
      });
    }
  }
}

function validateUnknownFields(config, errors) {
  // Known fields per entity type
  const KNOWN_FIELDS = {
    npcs: new Set([
      'name', 'properName', 'type', 'currentLocation', 'currentArea', 'gender', 'faction',
      'basicInfo', 'hiddenInfo', 'visualDescription', 'visualTags', 'personality',
      'abilities', 'aliases', 'level', 'hpMax', 'hpCurrent', 'healthMultiplier', 'tier', 'vulnerabilities',
      'resistances', 'immunities', 'activeBuffs', 'known', 'lastSeenLocation',
      'lastSeenArea', 'currentCoordinates', 'detailType', 'voiceTag',
      'questOriginArcId', 'questOriginQuestId', 'embedding',
      'embeddingId', 'portraitUrl', 'portraitFocusX', 'portraitFocusY', 'portraitZoom',
      'needsDetailGeneration', 'deathXPAwarded', 'worldVoiceId',
    ]),
    locations: new Set([
      'name', 'basicInfo', 'x', 'y', 'radius', 'region', 'complexityType',
      'detailType', 'areas', 'factions', 'hiddenInfo', 'visualTags', 'images',
      'embeddingId', 'known', 'npcLevelRange', 'visited', 'lastVisitedTick', 'visitedAreas',
      'questOriginArcId', 'questOriginQuestId',
    ]),
    regions: new Set([
      'name', 'basicInfo', 'x', 'y', 'realm', 'factions', 'hiddenInfo', 'known', 'npcLevelRange', 'images',
    ]),
    realms: new Set([
      'name', 'basicInfo', 'known',
    ]),
    factions: new Set([
      'name', 'basicInfo', 'factionType', 'hiddenInfo', 'embeddingId', 'detailType', 'known',
    ]),
    itemTypes: new Set([
      'name', 'category', 'description', 'bonuses', 'slot', 'mediaContent',
      'imageUrl', 'imageFocusX', 'imageFocusY', 'imageZoom',
    ]),
    abilities: new Set([
      'name', 'description', 'requirements', 'bonus', 'cooldown',
    ]),
    skills: new Set([
      'name', 'attribute', 'type', 'description', 'startingItems',
    ]),
    traits: new Set([
      'name', 'description', 'traitNarrativeEffects', 'attributes', 'skills', 'resources',
      'startingItems', 'abilities', 'unlockedBy', 'excludedBy', 'requirements',
      'vulnerabilities', 'resistances', 'immunities',
    ]),
    npcTypes: new Set([
      'name', 'description', 'vulnerabilities', 'resistances', 'immunities',
    ]),
    quests: new Set([
      'name', 'questType', 'questSource', 'questStatement', 'mainObjective', 'completionCondition',
      'questGiverNPC', 'questDesignBrief', 'conclusive', 'detailType', 'spatialRelationship', 'questLocation',
      'objectives', 'activeObjectiveId', 'nextStep',
    ]),
    storyStarts: new Set([
      'name', 'description', 'storyStart', 'locations', 'locationAreas',
      'startingQuests', 'firstQuest', 'startingItems', 'startingPartyNPCs', 'isDefault',
      'questGenerationGuidance', 'allowPlayerInput',
    ]),
    worldLore: new Set([
      'text', 'embeddingId',
    ]),
    triggers: new Set([
      'name', 'conditions', 'effects', 'recurring', 'script', 'embeddingId', 'scope',
    ]),
    narrativeEvents: new Set([
      'title', 'beats', 'targetTurns', 'onCompleteEffects',
    ]),
  };

  // Settings sub-objects
  const KNOWN_SETTINGS_FIELDS = {
    attributeSettings: new Set([
      'attributeNames', 'startingAttributeValue', 'startingAttributePoints',
      'maxStartingAttribute', 'attributeBonusModifier', 'lowAttributeThreshold',
      'lowAttributeTraits', 'attributeStatModifiers',
      'attributeDamageModifiers', 'attributeDamageReductionModifiers',
    ]),
    skillSettings: new Set([
      'trainingCooldown', 'skillBonusModifier', 'maxSkillLevel', 'maxSkillSuccessLevel',
      'startingXPToLevelUpSkill', 'additionalXPRequiredPerSkillLevel',
      'baseXPFromSkillUpgrade', 'charXPPerSkillLevel', 'baseChanceToLearnNewSkill',
      'skillLearningBonusModifier', 'xpFromNewSkill', 'skillTypeDifficultyBonus',
      'skillXPRewards', 'newSkillGenerationEnabled',
    ]),
    locationSettings: new Set([
      'regionSize', 'simpleRadius', 'complexRadius', 'regionLocationCount',
      'avgTravelDistance', 'minTravelDistance', 'newRegionGenerationEnabled', 'encountersEnabled',
      'regionMapBorderFeatheringEnabled',
    ]),
    itemSettings: new Set([
      'currencyName', 'startingItems', 'itemCategories', 'itemSlots',
    ]),
    combatSettings: new Set([
      'baseCombatXP', 'minCombatXP', 'abilityCooldown', 'abilityBonus',
      'npcDailyHealingAmount', 'damageTypes', 'damageTypePresentation',
    ]),
    otherSettings: new Set([
      'npcHealthPerLevel', 'npcMinHealth', 'visualNovelModeByDefault',
    ]),
    progressionSettings: new Set([
      'startingCharacterLevelUpRequirement', 'extraRequiredXPPerCharacterLevel',
      'maxCharacterLevel', 'abilityPointEveryLevels', 'abilityPointsPerGrant',
      'attributePointEveryLevels', 'attributePointsPerGrant', 'maxAttributeValue',
      'traitPickEveryLevels', 'traitPicksPerGrant', 'locationDiscoveryXP',
      'levelUpTraitPool', 'milestoneTitles',
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
    locationArea: new Set(['name', 'description', 'paths', 'images', 'visualTags']),
    // Scene images: { crop: { focus: { x, y }, zoom }, imageUrl? } keyed by shot name
    locationImages: new Set(['establishingShot']),
    regionImages: new Set(['map']),
    sceneImage: new Set(['crop', 'imageUrl']),
    // Premade characters (array entries)
    premadeCharacter: new Set([
      'name', 'gender', 'description', 'attributes', 'traits', 'backstory', 'portraitUrl',
      'portraitFocusX', 'portraitFocusY', 'portraitZoom', 'replacesNpc',
      'generatedBackground', 'generatedAppearance', 'voiceTag', 'worldVoiceId',
    ]),
    // World voices (label, not name: ids are referenced from NPCs and premades)
    worldVoice: new Set(['label', 'voiceTag', 'instructions', 'speed', 'effects', 'exposeInCharacterCreation']),
    worldVoiceEffects: new Set(['pitch', 'reverb', 'echo', 'eq', 'distortion', 'output']),
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
    triggerCondition: new Set(['type', 'operator', 'value', 'query', 'embeddingId', 'resource', 'entity', 'key', 'questId', 'eventId', 'npc']),
    // Trigger effects (union of all effect types)
    triggerEffect: new Set(['type', 'operator', 'value', 'instruction', 'questId', 'resource', 'entity', 'key', 'objectiveId', 'text', 'source', 'eventId', 'target', 'npc', 'trackId', 'endScope', 'othersOutcome']),
    // Attribute stat modifier entries
    attrStatModifier: new Set(['variable', 'amount']),
    // Game mode entries
    gameMode: new Set(['name', 'description', 'instructions', 'difficulty', 'askTheNarratorPrompt', 'npcIntentInstructions']),
    // Image prompt configuration (per entity type)
    imagePromptConfiguration: new Set(['npcs', 'locations', 'areas', 'regions', 'items']),
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

  // Scene images ({ crop: { focus: { x, y }, zoom }, imageUrl? }) on locations, areas, regions.
  // The old flat imageUrl/imageFocusX/imageFocusY/imageZoom fields only survive on itemTypes.
  const LEGACY_IMAGE_FIELDS = ['imageUrl', 'imageFocusX', 'imageFocusY', 'imageZoom'];
  const warnRange = (path, value, min, max) => {
    if (typeof value === 'number' && (value < min || value > max)) {
      errors.push(createError(path, `Value ${value} is outside ${min}..${max} and will be clamped by the engine`, 'warning'));
    }
  };
  const checkSceneImage = (path, image) => {
    if (!image || typeof image !== 'object' || Array.isArray(image)) {
      errors.push(createError(path, `Expected object with { crop: { focus: { x, y }, zoom }, imageUrl? }, got ${Array.isArray(image) ? 'array' : typeof image}`));
      return;
    }
    checkNested(path, image, KNOWN_NESTED.sceneImage);
    const crop = image.crop;
    if (!crop || typeof crop !== 'object' || Array.isArray(crop)) {
      errors.push(createError(`${path}.crop`, 'Missing required field: crop ({ focus: { x, y }, zoom })'));
    } else {
      checkNested(`${path}.crop`, crop, new Set(['focus', 'zoom']));
      const focus = crop.focus;
      if (!focus || typeof focus !== 'object' || Array.isArray(focus)) {
        errors.push(createError(`${path}.crop.focus`, 'Missing required field: focus ({ x, y })'));
      } else {
        checkNested(`${path}.crop.focus`, focus, new Set(['x', 'y']));
        for (const axis of ['x', 'y']) {
          if (typeof focus[axis] !== 'number') {
            errors.push(createError(`${path}.crop.focus.${axis}`, `Expected number, got ${typeof focus[axis]}`));
          } else {
            warnRange(`${path}.crop.focus.${axis}`, focus[axis], 0, 100);
          }
        }
      }
      if (typeof crop.zoom !== 'number') {
        errors.push(createError(`${path}.crop.zoom`, `Expected number, got ${typeof crop.zoom}`));
      } else {
        warnRange(`${path}.crop.zoom`, crop.zoom, 100, 300);
      }
    }
    if (image.imageUrl !== undefined && typeof image.imageUrl !== 'string') {
      errors.push(createError(`${path}.imageUrl`, `Expected string, got ${typeof image.imageUrl}`));
    }
  };
  const checkImages = (path, entity, knownShots, hint) => {
    for (const legacy of LEGACY_IMAGE_FIELDS) {
      if (entity[legacy] !== undefined) {
        errors.push(createError(`${path}.${legacy}`, `"${legacy}" was removed - use ${hint} = { crop: { focus: { x, y }, zoom }, imageUrl } instead`));
      }
    }
    if (entity.images === undefined) return;
    if (!entity.images || typeof entity.images !== 'object' || Array.isArray(entity.images)) {
      errors.push(createError(`${path}.images`, `Expected object, got ${Array.isArray(entity.images) ? 'array' : typeof entity.images}`));
      return;
    }
    for (const [shot, image] of Object.entries(entity.images)) {
      if (!knownShots.has(shot)) {
        errors.push(createError(`${path}.images.${shot}`, `Unknown image key "${shot}" - valid: ${[...knownShots].join(', ')}`, 'warning'));
        continue;
      }
      checkSceneImage(`${path}.images.${shot}`, image);
    }
  };

  // Location areas
  if (config.locations) {
    for (const [locKey, loc] of Object.entries(config.locations)) {
      if (!loc || typeof loc !== 'object') continue;
      checkImages(`locations.${locKey}`, loc, KNOWN_NESTED.locationImages, 'images.establishingShot');
      if (loc.areas && typeof loc.areas === 'object') {
        for (const [areaKey, area] of Object.entries(loc.areas)) {
          if (area && typeof area === 'object') {
            checkNested(`locations.${locKey}.areas.${areaKey}`, area, KNOWN_NESTED.locationArea);
            checkImages(`locations.${locKey}.areas.${areaKey}`, area, KNOWN_NESTED.locationImages, 'images.establishingShot');
          }
        }
      }
    }
  }
  if (config.regions) {
    for (const [regionKey, region] of Object.entries(config.regions)) {
      if (!region || typeof region !== 'object') continue;
      checkImages(`regions.${regionKey}`, region, KNOWN_NESTED.regionImages, 'images.map');
    }
  }

  // Portrait crop fields share the scene-image ranges (focus 0..100, zoom 100..300)
  const checkPortraitCrop = (path, entity) => {
    warnRange(`${path}.portraitFocusX`, entity.portraitFocusX, 0, 100);
    warnRange(`${path}.portraitFocusY`, entity.portraitFocusY, 0, 100);
    warnRange(`${path}.portraitZoom`, entity.portraitZoom, 100, 300);
  };
  if (config.npcs) {
    for (const [npcKey, npc] of Object.entries(config.npcs)) {
      if (npc && typeof npc === 'object') checkPortraitCrop(`npcs.${npcKey}`, npc);
    }
  }

  // Premade characters
  if (Array.isArray(config.premadeCharacters)) {
    config.premadeCharacters.forEach((pc, i) => {
      if (!pc || typeof pc !== 'object') return;
      checkNested(`premadeCharacters[${i}]`, pc, KNOWN_NESTED.premadeCharacter);
      checkPortraitCrop(`premadeCharacters[${i}]`, pc);
    });
  }

  // World voices: sanitized by the engine (truncate/clamp/drop), so limit overruns are warnings
  if (config.worldVoices !== undefined) {
    const voices = config.worldVoices;
    if (!voices || typeof voices !== 'object' || Array.isArray(voices)) {
      errors.push(createError('worldVoices', `Expected object keyed by voice id, got ${Array.isArray(voices) ? 'array' : typeof voices}`));
    } else {
      const voiceEntries = Object.entries(voices);
      if (voiceEntries.length > LIMITS.counts.worldVoices) {
        errors.push(createError('worldVoices', `Too many voices: ${voiceEntries.length} (max: ${LIMITS.counts.worldVoices}); the engine keeps only the first ${LIMITS.counts.worldVoices}`, 'warning'));
      }
      const warnLength = (path, value, limit) => {
        if (typeof value === 'string' && value.length > limit) {
          errors.push(createError(path, `Too long: ${value.length} chars (max: ${limit}); the engine truncates it`, 'warning'));
        }
      };
      for (const [voiceId, voice] of voiceEntries) {
        const path = `worldVoices.${voiceId}`;
        if (!voice || typeof voice !== 'object' || Array.isArray(voice)) {
          errors.push(createError(path, `Expected object, got ${Array.isArray(voice) ? 'array' : typeof voice}`));
          continue;
        }
        checkNested(path, voice, KNOWN_NESTED.worldVoice);
        for (const field of ['label', 'voiceTag']) {
          if (typeof voice[field] !== 'string' || voice[field].trim() === '') {
            errors.push(createError(`${path}.${field}`, `Missing required field: ${field}`));
          }
        }
        warnLength(`${path}.label`, voice.label, LIMITS.fields.worldVoiceLabel);
        warnLength(`${path}.voiceTag`, voice.voiceTag, LIMITS.fields.worldVoiceTag);
        if (voice.instructions !== undefined && typeof voice.instructions !== 'string') {
          errors.push(createError(`${path}.instructions`, `Expected string, got ${typeof voice.instructions}`));
        }
        warnLength(`${path}.instructions`, voice.instructions, LIMITS.fields.worldVoiceInstructions);
        if (voice.speed !== undefined && typeof voice.speed !== 'number') {
          errors.push(createError(`${path}.speed`, `Expected number, got ${typeof voice.speed}`));
        }
        warnRange(`${path}.speed`, voice.speed, 0.5, 2);
        if (voice.exposeInCharacterCreation !== undefined && typeof voice.exposeInCharacterCreation !== 'boolean') {
          errors.push(createError(`${path}.exposeInCharacterCreation`, `Expected boolean, got ${typeof voice.exposeInCharacterCreation}`));
        }
        if (voice.effects !== undefined) {
          if (!voice.effects || typeof voice.effects !== 'object' || Array.isArray(voice.effects)) {
            errors.push(createError(`${path}.effects`, `Expected object, got ${Array.isArray(voice.effects) ? 'array' : typeof voice.effects}`));
          } else {
            checkNested(`${path}.effects`, voice.effects, KNOWN_NESTED.worldVoiceEffects);
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
  if (config.itemTypes) {
    for (const [itemKey, item] of Object.entries(config.itemTypes)) {
      if (Array.isArray(item.bonuses)) {
        item.bonuses.forEach((bonus, i) => {
          checkNested(`itemTypes.${itemKey}.bonuses[${i}]`, bonus, KNOWN_NESTED.itemBonus);
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

  // Narrative event onCompleteEffects (same shape as trigger effects)
  if (config.narrativeEvents) {
    for (const [eventKey, event] of Object.entries(config.narrativeEvents)) {
      if (Array.isArray(event?.onCompleteEffects)) {
        event.onCompleteEffects.forEach((eff, i) => {
          checkNested(`narrativeEvents.${eventKey}.onCompleteEffects[${i}]`, eff, KNOWN_NESTED.triggerEffect);
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

  // Game modes
  if (config.gameModes && typeof config.gameModes === 'object') {
    const VALID_GAME_MODE_DIFFICULTIES = ['very easy', 'easy', 'medium', 'hard', 'very hard'];
    const gameModesJson = JSON.stringify(config.gameModes, null, 2);
    if (gameModesJson.length > 100000) {
      errors.push(createError('gameModes', `Game modes exceed 100,000 characters: ${gameModesJson.length}`));
    }
    for (const [modeKey, mode] of Object.entries(config.gameModes)) {
      if (!mode || typeof mode !== 'object') continue;
      checkNested(`gameModes.${modeKey}`, mode, KNOWN_NESTED.gameMode);
      for (const field of ['name', 'description', 'instructions']) {
        if (typeof mode[field] !== 'string' || mode[field].length === 0) {
          errors.push(createError(`gameModes.${modeKey}.${field}`, `Missing required field: ${field}`));
        }
      }
      if (mode.difficulty !== undefined && !VALID_GAME_MODE_DIFFICULTIES.includes(mode.difficulty)) {
        errors.push(createError(`gameModes.${modeKey}.difficulty`, `Invalid difficulty: ${mode.difficulty}. Valid: ${VALID_GAME_MODE_DIFFICULTIES.join(', ')}`, 'warning'));
      }
      if (mode.npcIntentInstructions !== undefined) {
        if (typeof mode.npcIntentInstructions !== 'string') {
          errors.push(createError(`gameModes.${modeKey}.npcIntentInstructions`, `Expected string, got ${typeof mode.npcIntentInstructions}`));
        } else if (mode.npcIntentInstructions.length > LIMITS.fields.gameModeNpcIntentInstructions) {
          errors.push(createError(`gameModes.${modeKey}.npcIntentInstructions`, `Too long: ${mode.npcIntentInstructions.length} chars (max: ${LIMITS.fields.gameModeNpcIntentInstructions})`));
        }
      }
    }
  }

  // Image prompt configuration
  if (config.imagePromptConfiguration && typeof config.imagePromptConfiguration === 'object') {
    checkNested('imagePromptConfiguration', config.imagePromptConfiguration, KNOWN_NESTED.imagePromptConfiguration);
    const MAX_IMAGE_PROMPT_INSTRUCTION = 5_000;
    const MAX_IMAGE_PROMPT_TOTAL = 15_000;
    let imagePromptTotal = 0;
    for (const entityType of ['npcs', 'locations', 'areas', 'regions', 'items']) {
      const prompt = config.imagePromptConfiguration[entityType];
      if (typeof prompt !== 'string') continue;
      imagePromptTotal += prompt.length;
      if (prompt.length > MAX_IMAGE_PROMPT_INSTRUCTION) {
        errors.push(createError(`imagePromptConfiguration.${entityType}`, `Exceeds ${MAX_IMAGE_PROMPT_INSTRUCTION} chars: ${prompt.length}`));
      }
    }
    if (imagePromptTotal > MAX_IMAGE_PROMPT_TOTAL) {
      errors.push(createError('imagePromptConfiguration', `Total exceeds ${MAX_IMAGE_PROMPT_TOTAL} chars: ${imagePromptTotal}`));
    }
  }

  // Character creation music
  if (config.characterCreationMusic !== undefined &&
      !['fantasy', 'nonfantasy'].includes(config.characterCreationMusic)) {
    errors.push(createError('characterCreationMusic', `Invalid characterCreationMusic: ${config.characterCreationMusic}. Valid: fantasy, nonfantasy`));
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
    'itemTypes',
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
    'questTriggers',
    'quests',
    'traitCategories',
    'resourceSettings',
    'gameModes',
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
  const VALID_COMPLEXITY_TYPES = ['simple', 'complex', 'wilderness'];
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
    } else if (typeof location.radius === 'number' && !(location.radius > 0)) {
      errors.push(createError(`locations.${locId}.radius`, `Radius must be greater than 0, got ${location.radius}`));
    }
    for (const axis of ['x', 'y']) {
      if (typeof location[axis] === 'number' && !Number.isFinite(location[axis])) {
        errors.push(createError(`locations.${locId}.${axis}`, `Coordinate must be a finite number, got ${location[axis]}`));
      }
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

    // Check bounds: the engine invariant is on the center only (|x|, |y| <= regionSize / 2)
    // and is reported as a warning, not a rejection
    if (Math.abs(x) > halfSize) {
      errors.push(createError(
        `locations.${locId}.x`,
        `Location x (${x}) exceeds region bounds (-${halfSize} to ${halfSize})`,
        'warning'
      ));
    }

    if (Math.abs(y) > halfSize) {
      errors.push(createError(
        `locations.${locId}.y`,
        `Location y (${y}) exceeds region bounds (-${halfSize} to ${halfSize})`,
        'warning'
      ));
    }
  }

  // Region coordinates must be finite numbers
  for (const [regionId, region] of Object.entries(config.regions ?? {})) {
    if (!region || typeof region !== 'object') continue;
    for (const axis of ['x', 'y']) {
      if (region[axis] !== undefined && (typeof region[axis] !== 'number' || !Number.isFinite(region[axis]))) {
        errors.push(createError(`regions.${regionId}.${axis}`, `Coordinate must be a finite number, got ${JSON.stringify(region[axis])}`));
      }
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

  validateRequiredFields(config, errors);
  validateReferenceIntegrity(config, errors);
  validateTriggers(config, errors);
  validateRelationshipStages(config, errors);
  validateGameplayMusicSettings(config, errors);
  validateCharacterCreationSettings(config, errors);
  validateTraitCategories(config, errors);
  validateNarrativeEvents(config, errors);
  validateArcs(config, errors);
  validateDamageTypes(config, errors);
  validateCharacterLimits(config, errors, warnings);
  validateTypeChecks(config, errors);
  validateProgressionSettings(config, errors);
  validateNameKeyMatch(config, errors);
  validateLocationRequiredFields(config, errors);
  validateRealmRequiredFields(config, errors);
  validateLocationCoordinates(config, errors);
  validateUnknownFields(config, errors);

  // Checks tagged with severity 'warning' mirror engine sanitization (clamp/truncate/drop)
  // rather than rejection, so they must not fail validation.
  const hardErrors = errors.filter((e) => e.severity !== 'warning');
  const softWarnings = [...warnings, ...errors.filter((e) => e.severity === 'warning')];
  return { errors: hardErrors, warnings: softWarnings };
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
