#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createDryRunPlan,
  validateAgainstSchemaFile,
  validateAppliedMods,
  validateModRegistry,
} = require('./mod-architecture.cjs');
const { findRepoRoot } = require('./world-puppeteer-lib.cjs');

const repoRoot = findRepoRoot(__dirname);
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertThrows(fn, matcher, message) {
  try {
    fn();
    failures.push(`${message}: expected an error`);
  } catch (error) {
    assert(matcher.test(error.message), `${message}: ${error.message}`);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'world-puppeteer-mod-'));
  const schemas = ['mod.schema.json', 'mod-integration-plan.schema.json', 'world-marker.schema.json'];
  for (const schema of schemas) {
    const source = path.join(repoRoot, '.world-puppeteer', 'schemas', schema);
    const target = path.join(root, '.world-puppeteer', 'schemas', schema);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  return root;
}

function manifest(id, overrides = {}) {
  const applicationProfile = overrides.applicationProfile || 'reference-only';
  const supportedModes = overrides.supportedModes || (applicationProfile === 'reference-only' ? ['reference'] : ['reference', 'apply']);
  return {
    schemaVersion: 1,
    id,
    name: id,
    version: '1.0.0',
    description: 'fixture mod',
    compatibleFormats: ['voyage-v33'],
    domains: ['ai-instructions'],
    supportedModes,
    defaultMode: overrides.defaultMode || 'reference',
    applicationProfile,
    conflictPolicy: 'stop',
    dependencies: overrides.dependencies || [],
    optionalDependencies: overrides.optionalDependencies || [],
    files: overrides.files || [
      {
        path: 'payload.json',
        targets: [
          {
            sourcePath: 'aiInstructions',
            targetPath: 'aiInstructions',
            preferredTargetFile: 'ai-instructions.json',
            domain: 'ai-instructions',
          },
        ],
      },
    ],
  };
}

function writeMod(root, dirName, modManifest, payload = { aiInstructions: { generateStory: { custom: 'fixture' } } }) {
  const modDir = path.join(root, '.world-puppeteer', 'mods', dirName);
  writeJson(path.join(modDir, 'mod.json'), modManifest);
  fs.writeFileSync(path.join(modDir, 'README.md'), '# Fixture\n');
  for (const fileDef of modManifest.files || []) writeJson(path.join(modDir, fileDef.path), payload);
}

function writeRegistry(root, ids) {
  writeJson(path.join(root, '.world-puppeteer', 'mods', 'index.json'), { schemaVersion: 1, mods: ids });
}

function worldFixture(root, targetDocument = {}) {
  const worldRoot = path.join(root, 'world');
  const tabsPath = path.join(worldRoot, 'tabs');
  writeJson(path.join(tabsPath, 'ai-instructions.json'), targetDocument);
  return {
    repoRoot: root,
    worldRoot,
    tabsPath,
    markerPath: path.join(worldRoot, '.world-puppeteer.json'),
    marker: {
      schemaVersion: 1,
      id: 'fixture-world',
      name: 'Fixture World',
      role: 'editable',
      format: 'voyage-v33',
      paths: { tabs: 'tabs', compiledOutput: 'fixture.json', instructions: 'AGENTS.override.md' },
      toolchain: {
        formatProfile: 'voyage-json-tabs',
        buildProfile: 'world-build-cjs',
        validationProfiles: ['voyage-local-validator'],
      },
      activeProfiles: [],
      appliedMods: [],
    },
  };
}

const realRegistry = validateModRegistry(repoRoot);
for (const error of realRegistry.errors) failures.push(error);
assert(realRegistry.modsById.has('meteion-story-instructions'), 'real registry must include Meteion');
assert(realRegistry.modsById.has('sephii-instruction-pack'), 'real registry must include Sephii');

const validRoot = fixtureRoot();
writeMod(validRoot, 'one', manifest('one'));
writeRegistry(validRoot, ['one']);
const validRegistry = validateModRegistry(validRoot);
assert(validRegistry.errors.length === 0, `valid fixture registry failed: ${validRegistry.errors.join('; ')}`);
const validWorld = worldFixture(validRoot, {});
const referencePlan = createDryRunPlan({ repoRoot: validRoot, world: validWorld, modId: 'one', mode: 'reference' }).plan;
assert(referencePlan.blocked === false, 'reference plan without target content must not be blocked');
assert(referencePlan.proposedOperations.every((operation) => operation.type === 'reference'), 'reference plan must propose reference operations only');
const planSchema = path.join(validRoot, '.world-puppeteer', 'schemas', 'mod-integration-plan.schema.json');
assert(validateAgainstSchemaFile(referencePlan, planSchema).length === 0, 'generated plan must validate against actual plan schema');
assert(validateAgainstSchemaFile({ ...referencePlan, unexpected: true }, planSchema).some((error) => error.includes('additional property')), 'actual plan schema must reject unknown properties');

const malformedRoot = fixtureRoot();
const malformedDir = path.join(malformedRoot, '.world-puppeteer', 'mods', 'broken');
fs.mkdirSync(malformedDir, { recursive: true });
fs.writeFileSync(path.join(malformedDir, 'README.md'), '# Broken\n');
fs.writeFileSync(path.join(malformedDir, 'mod.json'), '{ broken');
writeRegistry(malformedRoot, ['broken']);
assert(validateModRegistry(malformedRoot).errors.some((error) => error.includes('invalid JSON')), 'malformed mod JSON must produce a structured validation error');

const badSourceRoot = fixtureRoot();
writeMod(badSourceRoot, 'one', manifest('one', {
  files: [{
    path: 'payload.json',
    targets: [{ sourcePath: 'missing', targetPath: 'aiInstructions', preferredTargetFile: 'ai-instructions.json', domain: 'ai-instructions' }],
  }],
}));
writeRegistry(badSourceRoot, ['one']);
assert(validateModRegistry(badSourceRoot).errors.some((error) => error.includes('sourcePath not found')), 'missing sourcePath must fail manifest validation');

const selfDependencyRoot = fixtureRoot();
writeMod(selfDependencyRoot, 'one', manifest('one', { dependencies: ['one'] }));
writeRegistry(selfDependencyRoot, ['one']);
assert(validateModRegistry(selfDependencyRoot).errors.some((error) => error.includes('cannot depend on itself')), 'self-dependency must fail');

const referenceOnlyRoot = fixtureRoot();
writeMod(referenceOnlyRoot, 'one', manifest('one'));
writeRegistry(referenceOnlyRoot, ['one']);
assertThrows(
  () => createDryRunPlan({ repoRoot: referenceOnlyRoot, world: worldFixture(referenceOnlyRoot), modId: 'one', mode: 'apply' }),
  /reference-only|does not support mode apply/,
  'reference-only profile must reject apply mode',
);

const additiveRoot = fixtureRoot();
writeMod(additiveRoot, 'one', manifest('one', { applicationProfile: 'additive' }));
writeRegistry(additiveRoot, ['one']);
const additiveWorld = worldFixture(additiveRoot, {});
const additivePlan = createDryRunPlan({ repoRoot: additiveRoot, world: additiveWorld, modId: 'one', mode: 'apply' }).plan;
assert(additivePlan.blocked === false, 'collision-free additive plan must not be blocked');
assert(additivePlan.proposedOperations.some((operation) => operation.type === 'add'), 'collision-free additive plan must propose add');

const collisionRoot = fixtureRoot();
writeMod(collisionRoot, 'one', manifest('one', { applicationProfile: 'additive' }));
writeRegistry(collisionRoot, ['one']);
const collisionWorld = worldFixture(collisionRoot, { aiInstructions: { generateStory: { custom: 'existing' } } });
const collisionPlan = createDryRunPlan({ repoRoot: collisionRoot, world: collisionWorld, modId: 'one', mode: 'apply' }).plan;
assert(collisionPlan.blocked === true, 'conflictPolicy=stop must block additive apply on collision');
assert(!collisionPlan.proposedOperations.some((operation) => operation.type === 'add'), 'additive profile must not propose add on collision');
assert(collisionPlan.conflicts.some((conflict) => conflict.keys.includes('generateStory')), 'collision plan must report exact overlapping keys');

const manualRoot = fixtureRoot();
writeMod(manualRoot, 'one', manifest('one', { applicationProfile: 'manual' }));
writeRegistry(manualRoot, ['one']);
const manualPlan = createDryRunPlan({ repoRoot: manualRoot, world: worldFixture(manualRoot), modId: 'one', mode: 'apply' }).plan;
assert(manualPlan.proposedOperations.every((operation) => operation.type === 'adapt'), 'manual profile must never propose automatic additions');

const incompatibleRoot = fixtureRoot();
writeMod(incompatibleRoot, 'one', manifest('one'));
writeRegistry(incompatibleRoot, ['one']);
const incompatibleWorld = worldFixture(incompatibleRoot);
incompatibleWorld.marker.format = 'other-format';
assertThrows(
  () => createDryRunPlan({ repoRoot: incompatibleRoot, world: incompatibleWorld, modId: 'one' }),
  /not compatible/,
  'incompatible world format must fail',
);

const alreadyAppliedRoot = fixtureRoot();
writeMod(alreadyAppliedRoot, 'one', manifest('one'));
writeRegistry(alreadyAppliedRoot, ['one']);
const alreadyAppliedWorld = worldFixture(alreadyAppliedRoot);
alreadyAppliedWorld.marker.appliedMods = [{
  modId: 'one',
  version: '1.0.0',
  mode: 'apply',
  appliedAt: '2026-06-15',
  sourceFiles: ['payload.json'],
  operations: ['adapt'],
}];
assertThrows(
  () => createDryRunPlan({ repoRoot: alreadyAppliedRoot, world: alreadyAppliedWorld, modId: 'one' }),
  /already appears in appliedMods/,
  'already-applied mods must not be silently reapplied',
);

const provenanceRegistry = validateModRegistry(alreadyAppliedRoot);
assert(validateAppliedMods(alreadyAppliedWorld.marker, provenanceRegistry, alreadyAppliedWorld.markerPath).length === 0, 'valid applied-mod provenance must pass');
alreadyAppliedWorld.marker.appliedMods.push({ ...alreadyAppliedWorld.marker.appliedMods[0] });
assert(validateAppliedMods(alreadyAppliedWorld.marker, provenanceRegistry, alreadyAppliedWorld.markerPath).some((error) => error.includes('duplicate applied mod')), 'duplicate applied-mod provenance must fail');

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log('mod architecture tests passed');
