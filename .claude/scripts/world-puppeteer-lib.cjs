const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MARKER_FILE = '.world-puppeteer.json';
const KNOWN_FORMATS = new Set(['voyage-v33']);
const TIMEOUT_MS = 120000;

const FORMAT_PROFILES = {
  'voyage-json-tabs': {
    kind: 'node-script',
    script: '.claude/scripts/pretty-print.js',
    args: ({ world }) => [world.tabsPath],
  },
};

const SUPPORTED_MOD_APPLICATION_PROFILES = new Set(['reference-only', 'additive', 'structured-merge', 'template-copy', 'manual']);
const SUPPORTED_MOD_MODES = new Set(['reference', 'apply']);
const NON_PAYLOAD_MOD_FILES = new Set(['mod.json', 'README.md']);

const BUILD_PROFILES = {
  'world-build-cjs': {
    kind: 'internal-build',
    args: ({ world }) => [world.worldRoot],
  },
};

const VALIDATION_PROFILES = {
  'voyage-local-validator': {
    kind: 'node-script',
    script: '.claude/scripts/validate.js',
    args: ({ world }) => [world.tabsPath, '--json'],
    output: 'json',
  },
};

function findRepoRoot(startDir = process.cwd()) {
  let dir = path.resolve(startDir);
  let markerFallback = null;
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    if (!markerFallback && fs.existsSync(path.join(dir, MARKER_FILE))) markerFallback = dir;
    const parent = path.dirname(dir);
    if (parent === dir) return markerFallback || path.resolve(startDir);
    dir = parent;
  }
}

function isInside(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function isSafeRelativePath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !path.isAbsolute(value) &&
    !value.split(/[\\/]+/).includes('..')
  );
}

function isSafeRelativeFile(value) {
  return isSafeRelativePath(value) && !value.endsWith('/') && !value.endsWith('\\');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listFilesRecursive(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) listFilesRecursive(fullPath, out);
    else out.push(fullPath);
  }
  return out;
}

function registryIds(registry) {
  return new Set(Object.keys(registry));
}

function knownToolchain() {
  return {
    formatProfiles: registryIds(FORMAT_PROFILES),
    buildProfiles: registryIds(BUILD_PROFILES),
    validationProfiles: registryIds(VALIDATION_PROFILES),
  };
}

function findMarkers(rootDir) {
  const markers = [];
  const ignored = new Set(['.git', 'node_modules', 'config-backups', 'images', 'stuff']);

  function walk(dir) {
    const markerPath = path.join(dir, MARKER_FILE);
    if (fs.existsSync(markerPath)) {
      markers.push({ root: dir, markerPath, marker: readJson(markerPath) });
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || ignored.has(entry.name)) continue;
      walk(path.join(dir, entry.name));
    }
  }

  walk(path.resolve(rootDir));
  return markers.sort((a, b) => a.root.localeCompare(b.root));
}

function findNearestMarker(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    const markerPath = path.join(dir, MARKER_FILE);
    if (fs.existsSync(markerPath)) {
      return { root: dir, markerPath, marker: readJson(markerPath) };
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function validateMarkerShape(marker, worldRoot) {
  const errors = [];
  const warnings = [];
  const roles = new Set(['editable', 'reference', 'template']);

  if (marker.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(marker.id || '')) errors.push('id must be kebab-case');
  if (!marker.name) errors.push('name is required');
  if (!roles.has(marker.role)) errors.push(`role must be one of ${Array.from(roles).join(', ')}`);
  if (!marker.format) errors.push('format is required');
  if (marker.format && !KNOWN_FORMATS.has(marker.format)) warnings.push(`unknown format: ${marker.format}`);

  const paths = marker.paths || {};
  for (const key of ['tabs', 'compiledOutput', 'instructions']) {
    if (!isSafeRelativePath(paths[key])) errors.push(`paths.${key} must be a relative path without traversal`);
  }
  if (paths.compiledOutput && !paths.compiledOutput.endsWith('.json')) {
    errors.push('paths.compiledOutput must end in .json');
  }
  if (paths.compiledOutput && paths.tabs) {
    const tabsPath = path.resolve(worldRoot, paths.tabs);
    const outputPath = path.resolve(worldRoot, paths.compiledOutput);
    if (isInside(outputPath, tabsPath)) errors.push('paths.compiledOutput must not be inside tabs');
  }

  const toolchain = marker.toolchain || {};
  const toolchainIds = knownToolchain();
  if (!toolchainIds.formatProfiles.has(toolchain.formatProfile)) {
    errors.push(`unknown formatProfile: ${toolchain.formatProfile}`);
  }
  if (!toolchainIds.buildProfiles.has(toolchain.buildProfile)) {
    errors.push(`unknown buildProfile: ${toolchain.buildProfile}`);
  }
  if (!Array.isArray(toolchain.validationProfiles) || toolchain.validationProfiles.length === 0) {
    errors.push('toolchain.validationProfiles must be a non-empty array');
  } else {
    for (const profile of toolchain.validationProfiles) {
      if (!toolchainIds.validationProfiles.has(profile)) errors.push(`unknown validationProfile: ${profile}`);
    }
  }
  if (!Array.isArray(marker.activeProfiles)) errors.push('activeProfiles must be an array');
  if (!Array.isArray(marker.appliedMods)) errors.push('appliedMods must be an array');
  for (const [index, record] of (marker.appliedMods || []).entries()) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`appliedMods[${index}] must be an object`);
      continue;
    }
    for (const key of ['modId', 'version', 'mode', 'appliedAt', 'sourceFiles', 'operations']) {
      if (!(key in record)) errors.push(`appliedMods[${index}].${key} is required`);
    }
    if (record.modId && !/^[a-z0-9][a-z0-9-]*$/.test(record.modId)) errors.push(`appliedMods[${index}].modId must be kebab-case`);
    if (record.mode && !SUPPORTED_MOD_MODES.has(record.mode)) errors.push(`appliedMods[${index}].mode is invalid`);
    if ('sourceFiles' in record && !Array.isArray(record.sourceFiles)) errors.push(`appliedMods[${index}].sourceFiles must be an array`);
    if ('operations' in record && !Array.isArray(record.operations)) errors.push(`appliedMods[${index}].operations must be an array`);
  }

  return { errors, warnings };
}

function listModPayloadFiles(modDir) {
  return listFilesRecursive(modDir)
    .map((file) => path.relative(modDir, file).replace(/\\/g, '/'))
    .filter((relative) => !NON_PAYLOAD_MOD_FILES.has(relative))
    .sort();
}

function validateModManifest(modDir) {
  const errors = [];
  const warnings = [];
  const modPath = path.join(modDir, 'mod.json');
  if (!fs.existsSync(modPath)) return { manifest: null, errors: [`${modDir}: missing mod.json`], warnings };
  const manifest = readJson(modPath);
  const required = [
    'schemaVersion',
    'id',
    'name',
    'version',
    'description',
    'compatibleFormats',
    'domains',
    'supportedModes',
    'defaultMode',
    'applicationProfile',
    'conflictPolicy',
    'dependencies',
    'optionalDependencies',
    'files',
  ];
  for (const key of required) {
    if (!(key in manifest)) errors.push(`${modPath}: missing ${key}`);
  }
  if (manifest.schemaVersion !== 1) errors.push(`${modPath}: schemaVersion must be 1`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.id || '')) errors.push(`${modPath}: id must be kebab-case`);
  if (!Array.isArray(manifest.compatibleFormats) || manifest.compatibleFormats.length === 0) {
    errors.push(`${modPath}: compatibleFormats must be a non-empty array`);
  }
  if (!Array.isArray(manifest.domains) || manifest.domains.length === 0) errors.push(`${modPath}: domains must be a non-empty array`);
  if (!Array.isArray(manifest.supportedModes) || manifest.supportedModes.length === 0) {
    errors.push(`${modPath}: supportedModes must be a non-empty array`);
  } else {
    for (const mode of manifest.supportedModes) {
      if (!SUPPORTED_MOD_MODES.has(mode)) errors.push(`${modPath}: unsupported mode ${mode}`);
    }
    if (!manifest.supportedModes.includes(manifest.defaultMode)) errors.push(`${modPath}: defaultMode must be in supportedModes`);
  }
  if (!SUPPORTED_MOD_APPLICATION_PROFILES.has(manifest.applicationProfile)) errors.push(`${modPath}: invalid applicationProfile`);
  for (const key of ['dependencies', 'optionalDependencies']) {
    if (!Array.isArray(manifest[key])) errors.push(`${modPath}: ${key} must be an array`);
  }
  if (!Array.isArray(manifest.files)) {
    errors.push(`${modPath}: files must be an array`);
  } else {
    const seen = new Set();
    for (const file of manifest.files) {
      if (!isSafeRelativeFile(file)) {
        errors.push(`${modPath}: files entry must be a relative traversal-safe file path: ${file}`);
        continue;
      }
      const normalized = file.replace(/\\/g, '/');
      if (seen.has(normalized)) errors.push(`${modPath}: duplicate files entry ${normalized}`);
      seen.add(normalized);
      const resolved = path.resolve(modDir, normalized);
      if (!isInside(resolved, modDir)) errors.push(`${modPath}: files entry escapes mod directory: ${normalized}`);
      else if (!fs.existsSync(resolved)) errors.push(`${modPath}: listed payload missing: ${normalized}`);
    }
    const actualPayloads = listModPayloadFiles(modDir);
    for (const actual of actualPayloads) {
      if (!seen.has(actual)) errors.push(`${modPath}: payload file not listed in files: ${actual}`);
    }
    for (const listed of seen) {
      if (!actualPayloads.includes(listed)) errors.push(`${modPath}: files entry is not a payload file: ${listed}`);
    }
  }
  return { manifest, errors, warnings };
}

function detectDependencyCycle(modsById) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(id) {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      return stack.slice(start).concat(id);
    }
    if (visited.has(id)) return null;
    visiting.add(id);
    stack.push(id);
    const manifest = modsById.get(id)?.manifest;
    for (const dep of manifest?.dependencies || []) {
      if (!modsById.has(dep)) continue;
      const cycle = visit(dep);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  }

  for (const id of modsById.keys()) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

function validateModRegistry(repoRoot) {
  const modsRoot = path.join(repoRoot, '.world-puppeteer', 'mods');
  const errors = [];
  const warnings = [];
  const modsById = new Map();
  const dirsById = new Map();
  const manifestEntries = [];
  if (!fs.existsSync(modsRoot)) return { errors: [`${modsRoot}: missing mods root`], warnings, modsById, modsRoot };

  for (const entry of fs.readdirSync(modsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const modDir = path.join(modsRoot, entry.name);
    const result = validateModManifest(modDir);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (!fs.existsSync(path.join(modDir, 'README.md'))) errors.push(`${entry.name}: missing README.md`);
    if (!result.manifest) continue;
    manifestEntries.push({ dirName: entry.name, modDir, manifest: result.manifest });
    if (modsById.has(result.manifest.id)) {
      errors.push(`${modDir}: duplicate mod id ${result.manifest.id}`);
    } else {
      modsById.set(result.manifest.id, { ...result, modDir, dirName: entry.name });
      dirsById.set(result.manifest.id, entry.name);
    }
  }

  const indexPath = path.join(modsRoot, 'index.json');
  if (!fs.existsSync(indexPath)) {
    errors.push(`${indexPath}: missing mod registry`);
  } else {
    const index = readJson(indexPath);
    if (index.schemaVersion !== 1) errors.push(`${indexPath}: schemaVersion must be 1`);
    if (!Array.isArray(index.mods)) {
      errors.push(`${indexPath}: mods must be an array`);
    } else {
      const seen = new Set();
      for (const id of index.mods) {
        if (seen.has(id)) errors.push(`${indexPath}: duplicate registry entry ${id}`);
        seen.add(id);
        if (!modsById.has(id)) errors.push(`${indexPath}: unknown mod id ${id}`);
      }
      for (const id of modsById.keys()) {
        if (!seen.has(id)) errors.push(`${indexPath}: mod directory not represented in registry: ${dirsById.get(id)}`);
      }
    }
  }

  for (const [id, entry] of modsById) {
    for (const dep of entry.manifest.dependencies || []) {
      if (!modsById.has(dep)) errors.push(`${id}: required dependency not found: ${dep}`);
    }
    for (const dep of entry.manifest.optionalDependencies || []) {
      if (!modsById.has(dep)) warnings.push(`${id}: optional dependency not found: ${dep}`);
    }
  }

  const cycle = detectDependencyCycle(modsById);
  if (cycle) errors.push(`required dependency cycle: ${cycle.join(' -> ')}`);

  return { errors, warnings, modsById, modsRoot, manifestEntries };
}

function normalizeSpawnResult(result) {
  return {
    status: result.status ?? (result.error ? 1 : 0),
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error || null,
  };
}

function defaultRunner(command, args, options = {}) {
  return normalizeSpawnResult(spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    timeout: options.timeout || TIMEOUT_MS,
  }));
}

function runNodeScript(repoRoot, scriptRelativePath, args = [], options = {}) {
  return (options.runner || defaultRunner)(
    process.execPath,
    [path.resolve(repoRoot, scriptRelativePath), ...args],
    { cwd: repoRoot, timeout: options.timeout || TIMEOUT_MS }
  );
}

function buildWorldSource(world, options = {}) {
  if (!fs.existsSync(world.tabsPath)) throw new Error(`Tabs directory not found: ${world.tabsPath}`);

  if (fs.existsSync(world.compiledOutputPath) && !options.noBackup) {
    const backupDir = path.join(world.worldRoot, 'config-backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const parsed = path.parse(world.compiledOutputPath);
    fs.copyFileSync(world.compiledOutputPath, path.join(backupDir, `${parsed.name}-${stamp}${parsed.ext}`));
  }

  const result = {};
  for (const file of fs.readdirSync(world.tabsPath).sort()) {
    if (!file.endsWith('.json')) continue;
    const data = JSON.parse(fs.readFileSync(path.join(world.tabsPath, file), 'utf8'));
    const worldBackground = data.worldBackground;
    delete data.worldBackground;
    Object.assign(result, data);
    if (worldBackground !== undefined) {
      result.storySettings = result.storySettings || {};
      result.storySettings.worldBackground = worldBackground;
    }
  }

  fs.writeFileSync(world.compiledOutputPath, JSON.stringify(result, null, 2) + '\n');
  return { topLevelKeys: Object.keys(result).length };
}

function runFormatProfile(profileId, world, options = {}) {
  const profile = FORMAT_PROFILES[profileId];
  if (!profile) throw new Error(`unknown formatProfile: ${profileId}`);
  return runNodeScript(world.repoRoot, profile.script, profile.args({ world }), options);
}

function runBuildProfile(profileId, world, options = {}) {
  const profile = BUILD_PROFILES[profileId];
  if (!profile) throw new Error(`unknown buildProfile: ${profileId}`);
  if (profile.kind !== 'internal-build') throw new Error(`unsupported build profile kind: ${profile.kind}`);
  try {
    const output = buildWorldSource(world, options);
    return { status: 0, stdout: '', stderr: '', error: null, output };
  } catch (error) {
    return { status: 1, stdout: '', stderr: error.message, error };
  }
}

function parseValidationOutput(profile, run) {
  if (run.error || run.status !== 0) {
    return {
      ok: false,
      errors: [{ path: 'validator', message: run.stderr || run.stdout || run.error?.message || 'validator failed' }],
      warnings: [],
      raw: run,
    };
  }
  if (profile.output !== 'json') return { ok: true, errors: [], warnings: [], raw: run };
  try {
    const parsed = JSON.parse(run.stdout || '{}');
    const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
    const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
    return { ok: errors.length === 0, errors, warnings, raw: run, parsed };
  } catch {
    return {
      ok: false,
      errors: [{ path: 'validator', message: `validator did not return JSON: ${run.stdout}${run.stderr ? `\n${run.stderr}` : ''}` }],
      warnings: [],
      raw: run,
    };
  }
}

function runValidationProfile(profileId, world, options = {}) {
  const profile = VALIDATION_PROFILES[profileId];
  if (!profile) throw new Error(`unknown validationProfile: ${profileId}`);
  const run = runNodeScript(world.repoRoot, profile.script, profile.args({ world }), options);
  return { profileId, ...parseValidationOutput(profile, run) };
}

function runConfiguredFormat(world, options = {}) {
  return runFormatProfile(world.marker.toolchain.formatProfile, world, options);
}

function runConfiguredBuild(world, options = {}) {
  return runBuildProfile(world.marker.toolchain.buildProfile, world, options);
}

function runConfiguredValidations(world, options = {}) {
  return world.marker.toolchain.validationProfiles.map((profileId) => runValidationProfile(profileId, world, options));
}

function readProfile(worldRoot, profileId) {
  const profilePath = path.join(worldRoot, '.world-puppeteer', 'profiles', `${profileId}.json`);
  if (!fs.existsSync(profilePath)) return null;
  return { profilePath, profile: readJson(profilePath) };
}

function validateProfileShape(profile, worldRoot) {
  const errors = [];
  if (profile.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(profile.id || '')) errors.push('id must be kebab-case');
  for (const key of ['name', 'description']) {
    if (!profile[key]) errors.push(`${key} is required`);
  }
  if (!Array.isArray(profile.skills)) errors.push('skills must be an array');
  if (!Array.isArray(profile.appliesTo)) errors.push('appliesTo must be an array');
  if (typeof profile.required !== 'boolean') errors.push('required must be boolean');

  for (const skillId of profile.skills || []) {
    const skillPath = path.join(worldRoot, '.agents', 'skills', skillId, 'SKILL.md');
    if (!fs.existsSync(skillPath)) errors.push(`profile skill not found: ${skillId}`);
  }
  return { errors, warnings: [] };
}

function resolveWorld(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const repoRoot = findRepoRoot(options.repoRoot || cwd);
  const explicit = options.worldRoot
    ? path.resolve(options.cwd || process.cwd(), options.worldRoot)
    : null;
  let selected = null;

  if (explicit) {
    const markerPath = path.join(explicit, MARKER_FILE);
    if (!fs.existsSync(markerPath)) throw new Error(`No world marker at ${markerPath}`);
    selected = { root: explicit, markerPath, marker: readJson(markerPath) };
  }
  if (!selected) {
    const nearest = options.preferNearest !== false ? findNearestMarker(cwd) : null;
    if (
      nearest &&
      path.resolve(nearest.root) !== path.resolve(repoRoot) &&
      isInside(cwd, nearest.root) &&
      isInside(nearest.root, repoRoot)
    ) {
      selected = nearest;
    }
  }
  if (!selected) {
    const markers = findMarkers(repoRoot);
    const editable = markers.filter((entry) => entry.marker.role === 'editable');
    if (editable.length === 1) selected = editable[0];
    else {
      const available = markers
        .map((entry) => `${path.relative(repoRoot, entry.root) || '.'} (${entry.marker.role})`)
        .join('\n');
      throw new Error(`Unable to resolve target world. Available worlds:\n${available || '(none)'}`);
    }
  }

  const markerResult = validateMarkerShape(selected.marker, selected.root);
  if (markerResult.errors.length > 0) {
    throw new Error(`Invalid world marker ${selected.markerPath}:\n${markerResult.errors.join('\n')}`);
  }

  const activeProfiles = [];
  for (const profileId of selected.marker.activeProfiles || []) {
    const loaded = readProfile(selected.root, profileId);
    if (!loaded) throw new Error(`Required profile not found: ${profileId}`);
    const profileResult = validateProfileShape(loaded.profile, selected.root);
    if (profileResult.errors.length > 0) {
      throw new Error(`Invalid profile ${loaded.profilePath}:\n${profileResult.errors.join('\n')}`);
    }
    activeProfiles.push(loaded);
  }

  return {
    repoRoot,
    worldRoot: selected.root,
    markerPath: selected.markerPath,
    marker: selected.marker,
    activeProfiles,
    tabsPath: path.resolve(selected.root, selected.marker.paths.tabs),
    compiledOutputPath: path.resolve(selected.root, selected.marker.paths.compiledOutput),
    instructionsPath: path.resolve(selected.root, selected.marker.paths.instructions),
  };
}

module.exports = {
  BUILD_PROFILES,
  FORMAT_PROFILES,
  VALIDATION_PROFILES,
  MARKER_FILE,
  buildWorldSource,
  detectDependencyCycle,
  findRepoRoot,
  findMarkers,
  findNearestMarker,
  isInside,
  isSafeRelativeFile,
  isSafeRelativePath,
  knownToolchain,
  listFilesRecursive,
  listModPayloadFiles,
  readJson,
  readProfile,
  resolveWorld,
  runBuildProfile,
  runConfiguredBuild,
  runConfiguredFormat,
  runConfiguredValidations,
  runFormatProfile,
  runValidationProfile,
  validateModManifest,
  validateModRegistry,
  validateMarkerShape,
  validateProfileShape,
};
