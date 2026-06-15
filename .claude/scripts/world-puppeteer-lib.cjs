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

const MARKER_MOD_MODES = new Set(['reference', 'apply']);

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
    if (record.mode && !MARKER_MOD_MODES.has(record.mode)) errors.push(`appliedMods[${index}].mode is invalid`);
    if ('sourceFiles' in record && !Array.isArray(record.sourceFiles)) errors.push(`appliedMods[${index}].sourceFiles must be an array`);
    if ('operations' in record && !Array.isArray(record.operations)) errors.push(`appliedMods[${index}].operations must be an array`);
  }

  return { errors, warnings };
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
    ? options.worldRoot === options.cwd
      ? cwd
      : path.resolve(process.cwd(), options.worldRoot)
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
  findRepoRoot,
  findMarkers,
  findNearestMarker,
  isInside,
  isSafeRelativePath,
  knownToolchain,
  readJson,
  readProfile,
  resolveWorld,
  runBuildProfile,
  runConfiguredBuild,
  runConfiguredFormat,
  runConfiguredValidations,
  runFormatProfile,
  runValidationProfile,
  validateMarkerShape,
  validateProfileShape,
};
