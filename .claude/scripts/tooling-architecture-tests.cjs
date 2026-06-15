#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  findMarkers,
  findRepoRoot,
  knownToolchain,
  runFormatProfile,
  runValidationProfile,
  resolveWorld,
} = require('./world-puppeteer-lib.cjs');

const repoRoot = findRepoRoot(process.cwd());
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(fullPath, out);
    else out.push(fullPath);
  }
  return out;
}

function writeMarker(dir, marker) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.world-puppeteer.json'), JSON.stringify(marker, null, 2));
}

function marker(id, role = 'editable') {
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
    appliedMods: [],
  };
}

function assertThrows(fn, matcher, message) {
  try {
    fn();
    failures.push(`${message}: expected error`);
  } catch (error) {
    assert(matcher.test(error.message), `${message}: ${error.message}`);
  }
}

function parseCodexAgentsWithToml() {
  const python = process.env.PYTHON || 'python';
  const script = String.raw`
import json, os, sys, tomllib
root = sys.argv[1]
agents = os.path.join(root, ".codex", "agents")
required = {"name", "description", "model", "model_reasoning_effort", "sandbox_mode", "developer_instructions"}
out = []
errors = []
for filename in sorted(os.listdir(agents)):
    if not filename.endswith(".toml"):
        continue
    path = os.path.join(agents, filename)
    raw = open(path, "rb").read()
    text = raw.decode("utf-8")
    try:
        data = tomllib.loads(text)
    except Exception as exc:
        errors.append(f"{filename}: TOML parse failed: {exc}")
        continue
    missing = sorted(required - set(data))
    if missing:
        errors.append(f"{filename}: missing top-level fields {missing}")
    if "developer_instructions" in data.get("skills", {}):
        errors.append(f"{filename}: developer_instructions is nested under [skills]")
    for idx, config in enumerate(data.get("skills", {}).get("config", []) or []):
        if "developer_instructions" in config:
            errors.append(f"{filename}: developer_instructions is nested in skills.config[{idx}]")
    dev = text.find("developer_instructions")
    cfg = text.find("[[skills.config]]")
    if cfg < 0:
        errors.append(f"{filename}: missing [[skills.config]]")
    elif dev < 0 or dev > cfg:
        errors.append(f"{filename}: developer_instructions must appear before [[skills.config]]")
    controls = sorted(hex(ord(ch)) for ch in set(text) if ord(ch) < 32 and ch not in "\r\n\t")
    if controls:
        errors.append(f"{filename}: malformed control characters {controls}")
    out.append({
        "file": filename,
        "name": data.get("name"),
        "model": data.get("model"),
        "model_reasoning_effort": data.get("model_reasoning_effort"),
        "sandbox_mode": data.get("sandbox_mode"),
        "skill_paths": [item.get("path") for item in data.get("skills", {}).get("config", []) or []],
    })
print(json.dumps({"agents": out, "errors": errors}))
`;
  const result = spawnSync(python, ['-c', script, repoRoot], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`failed to run Python tomllib parser: ${result.stderr || result.stdout}`);
    return [];
  }
  const parsed = JSON.parse(result.stdout);
  for (const error of parsed.errors) failures.push(error);
  return parsed.agents;
}

function runHookDryRun(payload) {
  const result = spawnSync(process.execPath, ['.codex/scripts/post-edit-validate.cjs'], {
    cwd: repoRoot,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, WORLD_PUPPETEER_HOOK_DRY_RUN: '1' },
  });
  assert(result.status === 0, `hook dry-run exited ${result.status}: ${result.stderr || result.stdout}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    failures.push(`hook dry-run did not return JSON: ${result.stdout}\n${result.stderr}`);
    return { affectedWorlds: [], validatedEditableWorlds: [], warnings: [] };
  }
}

const markers = findMarkers(repoRoot);
assert(markers.length >= 3, `expected root, editable, and template world markers, found ${markers.length}`);
assert(markers.some((m) => path.resolve(m.root) === path.resolve(repoRoot) && m.marker.role === 'reference'), 'expected repo root reference marker');
assert(markers.some((m) => m.marker.role === 'editable'), 'expected one editable world marker');
assert(markers.filter((m) => m.marker.role === 'editable').length === 1, 'expected exactly one editable world');

const rootMarker = JSON.parse(read(path.join(repoRoot, '.world-puppeteer.json')));
const rootAgents = read(path.join(repoRoot, 'AGENTS.md'));
assert(rootMarker.paths.instructions === 'AGENTS.md', 'root marker must load AGENTS.md instructions');
assert(!fs.existsSync(path.join(repoRoot, 'AGENTS.override.md')), 'root AGENTS.override.md must not mask AGENTS.md');
assert(rootAgents.includes('repository-root world is a reference world'), 'AGENTS.md must contain root reference-world protection');
assert(rootAgents.includes('Discovery') && rootAgents.includes('Execution') && rootAgents.includes('Review'), 'AGENTS.md must document Discovery, Execution, and Review modes');
assert(rootAgents.includes('Execution and Review must not reopen approved creative decisions'), 'AGENTS.md must prevent Execution/Review from reopening approved decisions');
assert(rootAgents.includes('Before any tooling or world-content task is reported complete'), 'AGENTS.md must document mandatory completion validation');
assert(rootAgents.includes('Arbitrary shell writes are not guaranteed to be detected by hooks'), 'AGENTS.md must document shell-write hook limitations');
for (const forbidden of ['interview is perpetual', 'The Interview Never Ends', 'ALWAYS', 'Never stop interviewing']) {
  assert(!rootAgents.includes(forbidden), `AGENTS.md must not contain perpetual-interview directive: ${forbidden}`);
}
const worldDirectorSkill = read(path.join(repoRoot, '.agents', 'skills', 'world-director', 'SKILL.md'));
assert(worldDirectorSkill.includes('Interview Depth') && worldDirectorSkill.includes('Discovery only'), 'world-director must own detailed interview doctrine');

const hxh = resolveWorld({ worldRoot: path.join(repoRoot, 'hxh_hunter_exam_campaign_rebuild'), preferNearest: false });
assert(hxh.marker.paths.compiledOutput === 'HxH.json', 'HxH compiled output must be HxH.json');
assert(hxh.activeProfiles.length === 2, 'HxH world must resolve two active profiles');

const template = resolveWorld({ worldRoot: path.join(repoRoot, 'templates'), preferNearest: false });
assert(template.marker.role === 'template', 'templates must resolve as template role');

const root = resolveWorld({ worldRoot: repoRoot, preferNearest: false });
assert(root.marker.role === 'reference', 'repo root must resolve as reference role');
assert(root.marker.paths.compiledOutput === 'HxH-Full-Canon-Reference.json', 'root compiled output must be named');

const hxhFromRootCwd = resolveWorld({ cwd: repoRoot });
assert(hxhFromRootCwd.worldRoot === hxh.worldRoot, 'repo-root cwd must resolve the sole editable HxH world');
const hxhFromNestedCwd = resolveWorld({ cwd: path.join(hxh.worldRoot, 'tabs') });
assert(hxhFromNestedCwd.worldRoot === hxh.worldRoot, 'cwd inside HxH must resolve HxH');
const templateFromNestedCwd = resolveWorld({ cwd: path.join(template.worldRoot, 'tabs') });
assert(templateFromNestedCwd.worldRoot === template.worldRoot, 'cwd inside templates must resolve template');
const explicitRootFromHxh = resolveWorld({ worldRoot: repoRoot, cwd: path.join(hxh.worldRoot, 'tabs') });
assert(explicitRootFromHxh.worldRoot === root.worldRoot, 'explicit root target must resolve reference world');
const explicitTemplateFromHxh = resolveWorld({ worldRoot: path.join(repoRoot, 'templates'), cwd: path.join(hxh.worldRoot, 'tabs') });
assert(explicitTemplateFromHxh.worldRoot === template.worldRoot, 'explicit target must outrank cwd marker');

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'world-puppeteer-resolver-'));
writeMarker(path.join(fixtureRoot, 'one'), marker('one'));
writeMarker(path.join(fixtureRoot, 'two'), marker('two'));
assertThrows(
  () => resolveWorld({ repoRoot: fixtureRoot, cwd: fixtureRoot }),
  /Available worlds:\none \(editable\)\ntwo \(editable\)/,
  'multiple editable worlds must list choices and stop',
);
const noEditableRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'world-puppeteer-resolver-'));
writeMarker(path.join(noEditableRoot, 'reference'), marker('reference-world', 'reference'));
assertThrows(
  () => resolveWorld({ repoRoot: noEditableRoot, cwd: noEditableRoot }),
  /Available worlds:\nreference \(reference\)/,
  'no editable worlds must list choices and stop',
);

const skillRoot = path.join(repoRoot, '.agents', 'skills');
for (const obsolete of ['japanese-romanization', 'orchestrator', 'charts', 'count', 'maps', 'reflect']) {
  assert(!fs.existsSync(path.join(skillRoot, obsolete)), `obsolete skill directory remains: ${obsolete}`);
}
for (const required of ['world-director', 'world-capacity', 'world-charts', 'world-maps', 'tooling-reflection', 'species-consistency', 'platform-evidence', 'mod-integration']) {
  assert(fs.existsSync(path.join(skillRoot, required, 'SKILL.md')), `required skill missing: ${required}`);
}

const staleScanRoots = ['.agents', '.codex', '.world-puppeteer', 'docs', 'AGENTS.md'];
const textFiles = staleScanRoots.flatMap((entry) => {
  const fullPath = path.join(repoRoot, entry);
  if (!fs.existsSync(fullPath)) return [];
  return fs.statSync(fullPath).isDirectory() ? listFiles(fullPath) : [fullPath];
}).filter((file) => /\.(md|toml|json|js|cjs|yaml)$/.test(file));
const staleCodexPath = '.Co' + 'dex/';
const staleQuestionTool = 'Ask' + 'UserQuestion';
const staleBackgroundFlag = 'run_in_' + 'background=true';
for (const file of textFiles) {
  const text = read(file);
  assert(!text.includes(staleCodexPath), `${path.relative(repoRoot, file)} contains stale .Codex path`);
  assert(!text.includes(staleQuestionTool), `${path.relative(repoRoot, file)} contains Claude-only structured question tool`);
  assert(!text.includes(staleBackgroundFlag), `${path.relative(repoRoot, file)} contains Claude-only background syntax`);
}

const routineModel = 'gpt-5.4-mini';
const highModel = 'gpt-5.4';
const expected = {
  'build-skill': ['gpt-5.5', 'high', 'workspace-write'],
  'ai-instructions': [highModel, 'high', 'workspace-write'],
  settings: [highModel, 'high', 'workspace-write'],
  'review-npcs': [highModel, 'high', 'read-only'],
  'npc-type-review': [highModel, 'high', 'read-only'],
  'platform-evidence': [highModel, 'high', 'read-only'],
  'species-coordinator': [highModel, 'high', 'read-only'],
  'tooling-reflection': [highModel, 'high', 'read-only'],
  'canon-npcs': [highModel, 'high', 'workspace-write'],
  'mod-integrator': [highModel, 'high', 'workspace-write'],
  'world-director': ['gpt-5.5', 'high', 'workspace-write'],
  'world-capacity': [routineModel, 'medium', 'read-only'],
  'world-charts': [routineModel, 'medium', 'workspace-write'],
  'world-maps': [routineModel, 'medium', 'workspace-write'],
};
const parsedAgents = parseCodexAgentsWithToml();
for (const agent of parsedAgents) {
  const name = agent.name;
  const exp = expected[name] || [routineModel, 'medium', 'workspace-write'];
  assert(agent.model === exp[0], `${agent.file}: expected model ${exp[0]}, got ${agent.model}`);
  assert(agent.model_reasoning_effort === exp[1], `${agent.file}: expected reasoning ${exp[1]}, got ${agent.model_reasoning_effort}`);
  assert(agent.sandbox_mode === exp[2], `${agent.file}: expected sandbox ${exp[2]}, got ${agent.sandbox_mode}`);
  assert(agent.skill_paths.length > 0, `${agent.file}: missing skills.config binding`);
  for (const skillPath of agent.skill_paths) {
    assert(typeof skillPath === 'string' && fs.existsSync(path.join(repoRoot, skillPath)), `${agent.file}: bound skill does not exist: ${skillPath}`);
  }
}
for (const utility of [
  ['world-charts.toml', 'stuff/trigger-chart.html'],
  ['world-maps.toml', 'stuff/world-map.html'],
]) {
  const text = read(path.join(repoRoot, '.codex', 'agents', utility[0]));
  assert(text.includes(utility[1]), `${utility[0]} must name exact permitted output path`);
  assert(text.includes('Do not edit tabs/'), `${utility[0]} must prohibit normal world-content writes`);
  assert(text.includes('post-run diff/status check'), `${utility[0]} must require post-run status inspection`);
}
assert(parsedAgents.find((agent) => agent.name === 'world-capacity')?.sandbox_mode === 'read-only', 'world-capacity must remain read-only');

const directWrite = runHookDryRun({
  hook_event_name: 'PostToolUse',
  tool_name: 'Write',
  tool_input: { file_path: 'hxh_hunter_exam_campaign_rebuild/tabs/npcs.json' },
});
assert(directWrite.validatedEditableWorlds.length === 1 && directWrite.validatedEditableWorlds[0] === 'hxh_hunter_exam_campaign_rebuild', 'direct write must validate only HxH');

const nestedDirectWrite = runHookDryRun({
  cwd: path.join(repoRoot, 'hxh_hunter_exam_campaign_rebuild'),
  hook_event_name: 'PostToolUse',
  tool_name: 'Write',
  tool_input: { file_path: 'tabs/npcs.json' },
});
assert(nestedDirectWrite.validatedEditableWorlds.length === 1 && nestedDirectWrite.validatedEditableWorlds[0] === 'hxh_hunter_exam_campaign_rebuild', 'direct file_path must resolve relative to nested world cwd');

const patchWrite = runHookDryRun({
  hook_event_name: 'PostToolUse',
  tool_name: 'apply_patch',
  tool_input: {
    command: [
      '*** Begin Patch',
      '*** Update File: hxh_hunter_exam_campaign_rebuild/tabs/npcs.json',
      '*** Add File: templates/tabs/new-file.json',
      '*** Delete File: hxh_hunter_exam_campaign_rebuild/tabs/items.json',
      '*** End Patch',
    ].join('\n'),
  },
});
assert(patchWrite.affectedWorlds.includes('hxh_hunter_exam_campaign_rebuild'), 'apply_patch must detect HxH path');
assert(patchWrite.affectedWorlds.includes('templates'), 'apply_patch must detect template path');
assert(patchWrite.validatedEditableWorlds.length === 1 && patchWrite.validatedEditableWorlds[0] === 'hxh_hunter_exam_campaign_rebuild', 'apply_patch must validate only affected editable worlds');

const nestedPatchWrite = runHookDryRun({
  cwd: path.join(repoRoot, 'hxh_hunter_exam_campaign_rebuild'),
  hook_event_name: 'PostToolUse',
  tool_name: 'apply_patch',
  tool_input: {
    command: [
      '*** Begin Patch',
      '*** Update File: tabs/npcs.json',
      '*** End Patch',
    ].join('\n'),
  },
});
assert(nestedPatchWrite.affectedWorlds.length === 1 && nestedPatchWrite.affectedWorlds[0] === 'hxh_hunter_exam_campaign_rebuild', 'nested cwd apply_patch must validate only HxH');

const absoluteSafeWrite = runHookDryRun({
  hook_event_name: 'PostToolUse',
  tool_name: 'Write',
  tool_input: { file_path: path.join(repoRoot, 'hxh_hunter_exam_campaign_rebuild', 'tabs', 'npcs.json') },
});
assert(absoluteSafeWrite.validatedEditableWorlds.length === 1 && absoluteSafeWrite.validatedEditableWorlds[0] === 'hxh_hunter_exam_campaign_rebuild', 'absolute in-repo path must be accepted');

const outsideWrite = runHookDryRun({
  hook_event_name: 'PostToolUse',
  tool_name: 'Write',
  tool_input: { file_path: path.join(os.tmpdir(), 'outside-world-puppeteer.json') },
});
assert(outsideWrite.affectedWorlds.length === 0 && outsideWrite.warnings.some((message) => message.includes('outside repository')), 'out-of-repository paths must be ignored with warning');

const malformedCwdWrite = runHookDryRun({
  cwd: path.join(os.tmpdir(), 'not-inside-world-puppeteer'),
  hook_event_name: 'PostToolUse',
  tool_name: 'Write',
  tool_input: { file_path: 'hxh_hunter_exam_campaign_rebuild/tabs/npcs.json' },
});
assert(malformedCwdWrite.validatedEditableWorlds.includes('hxh_hunter_exam_campaign_rebuild'), 'malformed cwd must fall back to repo root for repo-relative paths');
assert(malformedCwdWrite.warnings.some((message) => message.includes('unsafe hook cwd')), 'malformed cwd must warn');

const metadataEdit = runHookDryRun({
  hook_event_name: 'PostToolUse',
  tool_name: 'Write',
  tool_input: { file_path: 'hxh_hunter_exam_campaign_rebuild/.world-puppeteer/profiles/hxh-canon.json' },
});
assert(metadataEdit.metadataWorlds.includes('hxh_hunter_exam_campaign_rebuild'), 'world profile edits must route as metadata');
assert(metadataEdit.validatedEditableWorlds.length === 0, 'metadata-only edits must not be reported as tabs validation');

const rootToolingEdit = runHookDryRun({
  hook_event_name: 'PostToolUse',
  tool_name: 'Write',
  tool_input: { file_path: '.claude/scripts/world-puppeteer-lib.cjs' },
});
assert(rootToolingEdit.repositoryTooling === true, 'repository tooling edits must route to architecture validation');

const nonWorldEdit = runHookDryRun({
  hook_event_name: 'PostToolUse',
  tool_name: 'Write',
  tool_input: { file_path: '.codex/agents/abilities.toml' },
});
assert(nonWorldEdit.affectedWorlds.length === 0, 'non-world edit must not validate a world');

const unknownPaths = runHookDryRun({
  hook_event_name: 'PostToolUse',
  tool_name: 'apply_patch',
  tool_input: { command: 'patch text without file headers' },
});
assert(unknownPaths.warnings.some((message) => message.includes('final world validation manually')), 'unknown hook paths must warn about final validation');

const toolchain = knownToolchain();
assert(toolchain.formatProfiles.has('voyage-json-tabs'), 'format registry must include voyage-json-tabs');
assert(toolchain.buildProfiles.has('world-build-cjs'), 'build registry must include world-build-cjs');
assert(toolchain.validationProfiles.has('voyage-local-validator'), 'validation registry must include voyage-local-validator');

const mockFormatRuns = [];
const formatRun = runFormatProfile('voyage-json-tabs', hxh, {
  runner: (command, args) => {
    mockFormatRuns.push({ command, args });
    return { status: 0, stdout: '', stderr: '' };
  },
});
assert(formatRun.status === 0, 'mock format dispatch must succeed');
assert(mockFormatRuns[0].args.some((arg) => arg.endsWith(path.join('.claude', 'scripts', 'pretty-print.js'))), 'format dispatch must call pretty-print.js');
assert(mockFormatRuns[0].args.includes(hxh.tabsPath), 'format dispatch must pass resolved tabs path');

const mockValidationRuns = [];
const validationRun = runValidationProfile('voyage-local-validator', hxh, {
  runner: (command, args) => {
    mockValidationRuns.push({ command, args });
    return { status: 0, stdout: '{"errors":[],"warnings":[]}', stderr: '' };
  },
});
assert(validationRun.ok === true, 'mock validation dispatch must parse success JSON');
assert(mockValidationRuns[0].args.some((arg) => arg.endsWith(path.join('.claude', 'scripts', 'validate.js'))), 'validation dispatch must call validate.js');
assert(mockValidationRuns[0].args.includes(hxh.tabsPath) && mockValidationRuns[0].args.includes('--json'), 'validation dispatch must pass resolved tabs path and --json');

const { exitCodeForSpawnResult } = require(path.join(repoRoot, 'hxh_hunter_exam_campaign_rebuild', 'build.cjs'));
assert(exitCodeForSpawnResult({ status: 0 }) === 0, 'build wrapper must preserve zero exit');
assert(exitCodeForSpawnResult({ status: 7 }) === 7, 'build wrapper must preserve non-zero exit');
assert(exitCodeForSpawnResult({ status: null }) === 1, 'build wrapper must treat null status as failure');
assert(exitCodeForSpawnResult({ error: new Error('spawn failed'), status: null }) === 1, 'build wrapper must treat spawn error as failure');

const hxhTimelineSkill = read(path.join(repoRoot, 'hxh_hunter_exam_campaign_rebuild', '.agents', 'skills', 'hxh-timeline', 'SKILL.md'));
const hxhTimelineProfile = JSON.parse(read(path.join(repoRoot, 'hxh_hunter_exam_campaign_rebuild', '.world-puppeteer', 'profiles', 'hxh-timeline.json')));
const hxhOverride = read(path.join(repoRoot, 'hxh_hunter_exam_campaign_rebuild', 'AGENTS.override.md'));
for (const [label, text] of [['timeline skill', hxhTimelineSkill], ['HxH override', hxhOverride]]) {
  assert(text.includes('initial') && text.includes('current campaign phase') && text.includes('canon divergence'), `${label} must distinguish initial anchor, current campaign phase, and canon divergence`);
  assert(!text.includes('campaign present is Year 0'), `${label} must not freeze the campaign present at Year 0`);
  assert(text.includes('not a permanent present'), `${label} must state the 287th Hunter Exam is not a permanent present`);
}
assert(hxhTimelineProfile.description.includes('current-campaign-phase') && hxhTimelineProfile.description.includes('canon-divergence'), 'timeline profile must advertise progression and divergence support');

const modsIndex = JSON.parse(read(path.join(repoRoot, '.world-puppeteer', 'mods', 'index.json')));
for (const modId of modsIndex.mods) {
  const manifest = listFiles(path.join(repoRoot, '.world-puppeteer', 'mods')).find((file) => {
    if (path.basename(file) !== 'mod.json') return false;
    return JSON.parse(read(file)).id === modId;
  });
  assert(!!manifest, `mod index references missing manifest id ${modId}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('tooling architecture tests passed');
