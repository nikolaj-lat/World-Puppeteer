const {
  AI_INSTRUCTION_LEAF_LIMIT,
  AI_INSTRUCTION_TASK_LIMIT,
} = require('./ai-instruction-limits.cjs');

const CURRENT_VOYAGE_SCHEMA_VERSION = 'V34';

const V33_TRIGGER_CONDITION_TYPES = [
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

const V34_TRIGGER_CONDITION_TYPES = [
  ...V33_TRIGGER_CONDITION_TYPES,
  'quest-status',
  'narrative-event-status',
];

const V33_TRIGGER_EFFECT_TYPES = [
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

const V34_TRIGGER_EFFECT_TYPES = [
  'story',
  'quest-progress',
  'quest-objective-reveal',
  'quest-objective-complete',
  'quest-next-step-set',
  'quest-next-step-clear',
  'party-next-step-set',
  'party-next-step-clear',
  'quest-complete',
  'narrative-event-start',
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

const V33_REQUIRED_TOP_LEVEL = [
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

const V34_REQUIRED_TOP_LEVEL = [
  ...V33_REQUIRED_TOP_LEVEL.slice(0, 18),
  'narrativeEvents',
  ...V33_REQUIRED_TOP_LEVEL.slice(18, -1),
  'embeddingModel',
  'embeddingDimension',
  'mods',
];

const V33_LIMITS = {
  total: 10_000_000,
  sections: {
    worldLore: 500_000,
    npcs: 1_000_000,
    locations: 1_000_000,
    npcTypes: 500_000,
    items: 100_000,
    factions: 100_000,
    regions: 500_000,
    realms: 100_000,
    traitCategories: 100_000,
    itemSettings: 5_000,
    gameModes: 100_000,
    nameFilterSettings: 50_000,
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
    premadeCharacters: 100,
    itemCategories: 40,
    itemSlots: 60,
    damageTypes: 40,
    attributeNames: 30,
  },
  fields: {
    worldBackground: 5_000,
    questGenerationGuidance: 5_000,
    narratorStyle: 2_000,
    deathInstructions: 4_000,
    aiInstructionIndividual: AI_INSTRUCTION_LEAF_LIMIT,
    aiInstructionCombined: AI_INSTRUCTION_TASK_LIMIT,
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
    currencyName: 64,
    gameModeName: 120,
    gameModeDescription: 500,
    gameModeInstructions: 5_000,
    gameModeAskTheNarratorPrompt: 1_000,
    imagePromptInstruction: 5_000,
    imagePromptTotal: 15_000,
  },
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

const V34_LIMITS = {
  ...V33_LIMITS,
  sections: {
    ...V33_LIMITS.sections,
    nameFilterSettings: 150_000,
  },
  counts: {
    ...V33_LIMITS.counts,
    // Wiki size-limits (snapshot 2026-07-06): per-trigger 10,000 compact JSON.
    triggerSize: 10_000,
  },
  fields: {
    ...V33_LIMITS.fields,
    // Wiki size-limits (snapshot 2026-07-06): npc entry 8,000 compact JSON,
    // storyStart entry 8,000 pretty JSON.
    npcCombined: 8_000,
    storyStartEntry: 8_000,
    triggerConditionText: 1_000,
    triggerConditionQuery: 1_000,
    triggerEffectText: 1_000,
    triggerEffectInstruction: 1_000,
  },
};

const VOYAGE_SCHEMA_RULES = {
  V33: {
    version: 'V33',
    heroesVersion: 33,
    requiredTopLevel: V33_REQUIRED_TOP_LEVEL,
    triggerConditionTypes: V33_TRIGGER_CONDITION_TYPES,
    triggerEffectTypes: V33_TRIGGER_EFFECT_TYPES,
    limits: V33_LIMITS,
  },
  V34: {
    version: 'V34',
    heroesVersion: 34,
    requiredTopLevel: V34_REQUIRED_TOP_LEVEL,
    triggerConditionTypes: V34_TRIGGER_CONDITION_TYPES,
    triggerEffectTypes: V34_TRIGGER_EFFECT_TYPES,
    limits: V34_LIMITS,
  },
};

const VOYAGE_LIMITS = VOYAGE_SCHEMA_RULES[CURRENT_VOYAGE_SCHEMA_VERSION].limits;
const TRIGGER_SEMANTIC_CONDITION_TYPES = new Set(['story', 'action']);

function getVoyageSchemaRules(schemaVersion = CURRENT_VOYAGE_SCHEMA_VERSION) {
  const normalized = String(schemaVersion || CURRENT_VOYAGE_SCHEMA_VERSION).toUpperCase();
  const rules = VOYAGE_SCHEMA_RULES[normalized];
  if (!rules) {
    throw new Error(`Unsupported Voyage schema version: ${schemaVersion}`);
  }
  return rules;
}

const VALID_GAME_MODE_DIFFICULTIES = ['very easy', 'easy', 'medium', 'hard', 'very hard'];

function hasSemanticTriggerCondition(trigger) {
  return !!(
    trigger &&
    Array.isArray(trigger.conditions) &&
    trigger.conditions.some(
      (condition) =>
        condition &&
        TRIGGER_SEMANTIC_CONDITION_TYPES.has(condition.type)
    )
  );
}

function classifyTriggers(triggers) {
  let semantic = 0;
  let mechanical = 0;

  for (const trigger of triggers || []) {
    if (hasSemanticTriggerCondition(trigger)) semantic += 1;
    else mechanical += 1;
  }

  return { semantic, mechanical };
}

module.exports = {
  CURRENT_VOYAGE_SCHEMA_VERSION,
  TRIGGER_SEMANTIC_CONDITION_TYPES,
  VALID_GAME_MODE_DIFFICULTIES,
  VOYAGE_LIMITS,
  VOYAGE_SCHEMA_RULES,
  classifyTriggers,
  getVoyageSchemaRules,
  hasSemanticTriggerCondition,
};
