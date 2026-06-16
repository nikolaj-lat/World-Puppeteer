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
