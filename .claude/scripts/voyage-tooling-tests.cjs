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

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log('voyage tooling tests passed');
