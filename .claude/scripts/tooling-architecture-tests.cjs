#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  findMarkers,
  findRepoRoot,
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

function parseTomlValue(text, key) {
  const match = text.match(new RegExp(`^${key}\\s*=\\s*\"([^\"]+)\"`, 'm'));
  return match ? match[1] : null;
}

const markers = findMarkers(repoRoot);
assert(markers.length === 3, `expected 3 world markers, found ${markers.length}`);
assert(markers.some((m) => m.marker.role === 'editable'), 'expected one editable world marker');
assert(markers.filter((m) => m.marker.role === 'editable').length === 1, 'expected exactly one editable world');

const hxh = resolveWorld({ worldRoot: path.join(repoRoot, 'hxh_hunter_exam_campaign_rebuild'), preferNearest: false });
assert(hxh.marker.paths.compiledOutput === 'HxH.json', 'HxH compiled output must be HxH.json');
assert(hxh.activeProfiles.length === 2, 'HxH world must resolve two active profiles');

const template = resolveWorld({ worldRoot: path.join(repoRoot, 'templates'), preferNearest: false });
assert(template.marker.role === 'template', 'templates must resolve as template role');

const root = resolveWorld({ worldRoot: repoRoot, preferNearest: false });
assert(root.marker.role === 'reference', 'repo root must resolve as reference role');
assert(root.marker.paths.compiledOutput === 'HxH-Full-Canon-Reference.json', 'root compiled output must be named');

const skillRoot = path.join(repoRoot, '.agents', 'skills');
for (const obsolete of ['japanese-romanization', 'orchestrator', 'charts', 'count', 'maps', 'reflect']) {
  assert(!fs.existsSync(path.join(skillRoot, obsolete)), `obsolete skill directory remains: ${obsolete}`);
}
for (const required of ['world-director', 'world-capacity', 'world-charts', 'world-maps', 'tooling-reflection', 'species-consistency', 'platform-evidence', 'mod-integration']) {
  assert(fs.existsSync(path.join(skillRoot, required, 'SKILL.md')), `required skill missing: ${required}`);
}

const staleScanRoots = ['.agents', '.codex', '.world-puppeteer', 'docs', 'AGENTS.md', 'AGENTS.override.md'];
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

const agentsRoot = path.join(repoRoot, '.codex', 'agents');
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
  'world-charts': [routineModel, 'medium', 'read-only'],
  'world-maps': [routineModel, 'medium', 'read-only'],
};
for (const file of fs.readdirSync(agentsRoot).filter((name) => name.endsWith('.toml'))) {
  const fullPath = path.join(agentsRoot, file);
  const text = read(fullPath);
  const name = parseTomlValue(text, 'name');
  const model = parseTomlValue(text, 'model');
  const effort = parseTomlValue(text, 'model_reasoning_effort');
  const sandbox = parseTomlValue(text, 'sandbox_mode');
  const exp = expected[name] || [routineModel, 'medium', 'workspace-write'];
  assert(model === exp[0], `${file}: expected model ${exp[0]}, got ${model}`);
  assert(effort === exp[1], `${file}: expected reasoning ${exp[1]}, got ${effort}`);
  assert(sandbox === exp[2], `${file}: expected sandbox ${exp[2]}, got ${sandbox}`);
  assert(text.includes('[[skills.config]]'), `${file}: missing skills.config binding`);
}

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
