#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  findRepoRoot,
  loadAndMergeTabs,
  resolveWorld,
} = require('./world-puppeteer-lib.cjs');
const {
  validateRepositoryMetadata,
} = require('./validate-world-puppeteer.cjs');

const schemaRoot = findRepoRoot(process.cwd());
const failures = [];
const unsafeRuntimeErrorPattern =
  /Cannot read properties|is not iterable|\.endsWith is not a function|ERR_INVALID_ARG_TYPE|The "(?:path|paths\[\d+\])" argument must be of type string/;

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function marker(id) {
  return {
    schemaVersion: 1,
    id,
    name: id,
    role: 'editable',
    format: 'voyage-v33',
    paths: {
      tabs: 'tabs',
      compiledOutput: `${id}.json`,
      instructions: 'AGENTS.override.md',
    },
    toolchain: {
      formatProfile: 'voyage-json-tabs',
      buildProfile: 'world-build-cjs',
      validationProfiles: ['voyage-local-validator'],
    },
    activeProfiles: [],
  };
}

function writeWorld(worldRoot, value) {
  fs.mkdirSync(path.join(worldRoot, 'tabs'), { recursive: true });
  fs.writeFileSync(path.join(worldRoot, 'AGENTS.override.md'), '# fixture\n');
  writeJson(path.join(worldRoot, '.world-puppeteer.json'), value);
}

function writeSkill(worldRoot, skillId) {
  const skillPath = path.join(worldRoot, '.agents', 'skills', skillId, 'SKILL.md');
  fs.mkdirSync(path.dirname(skillPath), { recursive: true });
  fs.writeFileSync(skillPath, '# skill\n');
}

function acceptedGenerateStoryTab() {
  return {
    aiInstructions: {
      generateStory: {
        'Victory and Downtime': 'Keep victory scenes focused on recovery.',
        'Character Behavior': 'Keep character actions coherent and specific.',
        custom: 'Preserve this custom world field exactly as written.',
      },
    },
  };
}

function captureConsoleJson(fn) {
  const originalLog = console.log;
  let output = '';
  console.log = (...args) => {
    output += `${args.join(' ')}\n`;
  };
  try {
    return { status: fn(), parsed: JSON.parse(output) };
  } finally {
    console.log = originalLog;
  }
}

function validateFixture(repoRoot) {
  return captureConsoleJson(() => validateRepositoryMetadata({
    json: true,
    repoRoot,
    schemaRoot,
    referencePackValidator: () => ({ errors: [], warnings: [] }),
    staleReferenceScanner: () => [],
  }));
}

function assertMetadataFailure(result, expected, label, expectedPath = null) {
  assert(result.status !== 0, `${label}: metadata validation must fail`);
  assert(
    result.parsed.errors.some((entry) => expected.test(entry)),
    `${label}: missing actionable metadata error: ${JSON.stringify(result.parsed.errors)}`
  );
  if (expectedPath) {
    assert(
      result.parsed.errors.some((entry) => entry.includes(expectedPath)),
      `${label}: metadata error must identify ${expectedPath}`
    );
  }
  assert(
    !unsafeRuntimeErrorPattern.test(JSON.stringify(result.parsed)),
    `${label}: metadata validation surfaced unrelated runtime exception`
  );
}

function assertResolveFailure(worldRoot, expected, label, expectedPath = null) {
  try {
    resolveWorld({ worldRoot, preferNearest: false });
    failures.push(`${label}: resolveWorld must fail`);
  } catch (error) {
    assert(expected.test(error.message), `${label}: ${error.message}`);
    if (expectedPath) {
      assert(
        error.message.includes(expectedPath),
        `${label}: resolveWorld error must identify ${expectedPath}`
      );
    }
    assert(
      !unsafeRuntimeErrorPattern.test(error.message),
      `${label}: resolveWorld surfaced unrelated runtime exception: ${error.message}`
    );
  }
}

for (const testCase of [
  {
    label: 'compiledOutput number',
    mutate: (value) => { value.paths.compiledOutput = 42; },
    expected: /\/paths\/compiledOutput: must be string/,
  },
  {
    label: 'tabs object',
    mutate: (value) => { value.paths.tabs = {}; },
    expected: /\/paths\/tabs: must be string/,
  },
  {
    label: 'instructions array',
    mutate: (value) => { value.paths.instructions = ['AGENTS.override.md']; },
    expected: /\/paths\/instructions: must be string/,
  },
  {
    label: 'toolchain non-object',
    mutate: (value) => { value.toolchain = 7; },
    expected: /\/toolchain: must be object/,
  },
  {
    label: 'activeProfiles non-array',
    mutate: (value) => { value.activeProfiles = {}; },
    expected: /\/activeProfiles: must be array/,
  },
  {
    label: 'unknown marker root property',
    mutate: (value) => { value.unexpectedRoot = true; },
    expected: /must NOT have additional properties \(unexpectedRoot\)/,
  },
  {
    label: 'unknown marker paths property',
    mutate: (value) => { value.paths.unexpectedPath = 'spare'; },
    expected: /must NOT have additional properties \(unexpectedPath\)/,
  },
  {
    label: 'unknown marker toolchain property',
    mutate: (value) => { value.toolchain.unexpectedTool = 'spare'; },
    expected: /must NOT have additional properties \(unexpectedTool\)/,
  },
]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-marker-hardening-'));
  const worldRoot = path.join(root, 'world');
  const markerPath = path.join(worldRoot, '.world-puppeteer.json');
  const value = marker(`marker-${testCase.label.replace(/[^a-z]+/g, '-')}`);
  testCase.mutate(value);
  writeWorld(worldRoot, value);
  assertMetadataFailure(validateFixture(root), testCase.expected, testCase.label, markerPath);
  assertResolveFailure(worldRoot, testCase.expected, testCase.label, markerPath);
}

for (const testCase of [
  { label: 'skills number', field: 'skills', value: 7, expected: /\/skills: must be array/ },
  { label: 'skills object', field: 'skills', value: {}, expected: /\/skills: must be array/ },
  { label: 'appliesTo non-array', field: 'appliesTo', value: {}, expected: /\/appliesTo: must be array/ },
  { label: 'skill entry number', field: 'skills', value: [7], expected: /\/skills\/0: must be string/ },
  { label: 'unknown profile root property', field: 'unexpectedRoot', value: true, expected: /must NOT have additional properties \(unexpectedRoot\)/ },
]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-profile-hardening-'));
  const worldRoot = path.join(root, 'world');
  const value = marker('profile-fixture');
  value.activeProfiles = ['fixture-profile'];
  writeWorld(worldRoot, value);
  const profile = {
    schemaVersion: 1,
    id: 'fixture-profile',
    name: 'Fixture Profile',
    description: 'fixture',
    required: false,
    appliesTo: ['profile-fixture'],
    skills: [],
  };
  profile[testCase.field] = testCase.value;
  const profilePath = path.join(
    worldRoot,
    '.world-puppeteer',
    'profiles',
    'fixture-profile.json'
  );
  writeJson(
    profilePath,
    profile
  );
  assertMetadataFailure(validateFixture(root), testCase.expected, testCase.label, profilePath);
  assertResolveFailure(worldRoot, testCase.expected, testCase.label, profilePath);
}

{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-valid-metadata-resolution-'));
  const worldRoot = path.join(root, 'world');
  const markerValue = marker('valid-resolution');
  markerValue.activeProfiles = ['fixture-profile'];
  writeWorld(worldRoot, markerValue);
  writeSkill(worldRoot, 'fixture-skill');
  writeJson(
    path.join(worldRoot, '.world-puppeteer', 'profiles', 'fixture-profile.json'),
    {
      schemaVersion: 1,
      id: 'fixture-profile',
      name: 'Fixture Profile',
      description: 'fixture',
      required: false,
      appliesTo: ['valid-resolution'],
      skills: ['fixture-skill'],
    }
  );
  const tabPath = path.join(worldRoot, 'tabs', 'ai-instructions.json');
  const originalTab = acceptedGenerateStoryTab();
  writeJson(tabPath, originalTab);

  const metadataResult = validateFixture(root);
  assert(metadataResult.status === 0, 'valid marker and profile metadata must pass');

  const resolved = resolveWorld({ worldRoot, preferNearest: false });
  assert(resolved.worldRoot === worldRoot, 'valid marker and profile must resolve');
  assert(resolved.activeProfiles.length === 1, 'valid active profile must load');

  const merged = loadAndMergeTabs(resolved.tabsPath);
  assert(
    JSON.stringify(merged.config.aiInstructions.generateStory) ===
      JSON.stringify(originalTab.aiInstructions.generateStory),
    'world-tab aiInstructions.generateStory siblings must resolve and merge unchanged'
  );
  assert(
    JSON.stringify(JSON.parse(fs.readFileSync(tabPath, 'utf8'))) === JSON.stringify(originalTab),
    'metadata schema validation must not mutate world-tab contents'
  );
}

{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-semantic-after-schema-'));
  const worldRoot = path.join(root, 'world');
  const markerPath = path.join(worldRoot, '.world-puppeteer.json');
  const markerValue = marker('semantic-after-schema');
  markerValue.toolchain.buildProfile = 'missing-build-profile';
  writeWorld(worldRoot, markerValue);

  assertMetadataFailure(
    validateFixture(root),
    /unknown buildProfile: missing-build-profile/,
    'semantic validation after schema',
    markerPath
  );
  assertResolveFailure(
    worldRoot,
    /unknown buildProfile: missing-build-profile/,
    'semantic validation after schema',
    markerPath
  );
}

{
  const importCheck = spawnSync(
    process.execPath,
    [
      '-e',
      `require(${JSON.stringify(path.join(schemaRoot, '.claude/scripts/validate-world-puppeteer.cjs'))}); require('fs').writeSync(3, String(process.exitCode));`,
    ],
    {
      cwd: schemaRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
    }
  );
  assert(importCheck.status === 0, `import-only validator child must exit 0: ${importCheck.status}`);
  assert(importCheck.stdout === '', `import-only validator child must not print stdout: ${JSON.stringify(importCheck.stdout)}`);
  assert(importCheck.stderr === '', `import-only validator child must not print stderr: ${JSON.stringify(importCheck.stderr)}`);
  assert(
    importCheck.output && importCheck.output[3] === 'undefined',
    `import-only validator child must not set process.exitCode: ${JSON.stringify(importCheck.output && importCheck.output[3])}`
  );
}

{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-dangling-profile-dir-'));
  const worldRoot = path.join(root, 'world');
  writeWorld(worldRoot, marker('dangling-profile-dir'));
  const profileParent = path.join(worldRoot, '.world-puppeteer');
  fs.mkdirSync(profileParent, { recursive: true });
  let blocked = false;
  try {
    fs.symlinkSync(
      path.join(worldRoot, 'missing-profile-store'),
      path.join(profileParent, 'profiles'),
      'dir'
    );
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EINVAL' || error.code === 'UNKNOWN') {
      blocked = true;
    } else {
      throw error;
    }
  }
  if (!blocked) {
    const expected = /symlinked profile directories are not allowed/i;
    assertMetadataFailure(validateFixture(root), expected, 'dangling profile-directory symlink');
    assertResolveFailure(worldRoot, expected, 'dangling profile-directory symlink');
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('metadata hardening tests passed');
