#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPlan } = require('./mod-dry-run.cjs');
const { findRepoRoot } = require('./world-puppeteer-lib.cjs');

const sourceRepo = findRepoRoot(__dirname);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'world-puppeteer-dry-run-path-'));

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

for (const schema of ['mod.schema.json', 'mod-integration-plan.schema.json', 'world-marker.schema.json']) {
  const source = path.join(sourceRepo, '.world-puppeteer', 'schemas', schema);
  const target = path.join(root, '.world-puppeteer', 'schemas', schema);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

const modDir = path.join(root, '.world-puppeteer', 'mods', 'Fixture');
writeJson(path.join(root, '.world-puppeteer', 'mods', 'index.json'), {
  schemaVersion: 1,
  mods: ['fixture-mod'],
});
writeJson(path.join(modDir, 'mod.json'), {
  schemaVersion: 1,
  id: 'fixture-mod',
  name: 'Fixture Mod',
  version: '1.0.0',
  description: 'Relative path fixture.',
  compatibleFormats: ['voyage-v33'],
  domains: ['ai-instructions'],
  supportedModes: ['reference'],
  defaultMode: 'reference',
  applicationProfile: 'reference-only',
  conflictPolicy: 'stop',
  dependencies: [],
  optionalDependencies: [],
  files: ['payload.json'],
  payloadMappings: [{
    file: 'payload.json',
    sourcePath: 'aiInstructions',
    targetPath: 'aiInstructions',
    preferredTargetFile: 'ai-instructions.json',
    domain: 'ai-instructions',
  }],
});
fs.writeFileSync(path.join(modDir, 'README.md'), '# Fixture\n');
writeJson(path.join(modDir, 'payload.json'), {
  aiInstructions: {
    generateStory: {
      custom: 'fixture',
    },
  },
});

const worldRoot = path.join(root, 'nested-world');
writeJson(path.join(worldRoot, '.world-puppeteer.json'), {
  schemaVersion: 1,
  id: 'fixture-world',
  name: 'Fixture World',
  role: 'editable',
  format: 'voyage-v33',
  paths: {
    tabs: 'tabs',
    compiledOutput: 'fixture.json',
    instructions: 'AGENTS.override.md',
  },
  toolchain: {
    formatProfile: 'voyage-json-tabs',
    buildProfile: 'world-build-cjs',
    validationProfiles: ['voyage-local-validator'],
  },
  activeProfiles: [],
  appliedMods: [],
});
writeJson(path.join(worldRoot, 'tabs', 'ai-instructions.json'), {
  aiInstructions: {},
});

const relative = createPlan({
  modId: 'fixture-mod',
  worldRoot: 'nested-world',
  mode: 'reference',
  repoRoot: root,
  cwd: root,
});

if (path.resolve(relative.world.worldRoot) !== path.resolve(worldRoot)) {
  throw new Error(`Relative world path resolved incorrectly: ${relative.world.worldRoot}`);
}

const absolute = createPlan({
  modId: 'fixture-mod',
  worldRoot,
  mode: 'reference',
  repoRoot: root,
  cwd: root,
});

if (path.resolve(absolute.world.worldRoot) !== path.resolve(worldRoot)) {
  throw new Error(`Absolute world path resolved incorrectly: ${absolute.world.worldRoot}`);
}

console.log('mod dry-run path tests passed');
