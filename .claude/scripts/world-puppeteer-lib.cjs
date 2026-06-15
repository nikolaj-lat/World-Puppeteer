const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MARKER_FILE = '.world-puppeteer.json';
const KNOWN_FORMATS = new Set(['voyage-v33']);
const TIMEOUT_MS = 120000;
const BUILD_TEMP_PREFIX = '.world-puppeteer-build-';
const BUILD_LOCK_STALE_MS = 10 * 60 * 1000;

const FORMAT_PROFILES = {
  'voyage-json-tabs': {
    kind: 'node-script',
    script: '.claude/scripts/pretty-print.js',
    args: ({ world }) => [world.tabsPath],
  },
};

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

function listJsonFiles(dir) {
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function jsonValueKind(value) {
  if (Array.isArray(value)) return 'array';
  if (isPlainObject(value)) return 'object';
  return 'scalar';
}

function appendJsonPath(basePath, key) {
  const simpleKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
  if (!basePath) return simpleKey ? key : `[${JSON.stringify(key)}]`;
  return simpleKey ? `${basePath}.${key}` : `${basePath}[${JSON.stringify(key)}]`;
}

function addPathOwner(owners, pathName, sourceFile) {
  const current = owners.get(pathName) || new Set();
  current.add(sourceFile);
  owners.set(pathName, current);
}

function firstPathOwner(owners, pathName) {
  const current = owners.get(pathName);
  return current ? current.values().next().value : null;
}

function cloneJsonValue(value) {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child)])
    );
  }
  return value;
}

function cloneAndRecord(value, pathName, sourceFile, owners) {
  addPathOwner(owners, pathName, sourceFile);

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    const cloned = {};
    for (const [key, child] of entries) {
      const childPath = appendJsonPath(pathName, key);
      cloned[key] = cloneAndRecord(child, childPath, sourceFile, owners);
    }
    return cloned;
  }

  return cloneJsonValue(value);
}

function mergeTabValue(existing, incoming, pathName, sourceFile, owners) {
  const existingKind = jsonValueKind(existing);
  const incomingKind = jsonValueKind(incoming);
  const firstOwner = firstPathOwner(owners, pathName) || '<unknown source>';

  if (existingKind === 'object' && incomingKind === 'object') {
    const existingEntries = Object.entries(existing);
    const incomingEntries = Object.entries(incoming);

    if (existingEntries.length === 0 || incomingEntries.length === 0) {
      throw new Error(
        `Tab merge collision at "${pathName}" (object vs object): ${firstOwner} and ${sourceFile}`
      );
    }

    addPathOwner(owners, pathName, sourceFile);
    for (const [key, child] of incomingEntries) {
      const childPath = appendJsonPath(pathName, key);
      if (Object.prototype.hasOwnProperty.call(existing, key)) {
        existing[key] = mergeTabValue(existing[key], child, childPath, sourceFile, owners);
      } else {
        existing[key] = cloneAndRecord(child, childPath, sourceFile, owners);
      }
    }
    return existing;
  }

  throw new Error(
    `Tab merge collision at "${pathName}" (${existingKind} vs ${incomingKind}): ${firstOwner} and ${sourceFile}`
  );
}

function normalizeTabDocument(data, sourceFile) {
  if (!isPlainObject(data)) {
    throw new Error(`${sourceFile}: tab file must contain a JSON object`);
  }

  const normalized = { ...data };
  const worldBackground = normalized.worldBackground;
  delete normalized.worldBackground;

  if (worldBackground !== undefined) {
    if (
      normalized.storySettings !== undefined &&
      !isPlainObject(normalized.storySettings)
    ) {
      throw new Error(
        `${sourceFile}: worldBackground hoist requires storySettings to be an object`
      );
    }
    if (
      normalized.storySettings &&
      Object.prototype.hasOwnProperty.call(
        normalized.storySettings,
        'worldBackground'
      )
    ) {
      throw new Error(
        `${sourceFile}: worldBackground hoist conflicts with storySettings.worldBackground in the same file`
      );
    }
    normalized.storySettings = {
      ...(normalized.storySettings || {}),
      worldBackground,
    };
  }

  return normalized;
}

function loadAndMergeTabs(tabsPath) {
  if (!fs.existsSync(tabsPath)) {
    throw new Error(`Tabs directory not found: ${tabsPath}`);
  }

  const result = {};
  const owners = new Map();
  const files = [];

  for (const file of listJsonFiles(tabsPath)) {
    const filePath = path.join(tabsPath, file);
    let parsed;
    try {
      parsed = readJson(filePath);
    } catch (error) {
      throw new Error(`${filePath}: invalid JSON: ${error.message}`);
    }

    const normalized = normalizeTabDocument(parsed, filePath);
    files.push(filePath);

    for (const [key, value] of Object.entries(normalized)) {
      const keyPath = appendJsonPath('', key);
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        result[key] = mergeTabValue(
          result[key],
          value,
          keyPath,
          filePath,
          owners
        );
      } else {
        result[key] = cloneAndRecord(
          value,
          keyPath,
          filePath,
          owners
        );
      }
    }
  }

  return { config: result, owners, files };
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

function uniqueBuildTempPath(destinationPath) {
  const dir = path.dirname(destinationPath);
  const parsed = path.parse(destinationPath);
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return path.join(dir, `${BUILD_TEMP_PREFIX}${parsed.name}-${suffix}${parsed.ext}`);
}

function buildLockPath(destinationPath) {
  const parsed = path.parse(destinationPath);
  return path.join(
    parsed.dir,
    `.${parsed.base}.world-puppeteer.lock`
  );
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function readBuildLock(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

function acquireBuildLock(destinationPath, options = {}) {
  const lockPath = buildLockPath(destinationPath);
  const staleMs = options.lockStaleMs ?? BUILD_LOCK_STALE_MS;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = `${process.pid}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
    let fd = null;

    try {
      fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(
        fd,
        JSON.stringify({
          schemaVersion: 1,
          pid: process.pid,
          token,
          startedAt: new Date().toISOString(),
          destinationPath: path.resolve(destinationPath),
        }) + '\n'
      );
      return { fd, lockPath, token };
    } catch (error) {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {}
        try {
          fs.rmSync(lockPath, { force: true });
        } catch {}
      }

      if (error.code !== 'EEXIST') throw error;

      const stat = fs.lstatSync(lockPath);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new Error(
          `Unsafe build lock path: ${lockPath}`
        );
      }

      const metadata = readBuildLock(lockPath);
      const ageMs = Math.max(0, Date.now() - stat.mtimeMs);
      const hasPid = Number.isInteger(metadata?.pid) && metadata.pid > 0;
      const ownerAlive = hasPid && isProcessAlive(metadata.pid);
      const reclaimable = hasPid
        ? !ownerAlive
        : ageMs > staleMs;

      if (reclaimable && attempt === 0) {
        fs.rmSync(lockPath, { force: true });
        continue;
      }

      const owner = hasPid ? `pid ${metadata.pid}` : 'unknown owner';
      throw new Error(
        `Build already in progress for ${destinationPath} ` +
        `(${owner}; lock ${lockPath})`
      );
    }
  }

  throw new Error(`Could not acquire build lock for ${destinationPath}`);
}

function releaseBuildLock(lock) {
  if (!lock) return;

  if (lock.fd !== null && lock.fd !== undefined) {
    try {
      fs.closeSync(lock.fd);
    } catch {}
  }

  if (!fs.existsSync(lock.lockPath)) return;
  const metadata = readBuildLock(lock.lockPath);
  if (metadata?.token !== lock.token) return;
  fs.rmSync(lock.lockPath, { force: true });
}
function atomicReplaceFile(sourcePath, destinationPath) {
  fs.renameSync(sourcePath, destinationPath);
}

function createBuildBackup(destinationPath) {
  if (!fs.existsSync(destinationPath)) return null;
  const backupDir = path.join(path.dirname(destinationPath), 'config-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const unique = `${process.pid}-${Math.random().toString(16).slice(2)}`;
  const parsed = path.parse(destinationPath);
  const backupPath = path.join(backupDir, `${parsed.name}-${stamp}-${unique}${parsed.ext}`);
  fs.copyFileSync(destinationPath, backupPath);
  return backupPath;
}

function validateCompiledCandidate(world, candidatePath, options = {}) {
  for (const profileId of world.marker.toolchain.validationProfiles) {
    const profile = VALIDATION_PROFILES[profileId];
    if (!profile) throw new Error(`unknown validationProfile: ${profileId}`);
    const run = runNodeScript(world.repoRoot, profile.script, [candidatePath, '--json'], options);
    const parsed = parseValidationOutput(profile, run);
    if (!parsed.ok) {
      const detail = parsed.errors.map((error) => `${error.path || 'unknown'}: ${error.message || error}`).join('\n');
      throw new Error(`Compiled candidate failed ${profileId} validation:\n${detail || run.stderr || run.stdout}`);
    }
  }
}

function buildWorldSource(world, options = {}) {
  fs.mkdirSync(path.dirname(world.compiledOutputPath), { recursive: true });
  const lock = acquireBuildLock(world.compiledOutputPath, options);
  let tempPath = null;
  let backupPath = null;

  try {
    const merged = loadAndMergeTabs(world.tabsPath);
    tempPath =
      options.tempPath ||
      uniqueBuildTempPath(world.compiledOutputPath);

    fs.writeFileSync(
      tempPath,
      JSON.stringify(merged.config, null, 2) + '\n'
    );
    validateCompiledCandidate(world, tempPath, options);

    const backupFactory =
      options.createBuildBackup || createBuildBackup;
    const replaceFile =
      options.atomicReplaceFile || atomicReplaceFile;

    if (!options.noBackup) {
      backupPath = backupFactory(world.compiledOutputPath);
    }
    replaceFile(tempPath, world.compiledOutputPath);

    return {
      topLevelKeys: Object.keys(merged.config).length,
      sourceFiles: merged.files,
      tempPath,
      backupPath,
    };
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }
    releaseBuildLock(lock);
  }
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
  const profileRoot = path.join(selected.root, '.world-puppeteer', 'profiles');
  const allProfiles = [];
  if (fs.existsSync(profileRoot)) {
    for (const file of fs.readdirSync(profileRoot).filter((name) => name.endsWith('.json')).sort()) {
      const profilePath = path.join(profileRoot, file);
      const profile = readJson(profilePath);
      const expectedId = path.basename(file, '.json');
      if (profile.id !== expectedId) throw new Error(`Invalid profile ${profilePath}:\nprofile id must match filename`);
      const profileResult = validateProfileShape(profile, selected.root);
      if (profileResult.errors.length > 0) {
        throw new Error(`Invalid profile ${profilePath}:\n${profileResult.errors.join('\n')}`);
      }
      allProfiles.push({ profilePath, profile });
    }
  }
  const profilesById = new Map(allProfiles.map((entry) => [entry.profile.id, entry]));
  const activeIds = new Set(selected.marker.activeProfiles || []);
  for (const profileEntry of allProfiles) {
    if (profileEntry.profile.required && !activeIds.has(profileEntry.profile.id)) {
      throw new Error(`Required profile is not active in ${selected.markerPath}: ${profileEntry.profile.id}`);
    }
  }
  for (const profileId of selected.marker.activeProfiles || []) {
    if (!profilesById.has(profileId)) throw new Error(`Active profile not found locally: ${profileId}`);
    const loaded = readProfile(selected.root, profileId);
    if (!loaded) throw new Error(`Required profile not found: ${profileId}`);
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
  BUILD_LOCK_STALE_MS,
  BUILD_PROFILES,
  FORMAT_PROFILES,
  VALIDATION_PROFILES,
  MARKER_FILE,
  acquireBuildLock,
  buildLockPath,
  buildWorldSource,
  loadAndMergeTabs,
  findRepoRoot,
  findMarkers,
  findNearestMarker,
  isInside,
  isSafeRelativePath,
  knownToolchain,
  readJson,
  readProfile,
  releaseBuildLock,
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
