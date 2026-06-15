#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  findRepoRoot,
  validateMarkerShape,
  validateProfileShape,
} = require('./world-puppeteer-lib.cjs');
const {
  readJsonResult,
  validateAgainstSchemaFile,
} = require('./schema-utils.cjs');
const {
  validateReferencePackRegistry,
} = require('./reference-pack-architecture.cjs');

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

function main() {
  const repoRoot = findRepoRoot(process.cwd());
  const errors = [];
  const warnings = [];
  const repoSkillIds = collectSkillIds(repoRoot);
  const markerSchemaPath = path.join(repoRoot, '.world-puppeteer', 'schemas', 'world-marker.schema.json');
  const profileSchemaPath = path.join(repoRoot, '.world-puppeteer', 'schemas', 'profile.schema.json');
  const markerEntries = [];

  for (const markerPath of findMarkerPaths(repoRoot)) {
    const loaded = readJsonResult(markerPath);
    if (loaded.error) {
      errors.push(loaded.error);
      continue;
    }
    const marker = loaded.value;
    const worldRoot = path.dirname(markerPath);
    markerEntries.push({ markerPath, marker, worldRoot });

    errors.push(...validateAgainstSchemaFile(marker, markerSchemaPath).map((message) => `${markerPath}: ${message}`));
    const markerResult = validateMarkerShape(marker, worldRoot);
    errors.push(...markerResult.errors.map((message) => `${markerPath}: ${message}`));
    warnings.push(...markerResult.warnings.map((message) => `${markerPath}: ${message}`));

    const profileRoot = path.join(worldRoot, '.world-puppeteer', 'profiles');
    const activeProfileIds = new Set(marker.activeProfiles || []);
    const localProfileIds = new Set();

    if (fs.existsSync(profileRoot)) {
      const profileFiles = fs.readdirSync(profileRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

      for (const profileFile of profileFiles) {
        const profileIdFromFilename = path.basename(profileFile, '.json');
        const profilePath = path.join(profileRoot, profileFile);
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

        if (profile.id !== profileIdFromFilename) {
          errors.push(`${profilePath}: profile id must match filename`);
        }

        const profileResult = validateProfileShape(profile, worldRoot);
        errors.push(...profileResult.errors.map((message) => `${profilePath}: ${message}`));

        if (profile.required === true && !activeProfileIds.has(profile.id)) {
          errors.push(`${profilePath}: required profile must be listed in activeProfiles`);
        }
      }
    }

    for (const activeProfileId of activeProfileIds) {
      if (!localProfileIds.has(activeProfileId)) {
        errors.push(`${markerPath}: active profile not found locally: ${activeProfileId}`);
      }
    }
  }

  const referencePackResult = validateReferencePackRegistry(repoRoot);
  errors.push(...referencePackResult.errors);
  warnings.push(...referencePackResult.warnings);

  for (const skillId of ['japanese-romanization', 'orchestrator', 'charts', 'count', 'maps', 'reflect']) {
    if (repoSkillIds.has(skillId)) errors.push(`obsolete generic skill remains: ${skillId}`);
  }

  const result = { errors, warnings, worlds: markerEntries.length };
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`World markers: ${markerEntries.length}`);
    for (const warning of warnings) console.warn(`warning: ${warning}`);
    for (const error of errors) console.error(`error: ${error}`);
  }
  process.exit(errors.length > 0 ? 1 : 0);
}

try {
  main();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}
