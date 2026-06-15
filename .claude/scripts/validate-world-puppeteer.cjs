#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  findMarkers,
  findRepoRoot,
  readJson,
  validateMarkerShape,
  validateModRegistry,
  validateProfileShape,
} = require('./world-puppeteer-lib.cjs');

function collectSkillIds(rootDir) {
  const skillsRoot = path.join(rootDir, '.agents', 'skills');
  if (!fs.existsSync(skillsRoot)) return new Set();
  return new Set(
    fs
      .readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsRoot, entry.name, 'SKILL.md')))
      .map((entry) => entry.name)
  );
}

function main() {
  const repoRoot = findRepoRoot(process.cwd());
  const errors = [];
  const warnings = [];
  const markers = findMarkers(repoRoot);
  const repoSkillIds = collectSkillIds(repoRoot);

  for (const entry of markers) {
    const markerResult = validateMarkerShape(entry.marker, entry.root);
    errors.push(...markerResult.errors.map((message) => `${entry.markerPath}: ${message}`));
    warnings.push(...markerResult.warnings.map((message) => `${entry.markerPath}: ${message}`));

    for (const profileId of entry.marker.activeProfiles || []) {
      const profilePath = path.join(entry.root, '.world-puppeteer', 'profiles', `${profileId}.json`);
      if (!fs.existsSync(profilePath)) {
        errors.push(`${entry.markerPath}: active profile not found: ${profileId}`);
        continue;
      }
      const profile = readJson(profilePath);
      if (profile.id !== profileId) errors.push(`${profilePath}: profile id must match filename`);
      const profileResult = validateProfileShape(profile, entry.root);
      errors.push(...profileResult.errors.map((message) => `${profilePath}: ${message}`));
    }
  }

  const modResult = validateModRegistry(repoRoot);
  errors.push(...modResult.errors);
  warnings.push(...modResult.warnings);

  for (const skillId of ['japanese-romanization', 'orchestrator', 'charts', 'count', 'maps', 'reflect']) {
    if (repoSkillIds.has(skillId)) errors.push(`obsolete generic skill remains: ${skillId}`);
  }

  const result = { errors, warnings, worlds: markers.length };
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`World markers: ${markers.length}`);
    for (const warning of warnings) console.warn(`warning: ${warning}`);
    for (const error of errors) console.error(`error: ${error}`);
  }
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
