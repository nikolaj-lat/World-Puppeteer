const fs = require('fs');
const path = require('path');

const MARKER_FILE = '.world-puppeteer.json';
const KNOWN_FORMATS = new Set(['voyage-v33']);
const TOOLCHAIN = {
  formatProfiles: new Set(['voyage-json-tabs']),
  buildProfiles: new Set(['world-build-cjs']),
  validationProfiles: new Set(['voyage-local-validator']),
};

function findRepoRoot(startDir = process.cwd()) {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, '.world-puppeteer.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(startDir);
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
  if (!TOOLCHAIN.formatProfiles.has(toolchain.formatProfile)) {
    errors.push(`unknown formatProfile: ${toolchain.formatProfile}`);
  }
  if (!TOOLCHAIN.buildProfiles.has(toolchain.buildProfile)) {
    errors.push(`unknown buildProfile: ${toolchain.buildProfile}`);
  }
  if (!Array.isArray(toolchain.validationProfiles) || toolchain.validationProfiles.length === 0) {
    errors.push('toolchain.validationProfiles must be a non-empty array');
  } else {
    for (const profile of toolchain.validationProfiles) {
      if (!TOOLCHAIN.validationProfiles.has(profile)) errors.push(`unknown validationProfile: ${profile}`);
    }
  }
  if (!Array.isArray(marker.activeProfiles)) errors.push('activeProfiles must be an array');
  if (!Array.isArray(marker.appliedMods)) errors.push('appliedMods must be an array');

  return { errors, warnings };
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
  const repoRoot = findRepoRoot(options.repoRoot || process.cwd());
  const explicit = options.worldRoot ? path.resolve(options.worldRoot) : null;
  let selected = null;

  if (options.preferNearest !== false) {
    selected = findNearestMarker(options.cwd || process.cwd());
  }
  if (!selected && explicit) {
    const markerPath = path.join(explicit, MARKER_FILE);
    if (!fs.existsSync(markerPath)) throw new Error(`No world marker at ${markerPath}`);
    selected = { root: explicit, markerPath, marker: readJson(markerPath) };
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
  MARKER_FILE,
  findRepoRoot,
  findMarkers,
  findNearestMarker,
  isInside,
  isSafeRelativePath,
  readJson,
  readProfile,
  resolveWorld,
  validateMarkerShape,
  validateProfileShape,
};
