const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  readJsonResult,
  validateAgainstSchemaFile,
} = require('./schema-utils.cjs');

const MARKER_FILE = '.world-puppeteer.json';
const KNOWN_FORMATS = new Set(['voyage-v33', 'voyage-v34', 'voyage-v35']);
const TIMEOUT_MS = 120000;
const BUILD_TEMP_PREFIX = '.world-puppeteer-build-';
const BUILD_LOCK_STALE_MS = 10 * 60 * 1000;
const BACKUP_DIR_NAME = 'config-backups';
const BACKUP_RETENTION_LIMIT = 20;

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

function pathKey(filePath) {
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isAbsolutePathSyntax(value) {
  return (
    path.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    path.posix.isAbsolute(value)
  );
}

function isSafeRelativePath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !isAbsolutePathSyntax(value) &&
    !value.split(/[\\/]+/).includes('..')
  );
}

function assertSafeRelativePath(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label}: path must be a non-empty string`);
  }
  if (isAbsolutePathSyntax(value)) {
    throw new Error(`${label}: absolute paths are not allowed: ${value}`);
  }
  if (value.split(/[\\/]+/).includes('..')) {
    throw new Error(`${label}: traversal is not allowed: ${value}`);
  }
}

function nearestExistingAncestor(targetPath) {
  let current = path.resolve(targetPath);
  while (!pathEntryExists(current)) {
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return current;
}

function pathEntryExists(targetPath) {
  try {
    fs.lstatSync(targetPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function assertNoSymlinkComponents(rootPath, targetPath, label, options = {}) {
  const root = path.resolve(rootPath);
  const target = path.resolve(targetPath);
  if (!isInside(target, root)) throw new Error(`${label}: path escapes world root: ${target}`);

  const relative = path.relative(root, target);
  if (!relative) return;

  const parts = relative.split(path.sep).filter(Boolean);
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    if (!pathEntryExists(current)) break;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw new Error(`${label}: symlinked path component is not allowed: ${current}`);
    }
    const isFinal = index === parts.length - 1;
    if (!isFinal && !stat.isDirectory()) {
      throw new Error(`${label}: path component is not a directory: ${current}`);
    }
    if (isFinal && options.requireDirectoryComponent && !stat.isDirectory()) {
      throw new Error(`${label}: path component is not a directory: ${current}`);
    }
  }
}

function assertExpectedType(absolutePath, expectedType, label) {
  const stat = fs.lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    throw new Error(`${label}: symlinks are not allowed: ${absolutePath}`);
  }
  if (expectedType === 'directory' && !stat.isDirectory()) {
    throw new Error(`${label}: expected directory: ${absolutePath}`);
  }
  if (expectedType === 'file' && !stat.isFile()) {
    throw new Error(`${label}: expected file: ${absolutePath}`);
  }
}

function assertRealpathContained(rootPath, targetPath, label) {
  const realRoot = fs.realpathSync(path.resolve(rootPath));
  const realTarget = fs.realpathSync(path.resolve(targetPath));
  if (!isInside(realTarget, realRoot)) {
    throw new Error(`${label}: realpath escapes world root: ${targetPath}`);
  }
}

function resolveContainedPath(options) {
  const {
    rootPath,
    relativePath,
    field,
    kind = 'input',
    expectedType = null,
  } = options;
  const label = field || 'path';
  const root = path.resolve(rootPath);

  assertSafeRelativePath(relativePath, label);
  if (!fs.existsSync(root)) throw new Error(`${label}: world root does not exist: ${root}`);
  assertExpectedType(root, 'directory', `${label} world root`);

  const target = path.resolve(root, relativePath);
  if (!isInside(target, root)) {
    throw new Error(`${label}: path escapes world root: ${relativePath}`);
  }

  if (kind === 'input') {
    if (!fs.existsSync(target)) throw new Error(`${label}: required path does not exist: ${relativePath}`);
    assertNoSymlinkComponents(root, target, label);
    if (expectedType) assertExpectedType(target, expectedType, label);
    assertRealpathContained(root, target, label);
    return target;
  }

  const targetExists = pathEntryExists(target);
  const ancestor = targetExists
    ? path.dirname(target)
    : nearestExistingAncestor(target);
  if (!ancestor) throw new Error(`${label}: no existing ancestor for output: ${relativePath}`);
  assertNoSymlinkComponents(root, ancestor, label, { requireDirectoryComponent: true });
  assertRealpathContained(root, ancestor, `${label} nearest existing ancestor`);

  if (targetExists) {
    assertNoSymlinkComponents(root, target, label);
    if (expectedType) assertExpectedType(target, expectedType, label);
    assertRealpathContained(root, target, label);
  }

  return target;
}

function validateContainedPath(options) {
  try {
    return { path: resolveContainedPath(options), errors: [] };
  } catch (error) {
    return { path: null, errors: [error.message] };
  }
}

function normalizeTransactionalWrite(write, index) {
  if (!write || typeof write.path !== 'string' || write.path.length === 0) {
    throw new Error(`transaction write ${index} is missing a file path`);
  }

  if (!Buffer.isBuffer(write.content) && typeof write.content !== 'string') {
    throw new Error(
      `transaction write ${index} for ${write.path} must provide string or Buffer content`
    );
  }

  return {
    path: path.resolve(write.path),
    content: Buffer.isBuffer(write.content)
      ? Buffer.from(write.content)
      : Buffer.from(write.content, 'utf8'),
  };
}

function snapshotTransactionalFile(fsImpl, filePath) {
  const resolvedPath = path.resolve(filePath);
  const existed = fsImpl.existsSync(resolvedPath);
  if (!existed) {
    return { path: resolvedPath, existed: false, content: null };
  }

  const stat = fsImpl.lstatSync(resolvedPath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`transaction target must be a regular file: ${resolvedPath}`);
  }

  return {
    path: resolvedPath,
    existed: true,
    content: fsImpl.readFileSync(resolvedPath),
  };
}

function restoreTransactionalFile(fsImpl, snapshot) {
  if (snapshot.existed) {
    fsImpl.writeFileSync(snapshot.path, snapshot.content);
    return;
  }

  if (fsImpl.existsSync(snapshot.path)) {
    fsImpl.rmSync(snapshot.path, { force: true });
  }
}

function removeTransactionalTempPath(fsImpl, tempPath) {
  const resolvedPath = path.resolve(tempPath);
  if (!fsImpl.existsSync(resolvedPath)) return;

  const stat = fsImpl.lstatSync(resolvedPath);
  if (stat.isDirectory()) {
    fsImpl.rmSync(resolvedPath, { recursive: true, force: true });
  } else {
    fsImpl.rmSync(resolvedPath, { force: true });
  }
}

function runTransactionalFileMutation(plannedWrites, afterWrite = () => undefined, options = {}) {
  const fsImpl = options.fs || fs;
  const normalizedWrites = plannedWrites.map(normalizeTransactionalWrite);
  const uniqueWrites = [];
  const seen = new Set();

  for (const write of normalizedWrites) {
    const key = pathKey(write.path);
    if (seen.has(key)) {
      throw new Error(`duplicate transaction target: ${write.path}`);
    }
    seen.add(key);
    uniqueWrites.push(write);
  }

  const snapshots = uniqueWrites.map((write) =>
    snapshotTransactionalFile(fsImpl, write.path)
  );
  const writesToApply = uniqueWrites.filter((write, index) => {
    const original = snapshots[index].content;
    return !original || !original.equals(write.content);
  });
  const cleanupPaths = [];
  const context = {
    recordCleanupPath(tempPath) {
      cleanupPaths.push(path.resolve(tempPath));
    },
  };

  try {
    for (const write of writesToApply) {
      fsImpl.mkdirSync(path.dirname(write.path), { recursive: true });
      fsImpl.writeFileSync(write.path, write.content);
    }
    return afterWrite(context);
  } catch (primaryError) {
    const rollbackErrors = [];

    for (let index = snapshots.length - 1; index >= 0; index -= 1) {
      try {
        restoreTransactionalFile(fsImpl, snapshots[index]);
      } catch (restoreError) {
        rollbackErrors.push(
          `failed to restore ${snapshots[index].path}: ${restoreError.message}`
        );
      }
    }

    for (const tempPath of cleanupPaths) {
      try {
        removeTransactionalTempPath(fsImpl, tempPath);
      } catch (cleanupError) {
        rollbackErrors.push(
          `failed to remove temporary path ${tempPath}: ${cleanupError.message}`
        );
      }
    }

    if (rollbackErrors.length > 0) {
      throw new Error(
        `${primaryError.message}\nRollback failed:\n${rollbackErrors.join('\n')}`
      );
    }

    throw primaryError;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonFileOrThrow(filePath, kind) {
  const loaded = readJsonResult(filePath);
  if (loaded.error) {
    throw new Error(`Invalid ${kind} ${filePath}:\n${loaded.error}`);
  }
  return loaded.value;
}

function validateControlMetadataSchema(value, schemaPath, filePath) {
  // These schemas validate World-Puppeteer control metadata only.
  // Voyage world tabs and compiled content are validated separately.
  return validateAgainstSchemaFile(value, schemaPath)
    .map((message) => `${filePath}: ${message}`);
}

function listTabJsonFiles(dir) {
  const tabsPath = path.resolve(dir);
  if (!fs.existsSync(tabsPath)) {
    throw new Error(`Tabs directory not found: ${tabsPath}`);
  }
  assertExpectedType(tabsPath, 'directory', 'tabs directory');

  const jsonFiles = [];
  for (const entry of fs.readdirSync(tabsPath, { withFileTypes: true })) {
    const entryPath = path.join(tabsPath, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Tabs directory contains symlinked entry: ${entryPath}`);
    }
    if (entry.isDirectory()) {
      throw new Error(`Tabs directory must be flat; nested directory found: ${entryPath}`);
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      jsonFiles.push(entry.name);
    }
  }
  return jsonFiles.sort((a, b) => a.localeCompare(b));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function describeJsonRootKind(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
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

  for (const file of listTabJsonFiles(tabsPath)) {
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

  if (!isPlainObject(marker)) {
    errors.push(
      `marker root must be a plain object; received ${describeJsonRootKind(marker)}`
    );
    return { errors, warnings };
  }

  if (marker.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(marker.id || '')) errors.push('id must be kebab-case');
  if (!marker.name) errors.push('name is required');
  if (!roles.has(marker.role)) errors.push(`role must be one of ${Array.from(roles).join(', ')}`);
  if (!marker.format) errors.push('format is required');
  if (marker.format && !KNOWN_FORMATS.has(marker.format)) warnings.push(`unknown format: ${marker.format}`);

  const paths = isPlainObject(marker.paths) ? marker.paths : {};
  if (!isPlainObject(marker.paths)) errors.push('paths must be a plain object');
  for (const key of ['tabs', 'compiledOutput', 'instructions']) {
    if (!isSafeRelativePath(paths[key])) errors.push(`paths.${key} must be a relative path without traversal`);
  }
  if (
    typeof paths.compiledOutput === 'string' &&
    !paths.compiledOutput.endsWith('.json')
  ) {
    errors.push('paths.compiledOutput must end in .json');
  }
  if (
    typeof paths.compiledOutput === 'string' &&
    typeof paths.tabs === 'string'
  ) {
    const tabsPath = path.resolve(worldRoot, paths.tabs);
    const outputPath = path.resolve(worldRoot, paths.compiledOutput);
    if (isInside(outputPath, tabsPath)) errors.push('paths.compiledOutput must not be inside tabs');
  }

  const toolchain = isPlainObject(marker.toolchain) ? marker.toolchain : {};
  if (!isPlainObject(marker.toolchain)) errors.push('toolchain must be a plain object');
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

function resolveMarkerPaths(marker, worldRoot) {
  return {
    tabsPath: resolveContainedPath({
      rootPath: worldRoot,
      relativePath: marker.paths.tabs,
      field: 'paths.tabs',
      kind: 'input',
      expectedType: 'directory',
    }),
    compiledOutputPath: resolveContainedPath({
      rootPath: worldRoot,
      relativePath: marker.paths.compiledOutput,
      field: 'paths.compiledOutput',
      kind: 'output',
      expectedType: 'file',
    }),
    instructionsPath: resolveContainedPath({
      rootPath: worldRoot,
      relativePath: marker.paths.instructions,
      field: 'paths.instructions',
      kind: 'input',
      expectedType: 'file',
    }),
  };
}

function validateMarkerPaths(marker, worldRoot) {
  const errors = [];
  const paths = {};

  for (const [field, kind, expectedType, outputKey] of [
    ['tabs', 'input', 'directory', 'tabsPath'],
    ['compiledOutput', 'output', 'file', 'compiledOutputPath'],
    ['instructions', 'input', 'file', 'instructionsPath'],
  ]) {
    const result = validateContainedPath({
      rootPath: worldRoot,
      relativePath: marker.paths?.[field],
      field: `paths.${field}`,
      kind,
      expectedType,
    });
    if (result.errors.length > 0) errors.push(...result.errors);
    else paths[outputKey] = result.path;
  }

  return { errors, paths };
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildBackupStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function buildBackupFileName(destinationPath, stamp, unique) {
  const parsed = path.parse(destinationPath);
  return `${parsed.name}-${stamp}-${unique}${parsed.ext}`;
}

function parseBackupStamp(stamp) {
  const match = /^(?<date>\d{4}-\d{2}-\d{2})T(?<hour>\d{2})-(?<minute>\d{2})-(?<second>\d{2})-(?<millis>\d{3})Z$/
    .exec(stamp);
  if (!match) return null;

  const isoValue = `${match.groups.date}T${match.groups.hour}:${match.groups.minute}:${match.groups.second}.${match.groups.millis}Z`;
  const timestampMs = Date.parse(isoValue);
  return Number.isNaN(timestampMs) ? null : timestampMs;
}

function recognizedBackupEntries(backupDir, destinationPath) {
  if (!fs.existsSync(backupDir)) return [];

  const parsed = path.parse(destinationPath);
  const pattern = new RegExp(
    `^${escapeRegExp(parsed.name)}-(?<stamp>\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z)-(?<unique>\\d+-[0-9a-f]+)${escapeRegExp(parsed.ext)}$`
  );
  const recognized = [];

  for (const entry of fs.readdirSync(backupDir)) {
    const entryPath = path.join(backupDir, entry);
    const match = pattern.exec(entry);
    if (!match) continue;

    const stat = fs.lstatSync(entryPath);
    if (stat.isSymbolicLink() || !stat.isFile()) continue;

    const timestampMs = parseBackupStamp(match.groups.stamp);
    if (timestampMs === null) continue;

    recognized.push({
      path: entryPath,
      name: entry,
      timestampMs,
    });
  }

  return recognized;
}

function compareRecognizedBackupsNewestFirst(left, right) {
  if (left.timestampMs !== right.timestampMs) {
    return right.timestampMs - left.timestampMs;
  }
  return right.name.localeCompare(left.name);
}

function pruneRecognizedBackups(backupDir, destinationPath, newBackupPath) {
  const recognized = recognizedBackupEntries(backupDir, destinationPath)
    .sort(compareRecognizedBackupsNewestFirst);
  if (recognized.length <= BACKUP_RETENTION_LIMIT) return [];

  const newBackupKey = pathKey(newBackupPath);
  let retained = recognized.slice(0, BACKUP_RETENTION_LIMIT);
  if (!retained.some((entry) => pathKey(entry.path) === newBackupKey)) {
    const newEntry = recognized.find((entry) => pathKey(entry.path) === newBackupKey);
    if (newEntry) {
      retained = [...retained.slice(0, BACKUP_RETENTION_LIMIT - 1), newEntry];
    }
  }

  const retainedKeys = new Set(retained.map((entry) => pathKey(entry.path)));
  const pruned = [];

  for (const entry of recognized) {
    if (retainedKeys.has(pathKey(entry.path))) continue;

    const stat = fs.lstatSync(entry.path);
    if (stat.isSymbolicLink() || !stat.isFile()) continue;

    fs.rmSync(entry.path, { force: true });
    pruned.push(entry.path);
  }

  return pruned;
}

function createBuildBackup(worldRoot, destinationPath) {
  if (!fs.existsSync(destinationPath)) return null;

  const validatedOutputPath = resolveContainedPath({
    rootPath: worldRoot,
    relativePath: path.relative(worldRoot, destinationPath),
    field: 'paths.compiledOutput',
    kind: 'output',
    expectedType: 'file',
  });
  const backupDir = path.join(path.dirname(validatedOutputPath), BACKUP_DIR_NAME);
  const backupDirRelative = path.relative(worldRoot, backupDir);

  const preparedBackupDir = resolveContainedPath({
    rootPath: worldRoot,
    relativePath: backupDirRelative,
    field: BACKUP_DIR_NAME,
    kind: 'output',
    expectedType: 'directory',
  });
  fs.mkdirSync(preparedBackupDir, { recursive: true });
  const validatedBackupDir = resolveContainedPath({
    rootPath: worldRoot,
    relativePath: backupDirRelative,
    field: BACKUP_DIR_NAME,
    kind: 'input',
    expectedType: 'directory',
  });

  const stamp = buildBackupStamp();
  const unique = `${process.pid}-${Math.random().toString(16).slice(2)}`;
  const backupPath = path.join(
    validatedBackupDir,
    buildBackupFileName(validatedOutputPath, stamp, unique)
  );
  resolveContainedPath({
    rootPath: worldRoot,
    relativePath: path.relative(worldRoot, backupPath),
    field: `${BACKUP_DIR_NAME} destination`,
    kind: 'output',
    expectedType: 'file',
  });

  fs.copyFileSync(validatedOutputPath, backupPath);
  try {
    pruneRecognizedBackups(validatedBackupDir, validatedOutputPath, backupPath);
  } catch (error) {
    throw new Error(
      `Failed to prune old build backups in ${validatedBackupDir}: ${error.message}`
    );
  }
  return backupPath;
}

function validateCompiledCandidate(world, candidatePath, options = {}) {
  const validationRuns = [];
  for (const profileId of world.marker.toolchain.validationProfiles) {
    const profile = VALIDATION_PROFILES[profileId];
    if (!profile) throw new Error(`unknown validationProfile: ${profileId}`);
    const run = runNodeScript(world.repoRoot, profile.script, [candidatePath, '--json'], options);
    const parsed = parseValidationOutput(profile, run);
    validationRuns.push({ profileId, ...parsed });
    if (!parsed.ok) {
      const detail = parsed.errors.map((error) => `${error.path || 'unknown'}: ${error.message || error}`).join('\n');
      throw new Error(`Compiled candidate failed ${profileId} validation:\n${detail || run.stderr || run.stdout}`);
    }
  }
  return validationRuns;
}

function buildWorldSource(world, options = {}) {
  resolveContainedPath({
    rootPath: world.worldRoot,
    relativePath: path.relative(world.worldRoot, world.compiledOutputPath),
    field: 'paths.compiledOutput',
    kind: 'output',
    expectedType: 'file',
  });
  fs.mkdirSync(path.dirname(world.compiledOutputPath), { recursive: true });
  const lock = acquireBuildLock(world.compiledOutputPath, options);
  let tempPath = null;
  let backupPath = null;
  let validationRuns = [];

  try {
    const merged = loadAndMergeTabs(world.tabsPath);
    tempPath =
      options.tempPath ||
      uniqueBuildTempPath(world.compiledOutputPath);

    fs.writeFileSync(
      tempPath,
      JSON.stringify(merged.config, null, 2) + '\n'
    );
    validationRuns = validateCompiledCandidate(world, tempPath, options);

    const backupFactory =
      options.createBuildBackup || createBuildBackup;
    const replaceFile =
      options.atomicReplaceFile || atomicReplaceFile;

    if (!options.noBackup) {
      backupPath = backupFactory(world.worldRoot, world.compiledOutputPath);
    }
    replaceFile(tempPath, world.compiledOutputPath);

    return {
      topLevelKeys: Object.keys(merged.config).length,
      sourceFiles: merged.files,
      validationRuns,
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

function discoverProfileDirectory(worldRoot) {
  const errors = [];
  const files = [];
  const profileRoot = path.join(worldRoot, '.world-puppeteer', 'profiles');

  let profileStat;
  try {
    profileStat = fs.lstatSync(profileRoot);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { directoryPath: profileRoot, files, errors };
    }
    errors.push(`${profileRoot}: unable to inspect profile directory: ${error.message}`);
    return { directoryPath: profileRoot, files, errors };
  }

  if (profileStat.isSymbolicLink()) {
    errors.push(`${profileRoot}: symlinked profile directories are not allowed`);
    return { directoryPath: profileRoot, files, errors };
  }

  const directoryResult = validateContainedPath({
    rootPath: worldRoot,
    relativePath: path.relative(worldRoot, profileRoot),
    field: '.world-puppeteer/profiles',
    kind: 'input',
    expectedType: 'directory',
  });
  if (directoryResult.errors.length > 0) {
    errors.push(...directoryResult.errors.map((message) => `${profileRoot}: ${message}`));
    return { directoryPath: profileRoot, files, errors };
  }

  const entries = fs.readdirSync(profileRoot, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const entryPath = path.join(profileRoot, entry.name);
    if (entry.isSymbolicLink()) {
      errors.push(`${entryPath}: symlinked profile entries are not allowed`);
      continue;
    }
    if (entry.isDirectory()) {
      errors.push(`${entryPath}: nested directories are not allowed in .world-puppeteer/profiles`);
      continue;
    }
    if (!entry.isFile()) {
      errors.push(`${entryPath}: unsupported profile entry type`);
      continue;
    }
    if (!entry.name.endsWith('.json')) {
      errors.push(`${entryPath}: unexpected profile entry; only .json files are allowed`);
      continue;
    }

    const fileResult = validateContainedPath({
      rootPath: worldRoot,
      relativePath: path.relative(worldRoot, entryPath),
      field: `.world-puppeteer/profiles/${entry.name}`,
      kind: 'input',
      expectedType: 'file',
    });
    if (fileResult.errors.length > 0) {
      errors.push(...fileResult.errors.map((message) => `${entryPath}: ${message}`));
      continue;
    }

    files.push(fileResult.path);
  }

  return { directoryPath: profileRoot, files, errors };
}

function validateProfileShape(profile, worldRoot) {
  const errors = [];
  if (!isPlainObject(profile)) {
    errors.push(
      `profile root must be a plain object; received ${describeJsonRootKind(profile)}`
    );
    return { errors, warnings: [] };
  }
  if (profile.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(profile.id || '')) errors.push('id must be kebab-case');
  for (const key of ['name', 'description']) {
    if (!profile[key]) errors.push(`${key} is required`);
  }
  if (!Array.isArray(profile.skills)) errors.push('skills must be an array');
  if (!Array.isArray(profile.appliesTo)) errors.push('appliesTo must be an array');
  if (typeof profile.required !== 'boolean') errors.push('required must be boolean');

  if (Array.isArray(profile.skills)) {
    for (const skillId of profile.skills) {
      if (typeof skillId !== 'string' || skillId.length === 0) {
        errors.push('skills entries must be non-empty strings');
        continue;
      }
      const skillPath = path.join(worldRoot, '.agents', 'skills', skillId, 'SKILL.md');
      if (!fs.existsSync(skillPath)) errors.push(`profile skill not found: ${skillId}`);
    }
  }
  return { errors, warnings: [] };
}

function resolveWorld(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const repoRoot = findRepoRoot(options.repoRoot || cwd);
  const schemaRoot = findRepoRoot(__dirname);
  const markerSchemaPath = path.join(
    schemaRoot,
    '.world-puppeteer',
    'schemas',
    'world-marker.schema.json'
  );
  const profileSchemaPath = path.join(
    schemaRoot,
    '.world-puppeteer',
    'schemas',
    'profile.schema.json'
  );
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
    const editable = markers.filter(
      (entry) => isPlainObject(entry.marker) && entry.marker.role === 'editable'
    );
    if (editable.length === 1) selected = editable[0];
    else {
      const available = markers
        .map((entry) => {
          const role = isPlainObject(entry.marker) && typeof entry.marker.role === 'string'
            ? entry.marker.role
            : 'invalid-marker';
          return `${path.relative(repoRoot, entry.root) || '.'} (${role})`;
        })
        .join('\n');
      throw new Error(`Unable to resolve target world. Available worlds:\n${available || '(none)'}`);
    }
  }

  selected = {
    ...selected,
    marker: readJsonFileOrThrow(selected.markerPath, 'world marker'),
  };

  const markerSchemaErrors = validateControlMetadataSchema(
    selected.marker,
    markerSchemaPath,
    selected.markerPath
  );
  if (markerSchemaErrors.length > 0) {
    throw new Error(
      `Invalid world marker ${selected.markerPath}:\n${markerSchemaErrors.join('\n')}`
    );
  }

  const markerResult = validateMarkerShape(selected.marker, selected.root);
  if (markerResult.errors.length > 0) {
    throw new Error(`Invalid world marker ${selected.markerPath}:\n${markerResult.errors.join('\n')}`);
  }

  const activeProfiles = [];
  const profileDiscovery = discoverProfileDirectory(selected.root);
  if (profileDiscovery.errors.length > 0) {
    throw new Error(
      `Invalid profile directory ${profileDiscovery.directoryPath}:\n` +
      `${profileDiscovery.errors.join('\n')}`
    );
  }

  const allProfiles = [];
  for (const profilePath of profileDiscovery.files) {
    const profile = readJsonFileOrThrow(profilePath, 'profile');
    const expectedId = path.basename(profilePath, '.json');
    const profileSchemaErrors = validateControlMetadataSchema(
      profile,
      profileSchemaPath,
      profilePath
    );
    if (profileSchemaErrors.length > 0) {
      throw new Error(`Invalid profile ${profilePath}:\n${profileSchemaErrors.join('\n')}`);
    }
    if (profile.id !== expectedId) throw new Error(`Invalid profile ${profilePath}:\nprofile id must match filename`);
    const profileResult = validateProfileShape(profile, selected.root);
    if (profileResult.errors.length > 0) {
      throw new Error(`Invalid profile ${profilePath}:\n${profileResult.errors.join('\n')}`);
    }
    allProfiles.push({ profilePath, profile });
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

  const markerPaths = resolveMarkerPaths(selected.marker, selected.root);

  return {
    repoRoot,
    worldRoot: selected.root,
    markerPath: selected.markerPath,
    marker: selected.marker,
    activeProfiles,
    tabsPath: markerPaths.tabsPath,
    compiledOutputPath: markerPaths.compiledOutputPath,
    instructionsPath: markerPaths.instructionsPath,
  };
}

function tryResolveExplicitWorldRoot(worldRoot, options = {}) {
  try {
    return resolveWorld({
      worldRoot,
      cwd: options.cwd || worldRoot || process.cwd(),
      preferNearest: false,
      repoRoot: options.repoRoot,
    });
  } catch {
    return null;
  }
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
  isAbsolutePathSyntax,
  listTabJsonFiles,
  pathKey,
  runTransactionalFileMutation,
  resolveContainedPath,
  resolveMarkerPaths,
  isSafeRelativePath,
  validateContainedPath,
  validateMarkerPaths,
  knownToolchain,
  isPlainObject,
  readJson,
  readProfile,
  assertNoSymlinkComponents,
  discoverProfileDirectory,
  releaseBuildLock,
  resolveWorld,
  runBuildProfile,
  runConfiguredBuild,
  runConfiguredFormat,
  runConfiguredValidations,
  runFormatProfile,
  runValidationProfile,
  tryResolveExplicitWorldRoot,
  validateMarkerShape,
  validateProfileShape,
};
