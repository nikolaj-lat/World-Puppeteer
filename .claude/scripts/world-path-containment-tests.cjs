#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  loadAndMergeTabs,
  resolveContainedPath,
} = require('./world-puppeteer-lib.cjs');

const repoRoot = path.resolve(__dirname, '../..');
const failures = [];
const skipped = [];
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-paths-'));

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertThrows(fn, matcher, message) {
  try {
    fn();
    failures.push(`${message}: expected error`);
  } catch (error) {
    assert(matcher.test(error.message), `${message}: ${error.message}`);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function copySchemaFiles(root) {
  const schemaRoot = path.join(root, '.world-puppeteer', 'schemas');
  fs.mkdirSync(schemaRoot, { recursive: true });
  for (const file of [
    'world-marker.schema.json',
    'profile.schema.json',
    'reference-pack.schema.json',
    'reference-pack-index.schema.json',
  ]) {
    fs.copyFileSync(
      path.join(repoRoot, '.world-puppeteer', 'schemas', file),
      path.join(schemaRoot, file)
    );
  }
  writeJson(path.join(root, '.world-puppeteer', 'reference-packs', 'index.json'), {
    schemaVersion: 1,
    packs: [],
  });
}

function marker(id, overrides = {}) {
  return {
    schemaVersion: 1,
    id,
    name: id,
    role: 'editable',
    format: 'voyage-v33',
    toolchain: {
      formatProfile: 'voyage-json-tabs',
      buildProfile: 'world-build-cjs',
      validationProfiles: ['voyage-local-validator'],
    },
    activeProfiles: [],
    ...overrides,
    paths: {
      tabs: 'tabs',
      compiledOutput: `${id}.json`,
      instructions: 'AGENTS.override.md',
      ...(overrides.paths || {}),
    },
  };
}

function createWorld(root, id, options = {}) {
  fs.mkdirSync(root, { recursive: true });
  writeJson(path.join(root, '.world-puppeteer.json'), marker(id, options.marker || {}));
  fs.mkdirSync(path.join(root, 'tabs'), { recursive: true });
  writeJson(path.join(root, 'tabs', 'world.json'), {
    configVersion: 'V33',
    heroesVersion: '1.0.0',
    storySettings: { worldBackground: id },
    aiInstructions: {},
  });
  fs.writeFileSync(path.join(root, 'AGENTS.override.md'), '# instructions\n');
}

function runMetadata(root, args = ['--json']) {
  return spawnSync(process.execPath, [path.join(repoRoot, '.claude/scripts/validate-world-puppeteer.cjs'), ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

function metadataErrors(root) {
  const result = runMetadata(root);
  assert(result.status !== 0, `metadata validation should fail for ${root}`);
  try {
    return JSON.parse(result.stdout).errors || [];
  } catch (error) {
    failures.push(`metadata JSON parse failed: ${error.message}: ${result.stdout}${result.stderr}`);
    return [];
  }
}

function trySymlink(target, linkPath, type, label) {
  try {
    fs.symlinkSync(target, linkPath, type);
    return true;
  } catch (error) {
    skipped.push(`${label}: ${error.message}`);
    return false;
  }
}

try {
  const containedRoot = path.join(fixtureRoot, 'contained');
  fs.mkdirSync(path.join(containedRoot, 'tabs'), { recursive: true });
  fs.writeFileSync(path.join(containedRoot, 'tabs', 'world.json'), '{}\n');
  fs.mkdirSync(path.join(containedRoot, 'out'), { recursive: true });

  assertThrows(
    () => resolveContainedPath({
      rootPath: containedRoot,
      relativePath: '../outside.json',
      field: 'paths.compiledOutput',
      kind: 'output',
      expectedType: 'file',
    }),
    /traversal/,
    'lexical traversal must fail'
  );

  assertThrows(
    () => resolveContainedPath({
      rootPath: containedRoot,
      relativePath: path.resolve(fixtureRoot, 'outside.json'),
      field: 'paths.tabs',
      kind: 'input',
      expectedType: 'directory',
    }),
    /absolute paths are not allowed/,
    'absolute marker paths must fail'
  );

  const safeOutput = resolveContainedPath({
    rootPath: containedRoot,
    relativePath: 'out/new.json',
    field: 'paths.compiledOutput',
    kind: 'output',
    expectedType: 'file',
  });
  assert(safeOutput.endsWith(path.join('out', 'new.json')), 'safe missing output must resolve');

  const nestedTabsRoot = path.join(fixtureRoot, 'nested-tabs');
  fs.mkdirSync(path.join(nestedTabsRoot, 'tabs', 'nested'), { recursive: true });
  writeJson(path.join(nestedTabsRoot, 'tabs', 'world.json'), {});
  assertThrows(
    () => loadAndMergeTabs(path.join(nestedTabsRoot, 'tabs')),
    /must be flat/,
    'nested tabs directory must fail'
  );

  const outside = path.join(fixtureRoot, 'outside');
  fs.mkdirSync(outside, { recursive: true });

  const symlinkTabsRoot = path.join(fixtureRoot, 'tabs-symlink-dir');
  fs.mkdirSync(path.join(symlinkTabsRoot, 'tabs'), { recursive: true });
  writeJson(path.join(symlinkTabsRoot, 'tabs', 'world.json'), {});
  if (trySymlink(outside, path.join(symlinkTabsRoot, 'tabs', 'linked'), 'dir', 'tabs directory symlink')) {
    assertThrows(
      () => loadAndMergeTabs(path.join(symlinkTabsRoot, 'tabs')),
      /symlinked entry/,
      'tabs directory symlinks must fail'
    );
  }

  const symlinkFileRoot = path.join(fixtureRoot, 'tabs-symlink-file');
  fs.mkdirSync(path.join(symlinkFileRoot, 'tabs'), { recursive: true });
  fs.writeFileSync(path.join(outside, 'outside.json'), '{}\n');
  if (trySymlink(path.join(outside, 'outside.json'), path.join(symlinkFileRoot, 'tabs', 'linked.json'), 'file', 'symlinked tab file')) {
    assertThrows(
      () => loadAndMergeTabs(path.join(symlinkFileRoot, 'tabs')),
      /symlinked entry/,
      'symlinked tab files must fail'
    );
  }

  const outputSymlinkRoot = path.join(fixtureRoot, 'output-symlink');
  fs.mkdirSync(outputSymlinkRoot, { recursive: true });
  if (trySymlink(outside, path.join(outputSymlinkRoot, 'linked-out'), 'dir', 'output symlink ancestor')) {
    assertThrows(
      () => resolveContainedPath({
        rootPath: outputSymlinkRoot,
        relativePath: 'linked-out/new.json',
        field: 'paths.compiledOutput',
        kind: 'output',
        expectedType: 'file',
      }),
      /symlinked path component|realpath escapes/,
      'unsafe missing output through symlink ancestor must fail'
    );
  }

  const realpathRoot = path.join(fixtureRoot, 'realpath-escape');
  fs.mkdirSync(realpathRoot, { recursive: true });
  if (trySymlink(path.join(outside, 'outside.json'), path.join(realpathRoot, 'escape.json'), 'file', 'realpath escape')) {
    assertThrows(
      () => resolveContainedPath({
        rootPath: realpathRoot,
        relativePath: 'escape.json',
        field: 'paths.instructions',
        kind: 'input',
        expectedType: 'file',
      }),
      /symlinked path component|realpath escapes/,
      'realpath escape must fail closed'
    );
  }

  {
    const root = path.join(fixtureRoot, 'valid-metadata');
    copySchemaFiles(root);
    createWorld(path.join(root, 'world'), 'valid-world');
    const result = runMetadata(root);
    assert(result.status === 0, `valid marker metadata must pass: ${result.stdout}${result.stderr}`);
  }

  {
    const root = path.join(fixtureRoot, 'duplicate-id');
    copySchemaFiles(root);
    createWorld(path.join(root, 'one'), 'same-id');
    createWorld(path.join(root, 'two'), 'same-id');
    assert(
      metadataErrors(root).some((error) => /duplicate world id same-id/.test(error)),
      'duplicate world ids must fail'
    );
  }

  {
    const root = path.join(fixtureRoot, 'duplicate-output');
    copySchemaFiles(root);
    createWorld(path.join(root, 'parent'), 'parent', { marker: { paths: { compiledOutput: 'child/shared.json' } } });
    createWorld(path.join(root, 'parent', 'child'), 'child', { marker: { paths: { compiledOutput: 'shared.json' } } });
    assert(
      metadataErrors(root).some((error) => /duplicate compiled output destination/.test(error)),
      'duplicate output destinations must fail'
    );
  }

  {
    const root = path.join(fixtureRoot, 'overlap-output');
    copySchemaFiles(root);
    createWorld(path.join(root, 'parent'), 'parent', { marker: { paths: { compiledOutput: 'child/out.json' } } });
    createWorld(path.join(root, 'parent', 'child'), 'child');
    assert(
      metadataErrors(root).some((error) => /inside another declared world/.test(error)),
      'compiled output inside descendant world must fail'
    );
  }

  {
    const root = path.join(fixtureRoot, 'missing-tabs');
    copySchemaFiles(root);
    createWorld(path.join(root, 'world'), 'missing-tabs');
    fs.rmSync(path.join(root, 'world', 'tabs'), { recursive: true, force: true });
    assert(
      metadataErrors(root).some((error) => /paths\.tabs.*required path does not exist/.test(error)),
      'missing required declared paths must fail'
    );
  }

  {
    const result = spawnSync(
      process.execPath,
      ['.claude/scripts/validate-world-puppeteer.cjs', '--bogus'],
      { cwd: repoRoot, encoding: 'utf8' }
    );
    assert(result.status !== 0, 'metadata validator unknown arguments must fail');
    assert(/Unknown option: --bogus/.test(result.stderr), 'metadata validator must name unknown arguments');
  }

  {
    const result = spawnSync(
      process.execPath,
      ['.claude/scripts/validate-world-puppeteer.cjs', '--json'],
      { cwd: repoRoot, encoding: 'utf8' }
    );
    assert(result.status === 0, `existing repository markers must pass: ${result.stdout}${result.stderr}`);
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  if (skipped.length > 0) {
    for (const skip of skipped) console.error(`SKIP: ${skip}`);
  }
  process.exit(1);
}

if (skipped.length > 0) {
  for (const skip of skipped) console.warn(`SKIP: ${skip}`);
}

console.log('world path containment tests passed');
