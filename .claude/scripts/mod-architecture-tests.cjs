#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  validateAgainstSchemaFile,
} = require('./mod-architecture.cjs');
const {
  createDryRunPlan,
  validateAppliedMods,
  validateModRegistry,
} = require('./mod-architecture-v2.cjs');
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
  for (const schema of ['mod.schema.json', 'mod-integration-plan.schema.json', 'world-marker.schema.json']) {
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
    conflictPolicy: overrides.conflictPolicy || 'stop',
    dependencies: overrides.dependencies || [],
    optionalDependencies: overrides.optionalDependencies || [],
    files: overrides.files || ['payload.json'],
    payloadMappings: overrides.payloadMappings || [{
      file: 'payload.json',
      sourcePath: 'aiInstructions',
      targetPath: 'aiInstructions',
      preferredTargetFile: 'ai-instructions.json',
      domain: 'ai-instructions',
    }],
  };
}

function writeMod(root, dirName, modManifest, payloads = null) {
  const modDir = path.join(root, '.world-puppeteer', 'mods', dirName);
  writeJson(path.join(modDir, 'mod.json'), modManifest);
  fs.writeFileSync(path.join(modDir, 'README.md'), '# Fixture\n');
  const values = payloads || Object.fromEntries(
    (modManifest.files || []).map((file) => [file, { aiInstructions: { generateStory: { custom: 'fixture' } } }])
  );
  for (const [file, value] of Object.entries(values)) writeJson(path.join(modDir, file), value);
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
assert(referencePlan.blocked === false, 'reference plan must not be blocked');
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
assert(validateModRegistry(malformedRoot).errors.some((error) => error.includes('invalid JSON')), 'malformed mod JSON must produce a structured error');

const malformedPayloadRoot = fixtureRoot();
writeMod(malformedPayloadRoot, 'one', manifest('one'));
fs.writeFileSync(path.join(malformedPayloadRoot, '.world-puppeteer', 'mods', 'one', 'payload.json'), '{ broken');
writeRegistry(malformedPayloadRoot, ['one']);
assert(validateModRegistry(malformedPayloadRoot).errors.some((error) => error.includes('invalid JSON')), 'malformed payload JSON must produce a structured error');

const badSourceRoot = fixtureRoot();
writeMod(badSourceRoot, 'one', manifest('one', {
  payloadMappings: [{
    file: 'payload.json',
    sourcePath: 'missing',
    targetPath: 'aiInstructions',
    preferredTargetFile: 'ai-instructions.json',
    domain: 'ai-instructions',
  }],
}));
writeRegistry(badSourceRoot, ['one']);
assert(validateModRegistry(badSourceRoot).errors.some((error) => error.includes('sourcePath not found')), 'missing sourcePath must fail');

const unmappedRoot = fixtureRoot();
writeMod(unmappedRoot, 'one', manifest('one', { files: ['payload.json', 'extra.json'] }), {
  'payload.json': { aiInstructions: {} },
  'extra.json': { aiInstructions: {} },
});
writeRegistry(unmappedRoot, ['one']);
assert(validateModRegistry(unmappedRoot).errors.some((error) => error.includes('no target mappings')), 'every payload must have a target mapping');

const selfDependencyRoot = fixtureRoot();
writeMod(selfDependencyRoot, 'one', manifest('one', { dependencies: ['one'] }));
writeRegistry(selfDependencyRoot, ['one']);
assert(validateModRegistry(selfDependencyRoot).errors.some((error) => error.includes('cannot depend on itself')), 'self-dependency must fail');

const duplicateIdRoot = fixtureRoot();
writeMod(duplicateIdRoot, 'one-a', manifest('one'));
writeMod(duplicateIdRoot, 'one-b', manifest('one'));
writeRegistry(duplicateIdRoot, ['one']);
assert(validateModRegistry(duplicateIdRoot).errors.some((error) => error.includes('duplicate mod id')), 'duplicate IDs must fail');

const duplicateRegistryRoot = fixtureRoot();
writeMod(duplicateRegistryRoot, 'one', manifest('one'));
writeRegistry(duplicateRegistryRoot, ['one', 'one']);
assert(validateModRegistry(duplicateRegistryRoot).errors.some((error) => error.includes('duplicate registry entry')), 'duplicate registry entries must fail');

const cycleRoot = fixtureRoot();
writeMod(cycleRoot, 'one', manifest('one', { dependencies: ['two'] }));
writeMod(cycleRoot, 'two', manifest('two', { dependencies: ['one'] }));
writeRegistry(cycleRoot, ['one', 'two']);
assert(validateModRegistry(cycleRoot).errors.some((error) => error.includes('dependency cycle')), 'required dependency cycles must fail');

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
const additivePlan = createDryRunPlan({ repoRoot: additiveRoot, world: worldFixture(additiveRoot, {}), modId: 'one', mode: 'apply' }).plan;
assert(additivePlan.blocked === false, 'collision-free additive plan must not be blocked');
assert(additivePlan.proposedOperations.some((operation) => operation.type === 'add'), 'collision-free additive plan must propose add');

const collisionRoot = fixtureRoot();
writeMod(collisionRoot, 'one', manifest('one', { applicationProfile: 'additive' }));
writeRegistry(collisionRoot, ['one']);
const collisionWorld = worldFixture(collisionRoot, { aiInstructions: { generateStory: { custom: 'existing' } } });
const collisionPlan = createDryRunPlan({ repoRoot: collisionRoot, world: collisionWorld, modId: 'one', mode: 'apply' }).plan;
assert(collisionPlan.blocked === true, 'conflictPolicy=stop must block apply on collision');
assert(!collisionPlan.proposedOperations.some((operation) => operation.type === 'add'), 'additive profile must not propose add on collision');
assert(collisionPlan.conflicts.some((conflict) => conflict.keys.includes('generateStory')), 'collision plan must report overlapping keys');

const manualRoot = fixtureRoot();
writeMod(manualRoot, 'one', manifest('one', { applicationProfile: 'manual' }));
writeRegistry(manualRoot, ['one']);
const manualPlan = createDryRunPlan({ repoRoot: manualRoot, world: worldFixture(manualRoot), modId: 'one', mode: 'apply' }).plan;
assert(manualPlan.proposedOperations.every((operation) => operation.type === 'adapt'), 'manual profile must propose adapt only');

const incompatibleRoot = fixtureRoot();
writeMod(incompatibleRoot, 'one', manifest('one'));
writeRegistry(incompatibleRoot, ['one']);
const incompatibleWorld = worldFixture(incompatibleRoot);
incompatibleWorld.marker.format = 'other-format';
assertThrows(
  () => createDryRunPlan({ repoRoot: incompatibleRoot, world: incompatibleWorld, modId: 'one' }),
  /not compatible/,
  'incompatible format must fail',
);

const provenanceRoot = fixtureRoot();
writeMod(provenanceRoot, 'one', manifest('one', { applicationProfile: 'manual' }));
writeRegistry(provenanceRoot, ['one']);
const provenanceRegistry = validateModRegistry(provenanceRoot);
const provenanceWorld = worldFixture(provenanceRoot);
provenanceWorld.marker.appliedMods = [{
  modId: 'one',
  version: '1.0.0',
  mode: 'apply',
  appliedAt: '2026-06-15',
  sourceFiles: ['payload.json'],
  operations: ['adapt'],
}];
assert(validateAppliedMods(provenanceWorld.marker, provenanceRegistry, provenanceWorld.markerPath).length === 0, 'valid provenance must pass');
assertThrows(
  () => createDryRunPlan({ repoRoot: provenanceRoot, world: provenanceWorld, modId: 'one' }),
  /already appears in appliedMods/,
  'already-applied mods must not be silently reapplied',
);
provenanceWorld.marker.appliedMods.push({ ...provenanceWorld.marker.appliedMods[0] });
assert(validateAppliedMods(provenanceWorld.marker, provenanceRegistry, provenanceWorld.markerPath).some((error) => error.includes('duplicate applied mod')), 'duplicate provenance must fail');

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log('mod architecture tests passed');
