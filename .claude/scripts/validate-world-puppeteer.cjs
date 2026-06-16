#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  discoverProfileDirectory,
  findRepoRoot,
  isInside,
  isPlainObject,
  pathKey,
  resolveContainedPath,
  validateMarkerShape,
  validateMarkerPaths,
  validateProfileShape,
} = require('./world-puppeteer-lib.cjs');
const { parseStrictArgs } = require('./cli-utils.cjs');
const {
  readJsonResult,
  validateAgainstSchemaFile,
} = require('./schema-utils.cjs');
const {
  validateReferencePackRegistry,
} = require('./reference-pack-architecture.cjs');
const { scanStaleReferences } = require('./stale-reference-rules.cjs');

const MARKER_FILE = '.world-puppeteer.json';
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'config-backups', 'images', 'stuff']);

function collectSkillIds(rootDir) {
  const skillsRoot = path.join(rootDir, '.agents', 'skills');
  if (!fs.existsSync(skillsRoot)) return new Set();
  return new Set(
    fs.readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsRoot, entry.name, 'SKILL.md')))
      .map((entry) => entry.name)
  );
}

function findMarkerPaths(rootDir) {
  const markers = [];
  function walk(dir) {
    const markerPath = path.join(dir, MARKER_FILE);
    if (fs.existsSync(markerPath)) markers.push(markerPath);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name));
    }
  }
  walk(rootDir);
  return markers.sort();
}

function hasResolvedMarkerPaths(entry) {
  return (
    typeof entry.tabsPath === 'string' &&
    typeof entry.compiledOutputPath === 'string' &&
    typeof entry.instructionsPath === 'string'
  );
}

function addUniqueMarkerChecks(markerEntries, errors) {
  const ids = new Map();
  const outputs = new Map();
  const pathEntries = markerEntries.filter(hasResolvedMarkerPaths);

  for (const entry of markerEntries) {
    if (!isPlainObject(entry.marker)) continue;
    if (typeof entry.marker.id === 'string' && entry.marker.id.length > 0) {
      const existing = ids.get(entry.marker.id);
      if (existing) {
        errors.push(
          `duplicate world id ${entry.marker.id}: ${existing.markerPath} and ${entry.markerPath}`
        );
      } else {
        ids.set(entry.marker.id, entry);
      }
    }
  }

  for (const entry of pathEntries) {
    const key = pathKey(entry.compiledOutputPath);
    const existing = outputs.get(key);
    if (existing) {
      errors.push(
        `duplicate compiled output destination ${entry.compiledOutputPath}: ` +
        `${existing.markerPath} and ${entry.markerPath}`
      );
    } else {
      outputs.set(key, entry);
    }
  }

  for (const entry of pathEntries) {
    for (const other of pathEntries) {
      if (entry === other) continue;

      if (isInside(entry.compiledOutputPath, other.tabsPath)) {
        errors.push(
          `${entry.markerPath}: paths.compiledOutput overlaps ${other.markerPath} tabs path: ` +
          `${entry.compiledOutputPath}`
        );
      }

      if (
        isInside(entry.compiledOutputPath, other.worldRoot) &&
        !isInside(entry.worldRoot, other.worldRoot)
      ) {
        errors.push(
          `${entry.markerPath}: paths.compiledOutput is inside another declared world ` +
          `${other.markerPath}: ${entry.compiledOutputPath}`
        );
      }

      for (const [label, protectedPath] of [
        ['marker', other.markerPath],
        ['instructions', other.instructionsPath],
      ]) {
        if (pathKey(entry.compiledOutputPath) === pathKey(protectedPath)) {
          errors.push(
            `${entry.markerPath}: paths.compiledOutput conflicts with ${label} path from ` +
            `${other.markerPath}: ${entry.compiledOutputPath}`
          );
        }
      }
    }
  }
}

function validateRepositoryMetadata({
  json = false,
  repoRoot = findRepoRoot(process.cwd()),
  schemaRoot = repoRoot,
  referencePackValidator = validateReferencePackRegistry,
  staleReferenceScanner = scanStaleReferences,
} = {}) {
  const errors = [];
  const warnings = [];
  const repoSkillIds = collectSkillIds(repoRoot);
  const markerSchemaPath = path.join(schemaRoot, '.world-puppeteer', 'schemas', 'world-marker.schema.json');
  const profileSchemaPath = path.join(schemaRoot, '.world-puppeteer', 'schemas', 'profile.schema.json');
  const markerEntries = [];

  for (const markerPath of findMarkerPaths(repoRoot)) {
    const loaded = readJsonResult(markerPath);
    if (loaded.error) {
      errors.push(loaded.error);
      continue;
    }
    const marker = loaded.value;
    const worldRoot = path.dirname(markerPath);
    const entry = { markerPath, marker, worldRoot, pathErrors: null };
    markerEntries.push(entry);

    errors.push(...validateAgainstSchemaFile(marker, markerSchemaPath).map((message) => `${markerPath}: ${message}`));
    const markerResult = validateMarkerShape(marker, worldRoot);
    errors.push(...markerResult.errors.map((message) => `${markerPath}: ${message}`));
    warnings.push(...markerResult.warnings.map((message) => `${markerPath}: ${message}`));

    if (isPlainObject(marker) && marker.paths && markerResult.errors.length === 0) {
      const pathResult = validateMarkerPaths(marker, worldRoot);
      entry.pathErrors = pathResult.errors;
      errors.push(...pathResult.errors.map((message) => `${markerPath}: ${message}`));
      if (pathResult.errors.length === 0 && hasResolvedMarkerPaths(pathResult.paths)) {
        Object.assign(entry, pathResult.paths);
      }
    }

    const activeProfileIds = new Set(
      isPlainObject(marker) && Array.isArray(marker.activeProfiles)
        ? marker.activeProfiles
        : []
    );
    const localProfileIds = new Set();

    const profileDiscovery = discoverProfileDirectory(worldRoot);
    errors.push(...profileDiscovery.errors);

    for (const profilePath of profileDiscovery.files) {
      const profileIdFromFilename = path.basename(profilePath, '.json');
      localProfileIds.add(profileIdFromFilename);

      const profileLoaded = readJsonResult(profilePath);
      if (profileLoaded.error) {
        errors.push(profileLoaded.error);
        continue;
      }

      const profile = profileLoaded.value;
      errors.push(
        ...validateAgainstSchemaFile(profile, profileSchemaPath)
          .map((message) => `${profilePath}: ${message}`)
      );

      if (isPlainObject(profile) && profile.id !== profileIdFromFilename) {
        errors.push(`${profilePath}: profile id must match filename`);
      }

      const profileResult = validateProfileShape(profile, worldRoot);
      errors.push(...profileResult.errors.map((message) => `${profilePath}: ${message}`));

      if (
        isPlainObject(profile) &&
        profile.required === true &&
        typeof profile.id === 'string' &&
        !activeProfileIds.has(profile.id)
      ) {
        errors.push(`${profilePath}: required profile must be listed in activeProfiles`);
      }
    }

    for (const activeProfileId of activeProfileIds) {
      if (!localProfileIds.has(activeProfileId)) {
        errors.push(`${markerPath}: active profile not found locally: ${activeProfileId}`);
      }
    }
  }

  addUniqueMarkerChecks(markerEntries, errors);

  const referencePackResult = referencePackValidator(repoRoot);
  errors.push(...referencePackResult.errors);
  warnings.push(...referencePackResult.warnings);
  errors.push(
    ...staleReferenceScanner(repoRoot, {
      validatedWorlds: markerEntries.filter(hasResolvedMarkerPaths),
    })
  );

  for (const skillId of ['japanese-romanization', 'orchestrator', 'charts', 'count', 'maps', 'reflect']) {
    if (repoSkillIds.has(skillId)) errors.push(`obsolete generic skill remains: ${skillId}`);
  }

  const result = { errors, warnings, worlds: markerEntries.length };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`World markers: ${markerEntries.length}`);
    for (const warning of warnings) console.warn(`warning: ${warning}`);
    for (const error of errors) console.error(`error: ${error}`);
  }
  return errors.length > 0 ? 1 : 0;
}

function main(argv = process.argv.slice(2)) {
  const { options } = parseStrictArgs(
    argv,
    {
      options: {
        '--json': { key: 'json' },
        '--help': { key: 'help', aliases: ['-h'] },
      },
      maxPositionals: 0,
    }
  );

  if (options.help) {
    console.log('Usage: node .claude/scripts/validate-world-puppeteer.cjs [--json]');
    return 0;
  }

  return validateRepositoryMetadata({ json: options.json === true });
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  addUniqueMarkerChecks,
  validateRepositoryMetadata,
};
