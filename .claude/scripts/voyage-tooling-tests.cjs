#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadAndMergeTabs, resolveWorld } = require('./world-puppeteer-lib.cjs');
const { analyzeConfig } = require('./count.js');
const { validate } = require('./validate.js');
const {
  VOYAGE_LIMITS,
  classifyTriggers,
} = require('./voyage-platform-rules.cjs');

const repoRoot = path.resolve(__dirname, '../..');
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runValidateCli(filePath) {
  return spawnSync(process.execPath, [path.join(repoRoot, '.claude/scripts/validate.js'), filePath, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

const templateWorld = resolveWorld({
  worldRoot: path.join(repoRoot, 'templates'),
  preferNearest: false,
});
const baseConfig = loadAndMergeTabs(templateWorld.tabsPath).config;

{
  const result = validate(baseConfig);
  assert(result.schemaVersion === 'V34', 'default validation must use V34');
  assert(result.errors.length === 0, `template V34 config must validate without errors: ${JSON.stringify(result.errors)}`);
}

{
  const v33Config = clone(baseConfig);
  v33Config.configVersion = 'V33';
  v33Config.heroesVersion = 33;
  delete v33Config.narrativeEvents;
  delete v33Config.embeddingModel;
  delete v33Config.embeddingDimension;

  const defaultResult = validate(v33Config);
  assert(defaultResult.errors.some((entry) => entry.path === 'configVersion' && entry.message.includes("expected 'V34'")), 'default V34 validation must reject V33 configVersion');

  const v33Result = validate(v33Config, { schemaVersion: 'V33' });
  assert(v33Result.schemaVersion === 'V33', 'explicit V33 validation must report V33');
  assert(!v33Result.errors.some((entry) => entry.path === 'configVersion' || entry.path === 'heroesVersion'), 'explicit V33 validation must preserve historical version checks');
}

{
  const validV34 = clone(baseConfig);
  validV34.skills = {
    courage: {
      name: 'courage',
      attribute: 'will',
      type: 'general',
      description: '',
      startingItems: [],
    },
  };
  validV34.attributeSettings.attributeNames = ['will'];
  validV34.skillSettings.skillTypeDifficultyBonus = { general: 0 };
  validV34.traits = {
    Brave: {
      name: 'Brave',
      description: 'Stands firm.',
      traitNarrativeEffects: 'The character stands firm under pressure.',
      skills: [{ skill: 'courage', modifier: 5 }],
      attributes: [{ attribute: 'will', modifier: 1 }],
      resources: [{ resource: 'health', modifier: 1 }],
      startingItems: [],
      abilities: [],
      unlockedBy: [],
      excludedBy: [],
      resistances: [],
    },
  };
  validV34.quests = {
    'Signal the Guard': {
      name: 'Signal the Guard',
      questSource: 'Guard Captain',
      questStatement: 'Signal the guard when the courier arrives.',
      mainObjective: 'Signal the guard.',
      completionCondition: { type: 'narrative-event-completed', eventId: 'courier_arrival' },
      detailType: 'detailed',
      questLocation: 'Gate',
      objectives: {
        wait: { id: 'wait', text: 'Wait at the gate.', status: 'active' },
      },
      activeObjectiveId: 'wait',
      nextStep: { text: 'Stay near the gate.', source: 'objective' },
    },
  };
  validV34.locations = {
    Gate: {
      name: 'Gate',
      basicInfo: '',
      x: 0,
      y: 0,
      radius: 1,
      region: 'Yard',
      complexityType: 'simple',
      detailType: 'basic',
      areas: {},
    },
  };
  validV34.regions = { Yard: { name: 'Yard', basicInfo: '', realm: 'World' } };
  validV34.realms = { World: { name: 'World', basicInfo: '' } };
  validV34.narrativeEvents = {
    courier_arrival: {
      title: 'Courier Arrival',
      beats: 'A courier arrives and asks for the guard.',
      targetTurns: 2,
      onCompleteEffects: [{ type: 'quest-complete', questId: 'Signal the Guard' }],
    },
  };
  validV34.triggers = {
    start_event: {
      name: 'start_event',
      scope: 'party',
      conditions: [{ type: 'quest-status', questId: 'Signal the Guard', operator: 'equals', value: 'accepted' }],
      effects: [
        { type: 'narrative-event-start', eventId: 'courier_arrival' },
        { type: 'quest-objective-complete', questId: 'Signal the Guard', objectiveId: 'wait' },
        { type: 'quest-next-step-set', questId: 'Signal the Guard', text: 'Speak to the courier.', source: 'narrative-event' },
        { type: 'player-resource', operator: 'add', resource: 'health', value: 1, target: 'satisfyingPlayers' },
      ],
    },
  };

  const result = validate(validV34);
  assert(result.errors.length === 0, `valid V34 narrative/quest/trigger/trait fixture must pass: ${JSON.stringify(result.errors)}`);
}

{
  const invalid = clone(baseConfig);
  invalid.traits = {
    Legacy: {
      name: 'Legacy',
      description: 'Old trait.',
      quirk: 'V33-only field',
      skills: [],
      attributes: [],
      resources: [],
      startingItems: [],
      abilities: [],
      unlockedBy: [],
      excludedBy: [],
    },
  };
  invalid.quests = {
    LegacyQuest: {
      name: 'LegacyQuest',
      questSource: 'test',
      questStatement: 'test',
      mainObjective: 'Test.',
      completionCondition: 'legacy string completion',
      detailType: 'brief',
    },
  };
  invalid.triggers = {
    old_shape: {
      name: 'old_shape',
      conditions: [{ type: 'quest-status', questId: 'LegacyQuest', operator: 'contains', value: 'available' }],
      effects: [{ type: 'quest-init', value: 'LegacyQuest' }],
    },
  };

  const result = validate(invalid);
  assert(result.errors.some((entry) => entry.path === 'traits.Legacy.traitNarrativeEffects'), 'V34 traits must require traitNarrativeEffects');
  assert(result.errors.some((entry) => entry.path === 'traits.Legacy.quirk'), 'V34 traits must reject V33-only quirk field');
  assert(result.errors.some((entry) => entry.path === 'quests.LegacyQuest.completionCondition'), 'V34 quests must reject string completionCondition');
  assert(result.errors.some((entry) => entry.path === 'quests.LegacyQuest.detailType'), 'V34 quests must reject invalid detailType values');
  assert(result.errors.some((entry) => entry.path === 'triggers.old_shape.conditions[0].operator'), 'quest-status must use equals/notEquals');
  assert(result.errors.some((entry) => entry.path === 'triggers.old_shape.effects[0].operator'), 'quest-init must require operator set');
}

{
  const warningConfig = clone(baseConfig);
  const firstCategory = warningConfig.itemSettings.itemCategories[0] || 'Weapon';
  const firstSlot = warningConfig.itemSettings.itemSlots[0]?.slot || 'mainHand';
  warningConfig.itemSettings.itemCategories = warningConfig.itemSettings.itemCategories.length > 0
    ? warningConfig.itemSettings.itemCategories
    : [firstCategory];
  warningConfig.itemSettings.itemSlots = warningConfig.itemSettings.itemSlots.length > 0
    ? warningConfig.itemSettings.itemSlots
    : [{ slot: firstSlot, category: firstCategory, quantity: 1 }];
  warningConfig.items = warningConfig.items || {};
  warningConfig.items.WarningBlade = {
    name: 'WarningBlade',
    category: firstCategory,
    slot: firstSlot,
    description: 'warning fixture',
    bonuses: [
      { type: 'attribute', variable: 'Missing Attribute', value: 1 },
    ],
  };
  warningConfig.gameModes = {
    roleplay: {
      name: 'Roleplay',
      description: 'fixture mode',
      instructions: 'fixture instructions',
      difficulty: 'nightmare',
    },
  };

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-validate-warning-'));
  const warningPath = path.join(tempRoot, 'warning-world.json');
  writeJson(warningPath, warningConfig);
  const result = runValidateCli(warningPath);

  assert(result.status === 0, `warning-only validation must exit 0: ${result.stdout}${result.stderr}`);
  try {
    const parsed = JSON.parse(result.stdout);
    assert(parsed.errors.length === 0, 'warning-only validation must not emit fatal errors');
    assert(parsed.warnings.some((entry) => entry.path === 'items.WarningBlade.bonuses[0].variable'), 'item bonus warning must stay in warnings');
    assert(parsed.warnings.some((entry) => entry.path === 'gameModes.roleplay.difficulty'), 'game mode difficulty warning must stay in warnings');
  } catch (error) {
    failures.push(`warning-only validation JSON parse failed: ${error.message}`);
  }
}

{
  const fatalConfig = clone(baseConfig);
  delete fatalConfig.storySettings;

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-validate-fatal-'));
  const fatalPath = path.join(tempRoot, 'fatal-world.json');
  writeJson(fatalPath, fatalConfig);
  const result = runValidateCli(fatalPath);

  assert(result.status !== 0, 'fatal validation must exit nonzero');
  try {
    const parsed = JSON.parse(result.stdout);
    assert(parsed.errors.some((entry) => entry.path === 'storySettings'), 'fatal validation must report missing storySettings');
  } catch (error) {
    failures.push(`fatal validation JSON parse failed: ${error.message}`);
  }
}

{
  const classificationConfig = clone(baseConfig);
  classificationConfig.triggers = {
    SemanticTrigger: {
      name: 'SemanticTrigger',
      conditions: [{ type: 'story', query: 'x' }],
      effects: [],
    },
    MechanicalTrigger: {
      name: 'MechanicalTrigger',
      conditions: [{ type: 'player-level', value: 1 }],
      effects: [],
    },
  };

  const classifyResult = classifyTriggers(Object.values(classificationConfig.triggers));
  const countResult = analyzeConfig(classificationConfig);

  assert(classifyResult.semantic === 1, 'shared trigger classifier must count semantic triggers');
  assert(classifyResult.mechanical === 1, 'shared trigger classifier must count mechanical triggers');
  assert(countResult.counts.semanticTriggers.used === classifyResult.semantic, 'count.js must use the shared semantic trigger classifier');
  assert(countResult.counts.mechanicalTriggers.used === classifyResult.mechanical, 'count.js must use the shared mechanical trigger classifier');
  assert(countResult.counts.semanticTriggers.limit === VOYAGE_LIMITS.counts.semanticTriggers, 'count.js semantic trigger limit must come from shared rules');
  assert(countResult.counts.mechanicalTriggers.limit === VOYAGE_LIMITS.counts.mechanicalTriggers, 'count.js mechanical trigger limit must come from shared rules');
}

{
  const overflowConfig = clone(baseConfig);
  overflowConfig.triggers = {};
  for (let index = 0; index < VOYAGE_LIMITS.counts.semanticTriggers + 1; index += 1) {
    overflowConfig.triggers[`Semantic${index}`] = {
      name: `Semantic${index}`,
      conditions: [{ type: 'story', query: `story-${index}` }],
      effects: [],
    };
  }

  const result = validate(overflowConfig);
  assert(
    result.errors.some((entry) =>
      entry.path === 'triggers' &&
      entry.message.includes(`Too many semantic triggers: ${VOYAGE_LIMITS.counts.semanticTriggers + 1} (max: ${VOYAGE_LIMITS.counts.semanticTriggers})`)
    ),
    'validate.js must use the shared semantic trigger limit'
  );
}

{
  const imagePromptConfig = clone(baseConfig);
  imagePromptConfig.imagePromptConfiguration = {
    npcs: 'n'.repeat(VOYAGE_LIMITS.fields.imagePromptInstruction + 1),
    locations: 'l'.repeat(VOYAGE_LIMITS.fields.imagePromptInstruction),
    regions: 'r'.repeat(VOYAGE_LIMITS.fields.imagePromptInstruction),
  };

  const validateResult = validate(imagePromptConfig);
  const countResult = analyzeConfig(imagePromptConfig);

  assert(
    validateResult.errors.some((entry) =>
      entry.path === 'imagePromptConfiguration.npcs' &&
      entry.message.includes(`Exceeds ${VOYAGE_LIMITS.fields.imagePromptInstruction} chars`)
    ),
    'validate.js must use the shared image prompt per-section limit'
  );
  assert(
    validateResult.errors.some((entry) =>
      entry.path === 'imagePromptConfiguration' &&
      entry.message.includes(`Total exceeds ${VOYAGE_LIMITS.fields.imagePromptTotal} chars`)
    ),
    'validate.js must use the shared image prompt total limit'
  );
  assert(
    countResult.imagePrompts.oversized.some((entry) =>
      entry.path === 'imagePromptConfiguration.npcs' &&
      entry.limit === VOYAGE_LIMITS.fields.imagePromptInstruction
    ),
    'count.js must use the shared image prompt per-section limit'
  );
  assert(
    countResult.imagePrompts.total &&
      countResult.imagePrompts.total.limit === VOYAGE_LIMITS.fields.imagePromptTotal,
    'count.js must use the shared image prompt total limit'
  );
}

{
  const changedLimits = clone(baseConfig);
  changedLimits.nameFilterSettings = {
    Long: {
      replacements: ['r'],
      pattern: 'x'.repeat(150_000),
    },
  };
  changedLimits.storyStarts.Start.storyStart = 's'.repeat(8_000);
  changedLimits.triggers = {
    big: {
      name: 'big',
      conditions: [{ type: 'game-tick', operator: 'equals', value: 1 }],
      effects: [{ type: 'story', instruction: 'x'.repeat(10_000) }],
    },
  };

  const countResult = analyzeConfig(changedLimits);
  const validateResult = validate(changedLimits);
  assert(countResult.sections.nameFilterSettings.limit === 150_000, 'V34 nameFilterSettings section limit must be 150000');
  // Wiki size-limits (snapshot 2026-07-06): storyStart entry 8,000 pretty JSON, trigger 10,000 compact JSON.
  assert(countResult.entries.oversized.some((entry) => entry.path === 'storyStarts[Start]' && entry.limit === 8_000), 'V34 story start entry limit must be 8000 pretty chars');
  assert(validateResult.errors.some((entry) => entry.path === 'triggers.big' && entry.message.includes('10000')), 'V34 trigger compact size limit must be 10000');
}

{
  const cliConfig = clone(baseConfig);
  cliConfig.configVersion = 'V33';
  cliConfig.heroesVersion = 33;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-validate-version-'));
  const cliPath = path.join(tempRoot, 'version-world.json');
  writeJson(cliPath, cliConfig);
  const result = spawnSync(process.execPath, [path.join(repoRoot, '.claude/scripts/validate.js'), cliPath, '--json', '--schema-version', 'V33'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert(result.status === 0, `explicit V33 CLI validation must exit 0: ${result.stdout}${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert(parsed.schemaVersion === 'V33', 'CLI JSON diagnostics must identify selected schema version');
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log('voyage tooling tests passed');
