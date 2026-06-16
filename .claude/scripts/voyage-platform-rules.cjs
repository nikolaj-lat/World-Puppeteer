const {
  AI_INSTRUCTION_LEAF_LIMIT,
  AI_INSTRUCTION_TASK_LIMIT,
} = require('./ai-instruction-limits.cjs');

const TRIGGER_SEMANTIC_CONDITION_TYPES = new Set(['story', 'action']);

const VOYAGE_LIMITS = {
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
  TRIGGER_SEMANTIC_CONDITION_TYPES,
  VALID_GAME_MODE_DIFFICULTIES,
  VOYAGE_LIMITS,
  classifyTriggers,
  hasSemanticTriggerCondition,
};
