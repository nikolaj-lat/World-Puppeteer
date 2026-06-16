#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const toml = require('smol-toml');
const {
  buildWorldSource,
  findMarkers,
  findRepoRoot,
  loadAndMergeTabs,
  resolveWorld,
  runConfiguredBuild,
} = require('./world-puppeteer-lib.cjs');
const {
  scanStaleReferences,
  staleReferenceTargets,
} = require('./stale-reference-rules.cjs');
const {
  validateRepositoryMetadata,
} = require('./validate-world-puppeteer.cjs');

const repoRoot = findRepoRoot(process.cwd());
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function writeRawJson(filePath, rawJson) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${rawJson}\n`);
}

function marker(id, role = 'editable', overrides = {}) {
  return {
    schemaVersion: 1,
    id,
    name: id,
    role,
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
    ...overrides,
  };
}

function writeMarker(dir, value) {
  fs.mkdirSync(path.join(dir, value.paths?.tabs || 'tabs'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, value.paths?.instructions || 'AGENTS.override.md'),
    '# fixture instructions\n'
  );
  writeJson(path.join(dir, '.world-puppeteer.json'), value);
}

function minimalWorldConfig() {
  return {
    configVersion: 'V33',
    heroesVersion: '1.0.0',
    storySettings: { worldBackground: 'A test world.' },
    aiInstructions: {},
    storyStarts: [],
    archetypes: {},
    abilities: {},
    skills: {},
    traits: {},
    items: {},
    factions: {},
    realms: {},
    regions: {},
    locations: {},
    npcTypes: {},
    npcs: {},
    quests: {},
    triggers: [],
  };
}

function writeTabs(worldRoot, tabs) {
  for (const [file, value] of Object.entries(tabs)) writeJson(path.join(worldRoot, 'tabs', file), value);
}

function assertThrows(fn, matcher, message) {
  try {
    fn();
    failures.push(`${message}: expected error`);
  } catch (error) {
    assert(matcher.test(error.message), `${message}: ${error.message}`);
  }
}

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
    input: options.input,
  });
}

function captureConsoleJson(fn) {
  const originalLog = console.log;
  let output = '';
  console.log = (...args) => {
    output += `${args.join(' ')}\n`;
  };
  try {
    const status = fn();
    return {
      status,
      parsed: JSON.parse(output),
    };
  } finally {
    console.log = originalLog;
  }
}

function createSymlinkOrReport(targetPath, linkPath, type = 'file') {
  try {
    fs.symlinkSync(targetPath, linkPath, type);
    return { created: true, blocked: false };
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EINVAL' || error.code === 'UNKNOWN') {
      return { created: false, blocked: true, error };
    }
    throw error;
  }
}

const markers = findMarkers(repoRoot);
assert(markers.length >= 3, `expected root, editable, and template world markers, found ${markers.length}`);
assert(markers.some((entry) => entry.marker.role === 'reference'), 'expected a reference marker');
assert(markers.filter((entry) => entry.marker.role === 'editable').length === 1, 'expected exactly one editable marker');

const root = resolveWorld({ worldRoot: repoRoot, preferNearest: false });
const hxh = resolveWorld({ worldRoot: path.join(repoRoot, 'hxh_hunter_exam_campaign_rebuild'), preferNearest: false });
const template = resolveWorld({ worldRoot: path.join(repoRoot, 'templates'), preferNearest: false });
assert(root.marker.role === 'reference', 'root marker must be reference');
assert(hxh.marker.role === 'editable', 'HxH marker must be editable');
assert(template.marker.role === 'template', 'template marker must be template');
assert(resolveWorld({ cwd: path.join(hxh.worldRoot, 'tabs') }).worldRoot === hxh.worldRoot, 'nearest marker must resolve nested cwd');
assert(resolveWorld({ cwd: repoRoot }).worldRoot === hxh.worldRoot, 'repo root cwd must resolve sole editable world');

const ambiguousRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-resolver-'));
writeMarker(path.join(ambiguousRoot, 'one'), marker('one'));
writeMarker(path.join(ambiguousRoot, 'two'), marker('two'));
assertThrows(
  () => resolveWorld({ repoRoot: ambiguousRoot, cwd: ambiguousRoot }),
  /Unable to resolve target world/,
  'ambiguous editable worlds must fail'
);

const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-profiles-'));
writeMarker(profileRoot, marker('profile-world', 'editable', { activeProfiles: ['required-profile'] }));
fs.mkdirSync(path.join(profileRoot, '.agents', 'skills', 'required-skill'), { recursive: true });
fs.writeFileSync(path.join(profileRoot, '.agents', 'skills', 'required-skill', 'SKILL.md'), '# skill\n');
writeJson(path.join(profileRoot, '.world-puppeteer', 'profiles', 'required-profile.json'), {
  schemaVersion: 1,
  id: 'required-profile',
  name: 'Required Profile',
  description: 'Required profile fixture',
  required: true,
  appliesTo: ['profile-world'],
  skills: ['required-skill'],
});
assert(resolveWorld({ worldRoot: profileRoot, preferNearest: false }).activeProfiles.length === 1, 'required active profile must resolve');
writeMarker(profileRoot, marker('profile-world', 'editable', { activeProfiles: [] }));
assertThrows(
  () => resolveWorld({ worldRoot: profileRoot, preferNearest: false }),
  /Required profile is not active/,
  'missing required profile must fail'
);
writeJson(path.join(profileRoot, '.world-puppeteer', 'profiles', 'required-profile.json'), {
  schemaVersion: 1,
  id: 'required-profile',
  name: 'Required Profile',
  description: 'Required profile fixture',
  required: false,
  appliesTo: ['profile-world'],
  skills: ['required-skill'],
});
writeMarker(profileRoot, marker('profile-world', 'editable', { activeProfiles: ['missing-profile'] }));
assertThrows(
  () => resolveWorld({ worldRoot: profileRoot, preferNearest: false }),
  /Active profile not found locally/,
  'unknown active profile must fail'
);

const mergeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-merge-'));
writeTabs(mergeRoot, {
  'b.json': { worldBackground: 'hoisted' },
  'a.json': {
    configVersion: 'V33',
    storySettings: { questGenerationGuidance: 'guidance' },
  },
});
const merged = loadAndMergeTabs(path.join(mergeRoot, 'tabs'));
assert(
  merged.config.storySettings.worldBackground === 'hoisted',
  'worldBackground hoist must be explicit'
);
assert(
  merged.config.storySettings.questGenerationGuidance === 'guidance',
  'disjoint nested storySettings fields must merge'
);
assert(
  merged.files.map((file) => path.basename(file)).join(',') === 'a.json,b.json',
  'tab files must load in deterministic lexical order'
);

const duplicateLeafRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-merge-leaf-'));
writeTabs(duplicateLeafRoot, {
  'a.json': { storySettings: { worldBackground: 'A' } },
  'b.json': { storySettings: { worldBackground: 'B' } },
});
assertThrows(
  () => loadAndMergeTabs(path.join(duplicateLeafRoot, 'tabs')),
  /Tab merge collision at "storySettings\.worldBackground".*a\.json.*b\.json/s,
  'duplicate nested leaves must name the full path and both files'
);

const objectScalarRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-merge-object-scalar-'));
writeTabs(objectScalarRoot, {
  'a.json': { storySettings: { worldBackground: 'A' } },
  'b.json': { storySettings: 'invalid' },
});
assertThrows(
  () => loadAndMergeTabs(path.join(objectScalarRoot, 'tabs')),
  /Tab merge collision at "storySettings" \(object vs scalar\).*a\.json.*b\.json/s,
  'object versus scalar collisions must fail'
);

const objectArrayRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-merge-object-array-'));
writeTabs(objectArrayRoot, {
  'a.json': { storySettings: { worldBackground: 'A' } },
  'b.json': { storySettings: [] },
});
assertThrows(
  () => loadAndMergeTabs(path.join(objectArrayRoot, 'tabs')),
  /Tab merge collision at "storySettings" \(object vs array\).*a\.json.*b\.json/s,
  'object versus array collisions must fail'
);

const arrayArrayRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-merge-array-array-'));
writeTabs(arrayArrayRoot, {
  'a.json': { triggers: [] },
  'b.json': { triggers: [] },
});
assertThrows(
  () => loadAndMergeTabs(path.join(arrayArrayRoot, 'tabs')),
  /Tab merge collision at "triggers" \(array vs array\).*a\.json.*b\.json/s,
  'duplicate arrays must fail instead of concatenating'
);

const buildRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-build-'));
writeMarker(buildRoot, marker('build-world'));
writeTabs(buildRoot, { 'world.json': minimalWorldConfig() });
const buildWorld = resolveWorld({ worldRoot: buildRoot, preferNearest: false });
fs.writeFileSync(buildWorld.compiledOutputPath, '{"prior":true}\n');
const failingRunner = () => ({ status: 1, stdout: '{"errors":[{"path":"fixture","message":"nope"}],"warnings":[]}', stderr: '' });
assertThrows(
  () => buildWorldSource(buildWorld, { runner: failingRunner }),
  /Compiled candidate failed/,
  'failed candidate validation must fail build'
);
assert(read(buildWorld.compiledOutputPath) === '{"prior":true}\n', 'failed validation must leave compiled output byte-for-byte unchanged');
assert(!fs.readdirSync(buildRoot).some((name) => name.startsWith('.world-puppeteer-build-')), 'failed build must clean temp file');
const passingRunner = () => ({ status: 0, stdout: '{"errors":[],"warnings":[]}', stderr: '' });
const buildResult = buildWorldSource(buildWorld, { runner: passingRunner });
assert(JSON.parse(read(buildWorld.compiledOutputPath)).configVersion === 'V33', 'successful build must replace output');
assert(buildResult.backupPath && fs.existsSync(buildResult.backupPath), 'successful build must create backup after validation');
assert(Array.isArray(buildResult.validationRuns) && buildResult.validationRuns.length === 1, 'build must return candidate validation runs');
assert(buildResult.validationRuns[0].ok === true, 'successful build must preserve successful candidate validation results');
const configuredBuild = runConfiguredBuild(buildWorld, { runner: passingRunner, noBackup: true });
assert(configuredBuild.status === 0 && configuredBuild.output.validationRuns.length === 1, 'configured build must surface candidate validation runs');

const badBuildCli = runNode(['.claude/scripts/build-world.cjs', '--wrold', buildRoot]);
assert(badBuildCli.status !== 0 && /Unknown option/.test(badBuildCli.stderr), 'build CLI must reject unknown flags');
const buildCompatCli = runNode(['.claude/scripts/build.js', '--help']);
assert(buildCompatCli.status === 0 && /build-world\.cjs/.test(buildCompatCli.stdout), 'build compatibility wrapper must delegate CLI help to build-world.cjs');
const badValidateCli = runNode(['.claude/scripts/validate.js', '--wrold', buildRoot]);
assert(badValidateCli.status !== 0 && /Unknown option/.test(badValidateCli.stderr), 'validate CLI must reject unknown flags');
const localBuildWrapper = read(path.join(repoRoot, 'hxh_hunter_exam_campaign_rebuild', 'build.cjs'));
assert(localBuildWrapper.includes(".claude', 'scripts', 'build-world.cjs"), 'world-local build wrapper must target the canonical build script');
assert(localBuildWrapper.includes("[script, '--world', __dirname]"), 'world-local build wrapper must delegate with the resolved world root');

const malformedHook = runNode(['.codex/scripts/post-edit-validate.cjs'], { input: '{ broken' });
assert(malformedHook.status === 0 && /"decision":"block"/.test(malformedHook.stdout), 'malformed hook JSON must block');
const missingPathHook = runNode(['.codex/scripts/post-edit-validate.cjs'], {
  input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: {} }),
});
assert(missingPathHook.status === 0 && /"decision":"block"/.test(missingPathHook.stdout), 'missing changed path must block');
const dryHook = runNode(['.codex/scripts/post-edit-validate.cjs'], {
  env: { WORLD_PUPPETEER_HOOK_DRY_RUN: '1' },
  input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'hxh_hunter_exam_campaign_rebuild/tabs/npcs.json' } }),
});
assert(dryHook.status === 0 && /hxh_hunter_exam_campaign_rebuild/.test(dryHook.stdout), 'hook dry-run must classify HxH tab edits');

const agentDir = path.join(repoRoot, '.codex', 'agents');
for (const file of fs.readdirSync(agentDir).filter((name) => name.endsWith('.toml'))) {
  const text = read(path.join(agentDir, file));
  let parsed;
  try {
    parsed = toml.parse(text);
  } catch (error) {
    failures.push(`${file}: TOML parse failed: ${error.message}`);
    continue;
  }
  for (const key of ['name', 'description', 'model', 'model_reasoning_effort', 'sandbox_mode', 'developer_instructions']) {
    assert(parsed[key] !== undefined, `${file}: missing ${key}`);
  }
  assert(Array.isArray(parsed.skills?.config), `${file}: missing [[skills.config]]`);
}

const staleTargets = staleReferenceTargets(repoRoot);
assert(
  staleTargets.some((file) => file.endsWith(path.join('.agents', 'skills', 'world-capacity', 'SKILL.md'))),
  'stale-reference scan must cover .agents skills'
);
assert(
  staleTargets.some((file) => file.endsWith(path.join('.codex', 'agents', 'world-lore.toml'))),
  'stale-reference scan must cover .codex agents'
);
assert(
  staleTargets.some((file) => file.endsWith(path.join('README.md'))),
  'stale-reference scan must cover root tooling documentation'
);
for (const failure of scanStaleReferences(repoRoot)) {
  failures.push(failure);
}

{
  const invalidMarkerCases = [
    { label: 'null', raw: 'null', expected: /marker root must be a plain object; received null/ },
    { label: 'array', raw: '[]', expected: /marker root must be a plain object; received array/ },
    { label: 'string', raw: '"marker"', expected: /marker root must be a plain object; received string/ },
    { label: 'number', raw: '42', expected: /marker root must be a plain object; received number/ },
  ];

  for (const testCase of invalidMarkerCases) {
    const metadataRoot = fs.mkdtempSync(path.join(os.tmpdir(), `wp-marker-root-${testCase.label}-`));
    const worldRoot = path.join(metadataRoot, `world-${testCase.label}`);
    fs.mkdirSync(path.join(worldRoot, 'tabs'), { recursive: true });
    fs.writeFileSync(path.join(worldRoot, 'AGENTS.override.md'), '# fixture instructions\n');
    writeRawJson(path.join(worldRoot, '.world-puppeteer.json'), testCase.raw);

    const result = captureConsoleJson(() => validateRepositoryMetadata({
      json: true,
      repoRoot: metadataRoot,
      schemaRoot: repoRoot,
      referencePackValidator: () => ({ errors: [], warnings: [] }),
      staleReferenceScanner: () => [],
    }));

    assert(result.status === 1, `metadata validation must fail for marker root ${testCase.label}`);
    assert(
      result.parsed.errors.some((entry) => testCase.expected.test(entry)),
      `metadata validation must report plain-object marker error for ${testCase.label}`
    );
    assert(
      !JSON.stringify(result.parsed).includes('Cannot read properties'),
      `metadata validation must not surface property-access exceptions for marker root ${testCase.label}`
    );

    assertThrows(
      () => resolveWorld({ worldRoot, preferNearest: false }),
      testCase.expected,
      `resolveWorld must reject marker root ${testCase.label} with an actionable error`
    );
  }
}

{
  const invalidProfileCases = [
    { label: 'null', raw: 'null', expected: /profile root must be a plain object; received null/ },
    { label: 'array', raw: '[]', expected: /profile root must be a plain object; received array/ },
    { label: 'string', raw: '"profile"', expected: /profile root must be a plain object; received string/ },
    { label: 'number', raw: '7', expected: /profile root must be a plain object; received number/ },
  ];

  for (const testCase of invalidProfileCases) {
    const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), `wp-profile-root-${testCase.label}-`));
    writeMarker(profileRoot, marker('profile-fixture', 'editable', { activeProfiles: ['fixture-profile'] }));
    writeRawJson(
      path.join(profileRoot, '.world-puppeteer', 'profiles', 'fixture-profile.json'),
      testCase.raw
    );

    const result = captureConsoleJson(() => validateRepositoryMetadata({
      json: true,
      repoRoot: profileRoot,
      schemaRoot: repoRoot,
      referencePackValidator: () => ({ errors: [], warnings: [] }),
      staleReferenceScanner: () => [],
    }));

    assert(result.status === 1, `metadata validation must fail for profile root ${testCase.label}`);
    assert(
      result.parsed.errors.some((entry) => testCase.expected.test(entry)),
      `metadata validation must report plain-object profile error for ${testCase.label}`
    );
    assert(
      !JSON.stringify(result.parsed).includes('Cannot read properties'),
      `metadata validation must not surface property-access exceptions for profile root ${testCase.label}`
    );

    assertThrows(
      () => resolveWorld({ worldRoot: profileRoot, preferNearest: false }),
      testCase.expected,
      `resolveWorld must reject profile root ${testCase.label} with an actionable error`
    );
  }
}

{
  const metadataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-metadata-'));
  writeMarker(path.join(metadataRoot, 'missing-paths'), {
    ...marker('missing-paths'),
    paths: undefined,
  });
  writeMarker(path.join(metadataRoot, 'missing-output'), {
    ...marker('missing-output'),
    paths: {
      tabs: 'tabs',
      instructions: 'AGENTS.override.md',
    },
  });
  writeMarker(path.join(metadataRoot, 'traversal-output'), {
    ...marker('traversal-output'),
    paths: {
      tabs: 'tabs',
      compiledOutput: '../escape.json',
      instructions: 'AGENTS.override.md',
    },
  });
  writeMarker(path.join(metadataRoot, 'duplicate-a'), {
    ...marker('duplicate-id'),
    paths: undefined,
  });
  writeMarker(path.join(metadataRoot, 'duplicate-b'), {
    ...marker('duplicate-id'),
    paths: {
      tabs: 'tabs',
      instructions: 'AGENTS.override.md',
    },
  });

  const result = captureConsoleJson(() => validateRepositoryMetadata({
    json: true,
    repoRoot: metadataRoot,
    schemaRoot: repoRoot,
    referencePackValidator: () => ({ errors: [], warnings: [] }),
    staleReferenceScanner: () => [],
  }));

  assert(result.status === 1, 'metadata validation must return nonzero for malformed markers');
  assert(Array.isArray(result.parsed.errors), 'metadata validation JSON output must contain errors');
  assert(
    result.parsed.errors.some((entry) => entry.includes('missing-paths') && entry.includes('paths')),
    'metadata validation must report missing paths'
  );
  assert(
    result.parsed.errors.some((entry) => entry.includes('missing-output') && entry.includes('paths.compiledOutput')),
    'metadata validation must report missing compiledOutput'
  );
  assert(
    result.parsed.errors.some((entry) => entry.includes('traversal-output') && entry.includes('paths.compiledOutput')),
    'metadata validation must report invalid traversal paths'
  );
  assert(
    result.parsed.errors.some((entry) => entry.includes('duplicate world id duplicate-id')),
    'metadata validation must still report duplicate ids for malformed markers with valid ids'
  );
}

{
  const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-profile-validation-'));
  writeMarker(profileRoot, marker('profile-fixture'));
  const localProfileRoot = path.join(profileRoot, '.world-puppeteer', 'profiles');
  fs.mkdirSync(localProfileRoot, { recursive: true });
  fs.mkdirSync(path.join(localProfileRoot, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(localProfileRoot, 'README.md'), '# unsupported\n');
  writeJson(path.join(localProfileRoot, 'valid-profile.json'), {
    schemaVersion: 1,
    id: 'valid-profile',
    name: 'Valid Profile',
    description: 'fixture',
    required: false,
    appliesTo: ['profile-fixture'],
    skills: [],
  });

  let symlinkBlocked = false;
  try {
    fs.symlinkSync(path.join(localProfileRoot, 'valid-profile.json'), path.join(localProfileRoot, 'linked-profile.json'));
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EINVAL' || error.code === 'UNKNOWN') {
      symlinkBlocked = true;
    } else {
      throw error;
    }
  }

  const result = captureConsoleJson(() => validateRepositoryMetadata({
    json: true,
    repoRoot: profileRoot,
    schemaRoot: repoRoot,
    referencePackValidator: () => ({ errors: [], warnings: [] }),
    staleReferenceScanner: () => [],
  }));

  assert(
    result.parsed.errors.some((entry) => entry.includes('nested directories are not allowed')),
    'metadata validation must reject nested profile directories'
  );
  assert(
    result.parsed.errors.some((entry) => entry.includes('README.md') && entry.includes('only .json files are allowed')),
    'metadata validation must reject unexpected non-JSON profile entries'
  );
  if (!symlinkBlocked) {
    assert(
      result.parsed.errors.some((entry) => entry.includes('linked-profile.json') && entry.includes('symlinked profile entries are not allowed')),
      'metadata validation must reject symlinked profile entries'
    );
  }
}

{
  const resolveProfileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-resolve-profiles-'));
  writeMarker(resolveProfileRoot, marker('resolve-profile-world', 'editable', { activeProfiles: ['valid-profile'] }));
  const localProfileRoot = path.join(resolveProfileRoot, '.world-puppeteer', 'profiles');
  fs.mkdirSync(localProfileRoot, { recursive: true });
  writeJson(path.join(localProfileRoot, 'valid-profile.json'), {
    schemaVersion: 1,
    id: 'valid-profile',
    name: 'Valid Profile',
    description: 'fixture',
    required: false,
    appliesTo: ['resolve-profile-world'],
    skills: [],
  });

  assert(
    resolveWorld({ worldRoot: resolveProfileRoot, preferNearest: false }).activeProfiles.length === 1,
    'resolveWorld must accept a valid flat profile directory'
  );

  fs.writeFileSync(path.join(localProfileRoot, 'README.md'), '# unsupported\n');
  assertThrows(
    () => resolveWorld({ worldRoot: resolveProfileRoot, preferNearest: false }),
    /unexpected profile entry; only \.json files are allowed/,
    'resolveWorld must reject unexpected non-JSON profile entries'
  );
  fs.rmSync(path.join(localProfileRoot, 'README.md'), { force: true });

  fs.mkdirSync(path.join(localProfileRoot, 'nested'), { recursive: true });
  assertThrows(
    () => resolveWorld({ worldRoot: resolveProfileRoot, preferNearest: false }),
    /nested directories are not allowed in \.world-puppeteer\/profiles/,
    'resolveWorld must reject nested profile directories'
  );
  fs.rmSync(path.join(localProfileRoot, 'nested'), { recursive: true, force: true });

  const linkedProfilePath = path.join(localProfileRoot, 'linked-profile.json');
  const linkedProfile = createSymlinkOrReport(
    path.join(localProfileRoot, 'valid-profile.json'),
    linkedProfilePath,
    'file'
  );
  if (!linkedProfile.blocked) {
    assertThrows(
      () => resolveWorld({ worldRoot: resolveProfileRoot, preferNearest: false }),
      /symlinked profile entries are not allowed/,
      'resolveWorld must reject symlinked profile entries'
    );
    fs.rmSync(linkedProfilePath, { force: true });
  }
}

{
  const symlinkedProfileDirRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-profile-dir-link-'));
  writeMarker(symlinkedProfileDirRoot, marker('symlinked-profile-dir'));
  const profileParent = path.join(symlinkedProfileDirRoot, '.world-puppeteer');
  const targetProfileDir = path.join(symlinkedProfileDirRoot, 'profile-store');
  fs.mkdirSync(profileParent, { recursive: true });
  fs.mkdirSync(targetProfileDir, { recursive: true });
  writeJson(path.join(targetProfileDir, 'valid-profile.json'), {
    schemaVersion: 1,
    id: 'valid-profile',
    name: 'Valid Profile',
    description: 'fixture',
    required: false,
    appliesTo: ['symlinked-profile-dir'],
    skills: [],
  });

  const linkedDirectory = createSymlinkOrReport(
    targetProfileDir,
    path.join(profileParent, 'profiles'),
    'dir'
  );
  if (!linkedDirectory.blocked) {
    assertThrows(
      () => resolveWorld({ worldRoot: symlinkedProfileDirRoot, preferNearest: false }),
      /Invalid profile directory .*symlink/is,
      'resolveWorld must reject a symlinked profile directory'
    );
  }
}

{
  const staleWorldRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-stale-world-'));
  const customInstructions = 'WORLD-INSTRUCTIONS.md';
  writeMarker(staleWorldRoot, marker('stale-world', 'editable', {
    paths: {
      tabs: 'tabs',
      compiledOutput: 'stale-world.json',
      instructions: customInstructions,
    },
  }));
  fs.writeFileSync(path.join(staleWorldRoot, customInstructions), '# instruction file\n');
  fs.mkdirSync(path.join(staleWorldRoot, '.agents', 'skills', 'stale-skill'), { recursive: true });
  fs.writeFileSync(path.join(staleWorldRoot, '.agents', 'skills', 'stale-skill', 'SKILL.md'), 'mentions create-checklist.js\n');
  const staleWorldPaths = {
    worldRoot: staleWorldRoot,
    instructionsPath: path.join(staleWorldRoot, customInstructions),
  };
  const staleWorldTargets = staleReferenceTargets(repoRoot, {
    validatedWorlds: [staleWorldPaths],
  });
  assert(
    staleWorldTargets.some((file) => file === path.join(staleWorldRoot, customInstructions)),
    'stale-reference targets must include validated marker instruction files'
  );
  assert(
    staleWorldTargets.some((file) => file.endsWith(path.join('.agents', 'skills', 'stale-skill', 'SKILL.md'))),
    'stale-reference targets must include world-local skill directories'
  );
  assert(
    scanStaleReferences(repoRoot, { validatedWorlds: [staleWorldPaths] })
      .some((entry) => entry.includes('stale-skill') && entry.includes('references create-checklist.js')),
    'stale-reference scan must report stale references from world-local skills'
  );
}

{
  const allowedPatterns = [
    /repository-root tabs\.\//,
    /literal `tabs\/` directory/,
  ];
  const operationalPatterns = [
    /Edit `tabs\/[^`]+`/,
    /You .*`tabs\/[^`]+`/,
    /Review and refine .*`tabs\/[^`]+`/,
    /read `tabs\/[^`]+`/i,
    /write .*`tabs\/[^`]+`/i,
    /look up .*`tabs\/[^`]+`/i,
    /check .*`tabs\/[^`]+`/i,
    /add .*`tabs\/[^`]+`/i,
    /Do not edit `tabs\/\*\.json`/i,
    /It must not edit `tabs\/`/i,
  ];
  const activeInstructionFiles = [
    ...fs.readdirSync(path.join(repoRoot, '.claude', 'agents')).map((name) => path.join(repoRoot, '.claude', 'agents', name)),
    ...fs.readdirSync(path.join(repoRoot, '.claude', 'skills'))
      .map((name) => path.join(repoRoot, '.claude', 'skills', name, 'SKILL.md'))
      .filter((file) => fs.existsSync(file)),
    ...fs.readdirSync(path.join(repoRoot, '.agents', 'skills'))
      .map((name) => path.join(repoRoot, '.agents', 'skills', name, 'SKILL.md'))
      .filter((file) => fs.existsSync(file)),
    ...fs.readdirSync(path.join(repoRoot, '.codex', 'agents'))
      .filter((name) => name.endsWith('.toml'))
      .map((name) => path.join(repoRoot, '.codex', 'agents', name)),
  ];

  for (const file of activeInstructionFiles) {
    const relative = path.relative(repoRoot, file);
    for (const [index, line] of read(file).split(/\r?\n/).entries()) {
      if (!line.includes('tabs/')) continue;
      if (allowedPatterns.some((pattern) => pattern.test(line))) continue;
      if (operationalPatterns.some((pattern) => pattern.test(line))) {
        failures.push(`${relative}:${index + 1}: operational instruction must use TABS_PATH instead of literal tabs/`);
      }
    }
  }
}

if (fs.existsSync(path.join(repoRoot, '.world-puppeteer', 'mods'))) {
  failures.push('.world-puppeteer/mods must be migrated to reference-packs');
}
for (const obsolete of [
  '.world-puppeteer/schemas/mod.schema.json',
  '.world-puppeteer/schemas/mod-integration-plan.schema.json',
  '.codex/agents/mod-integrator.toml',
  '.agents/skills/mod-integration/SKILL.md',
]) {
  assert(!fs.existsSync(path.join(repoRoot, obsolete)), `obsolete mod artifact remains: ${obsolete}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('tooling architecture tests passed');
