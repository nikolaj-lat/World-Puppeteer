#!/usr/bin/env node

/**
 * Codex PostToolUse hook: validate world tabs after file edits.
 *
 * This intentionally lives under .codex so Claude's hook behavior remains
 * unchanged. It reuses the existing project scripts in .claude/scripts.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  findMarkers,
  isInside,
  resolveWorld,
  runConfiguredBuild,
  runConfiguredFormat,
  runConfiguredValidations,
} = require('../../.claude/scripts/world-puppeteer-lib.cjs');

const projectDir = path.join(__dirname, '..', '..');
const TIMEOUT_MS = 120000;
const PATCH_FILE_RE = /^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm;

function readHookInput() {
  try {
    const input = fs.readFileSync(0, 'utf8');
    return { data: input.trim() ? JSON.parse(input) : {}, parseError: null };
  } catch (error) {
    return { data: {}, parseError: error };
  }
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function directPathValues(toolInput) {
  if (!isPlainObject(toolInput)) return [];
  const paths = [];
  for (const key of ['file_path', 'filePath', 'path']) {
    if (typeof toolInput[key] === 'string') paths.push(toolInput[key]);
  }
  for (const key of ['files', 'paths']) {
    if (Array.isArray(toolInput[key])) {
      for (const value of toolInput[key]) {
        if (typeof value === 'string') paths.push(value);
        else if (isPlainObject(value)) paths.push(...directPathValues(value));
      }
    }
  }
  for (const key of ['edits', 'updates', 'writes']) {
    if (Array.isArray(toolInput[key])) {
      for (const value of toolInput[key]) {
        if (isPlainObject(value)) paths.push(...directPathValues(value));
      }
    }
  }
  return paths;
}

function patchTextValues(toolInput) {
  const values = [];
  if (typeof toolInput === 'string') values.push(toolInput);
  if (isPlainObject(toolInput)) {
    for (const key of ['patch', 'command', 'cmd', 'input']) {
      if (typeof toolInput[key] === 'string') values.push(toolInput[key]);
    }
  }
  return values;
}

function parseApplyPatchPaths(text) {
  const paths = [];
  for (const match of text.matchAll(PATCH_FILE_RE)) {
    const candidate = match[1].trim();
    if (candidate && candidate !== '/dev/null') paths.push(candidate);
  }
  return paths;
}

function collectReliablePathValues(hookData) {
  if (!isPlainObject(hookData)) return { paths: [], reliable: false };
  const toolInput = hookData.tool_input || hookData.toolInput || hookData.input || hookData.arguments || hookData;
  const paths = [];

  paths.push(...directPathValues(toolInput));
  for (const text of patchTextValues(toolInput)) paths.push(...parseApplyPatchPaths(text));

  const seen = new Set();
  const unique = [];
  for (const value of paths) {
    if (typeof value !== 'string' || value.trim() === '') continue;
    const trimmed = value.trim();
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return { paths: unique, reliable: unique.length > 0 };
}

function hookWorkingDirectory(hookData, warnings) {
  if (!isPlainObject(hookData)) return projectDir;
  for (const key of ['cwd', 'workingDirectory', 'working_directory', 'currentWorkingDirectory']) {
    if (typeof hookData[key] !== 'string' || hookData[key].trim() === '') continue;
    const candidate = path.isAbsolute(hookData[key])
      ? path.resolve(hookData[key])
      : path.resolve(projectDir, hookData[key]);
    if (isInside(candidate, projectDir) && fs.existsSync(candidate)) return candidate;
    warning(`Ignoring unsafe hook cwd: ${hookData[key]}`, warnings);
  }
  return projectDir;
}

function absoluteCandidate(candidate, cwd, warnings) {
  if (!candidate || typeof candidate !== 'string') return false;
  const resolved = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(cwd, candidate);
  if (!isInside(resolved, projectDir)) {
    warning(`Ignoring changed path outside repository: ${candidate}`, warnings);
    return false;
  }
  return resolved;
}

function warning(message, warnings) {
  warnings.push(message);
  console.error(`WARNING: ${message}`);
}

function isSamePath(a, b) {
  return path.resolve(a) === path.resolve(b);
}

function pathCategoryForWorld(candidate, world) {
  if (isInside(candidate, world.tabsPath)) return 'tabs';
  if (isSamePath(candidate, world.markerPath)) return 'metadata';
  const worldMetadataDirs = [
    path.join(world.worldRoot, '.world-puppeteer', 'profiles'),
    path.join(world.worldRoot, '.world-puppeteer', 'schemas'),
    path.join(world.worldRoot, '.world-puppeteer', 'tooling'),
    path.join(world.worldRoot, '.agents', 'skills'),
    path.join(world.worldRoot, '.claude', 'skills'),
  ];
  if (worldMetadataDirs.some((dir) => isInside(candidate, dir))) return 'metadata';
  for (const instructionFile of ['AGENTS.override.md', 'CLAUDE.override.md']) {
    if (isSamePath(candidate, path.join(world.worldRoot, instructionFile))) return 'metadata';
  }
  if (isSamePath(candidate, world.instructionsPath)) return 'metadata';
  return null;
}

function isRepoToolingPath(candidate) {
  const repoToolingDirs = [
    '.agents',
    '.claude',
    '.codex',
    '.world-puppeteer',
  ].map((relative) => path.join(projectDir, relative));
  if (repoToolingDirs.some((dir) => isInside(candidate, dir))) return true;
  return ['AGENTS.md', '.world-puppeteer.json'].some((relative) => isSamePath(candidate, path.join(projectDir, relative)));
}

function affectedRoutesForPaths(pathCandidates, worlds) {
  const affected = new Map();
  let repositoryTooling = false;

  for (const world of worlds) {
    const resolved = resolveWorld({ worldRoot: world.root, cwd: world.root, preferNearest: false });
    for (const candidate of pathCandidates) {
      const category = pathCategoryForWorld(candidate, resolved);
      if (category) {
        const existing = affected.get(resolved.worldRoot) || { world: resolved, categories: new Set() };
        existing.categories.add(category);
        affected.set(resolved.worldRoot, existing);
      }
    }
  }

  for (const candidate of pathCandidates) {
    if (isRepoToolingPath(candidate)) repositoryTooling = true;
  }

  return {
    targets: Array.from(affected.values()),
    repositoryTooling,
  };
}

function affectedWorldsForPaths(pathCandidates, worlds) {
  return affectedRoutesForPaths(pathCandidates, worlds).targets.map((entry) => entry.world);
}

function relativeWorld(world) {
  return path.relative(projectDir, world.worldRoot) || '.';
}

function dryRunOutput(routes, warnings) {
  const targets = routes.targets || [];
  console.log(JSON.stringify({
    affectedWorlds: targets.map((entry) => relativeWorld(entry.world)),
    validatedEditableWorlds: targets
      .filter((entry) => entry.world.marker.role === 'editable' && entry.categories.has('tabs'))
      .map((entry) => relativeWorld(entry.world)),
    metadataWorlds: targets
      .filter((entry) => entry.categories.has('metadata'))
      .map((entry) => relativeWorld(entry.world)),
    repositoryTooling: !!routes.repositoryTooling,
    warnings,
  }, null, 2));
}

function block(reason) {
  console.log(JSON.stringify({ decision: 'block', reason }));
}

function diagnosticMode() {
  return process.env.WORLD_PUPPETEER_HOOK_DIAGNOSTIC === '1';
}

function runNodeScript(scriptRelativePath, args = [], cwd = projectDir) {
  const result = spawnSync('node', [scriptRelativePath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    timeout: TIMEOUT_MS,
  });

  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error,
  };
}

function formatBuildValidateWorld(world) {
  const relative = relativeWorld(world);
  if (world.marker.role !== 'editable') {
    block(`WORLD WRITE BLOCKED - ${relative} is role=${world.marker.role}. Ordinary content edits are not allowed.`);
    return false;
  }

  const pretty = runConfiguredFormat(world);
  if (pretty.status !== 0 || pretty.error) {
    const detail = pretty.stdout || pretty.stderr || pretty.error?.message || 'Unknown pretty-print failure';
    block(`JSON PARSE ERROR in ${relative}:\n${detail}\n\nCheck for missing commas, brackets, or quotes.`);
    return false;
  }

  const build = runConfiguredBuild(world);
  if (build.status !== 0 || build.error) {
    const detail = build.stdout || build.stderr || build.error?.message || 'Unknown build failure';
    block(`BUILD ERROR in ${relative}:\n${detail}`);
    return false;
  }

  const validationRuns = runConfiguredValidations(world);
  const errors = validationRuns.flatMap((run) => run.errors.map((error) => ({ ...error, profileId: run.profileId })));
  if (validationRuns.some((run) => !run.ok) || errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        let message = `[${error.profileId}] ${error.path || 'unknown'}: ${error.message || 'Unknown validation error'}`;
        if (error.expected) message += ` (valid: ${error.expected})`;
        if (error.actual) message += ` (got: ${error.actual})`;
        return message;
      })
      .join('\n');

    block(`VALIDATION ERRORS in ${relative}:\n${errorMessages}`);
    return false;
  }

  return true;
}

function validateWorldPuppeteerMetadata() {
  const validation = runNodeScript('.claude/scripts/validate-world-puppeteer.cjs');
  if (validation.status !== 0 || validation.error) {
    const detail = validation.stdout || validation.stderr || validation.error?.message || 'Unknown World-Puppeteer validation failure';
    block(`WORLD-PUPPETEER METADATA ERROR:\n${detail}`);
    return false;
  }
  return true;
}

function validateRepositoryTooling() {
  const tests = runNodeScript('.claude/scripts/tooling-architecture-tests.cjs');
  if (tests.status !== 0 || tests.error) {
    const detail = tests.stdout || tests.stderr || tests.error?.message || 'Unknown tooling architecture test failure';
    block(`TOOLING ARCHITECTURE ERROR:\n${detail}`);
    return false;
  }
  return validateWorldPuppeteerMetadata();
}

function main() {
  const warnings = [];
  const { data: hookData, parseError } = readHookInput();
  if (parseError) {
    const message = 'Post-edit hook could not parse Codex hook payload; blocking because changed paths cannot be recovered reliably.';
    warning(message, warnings);
    if (process.env.WORLD_PUPPETEER_HOOK_DRY_RUN === '1') dryRunOutput({ targets: [], repositoryTooling: false }, warnings);
    else if (!diagnosticMode()) block(message);
    return;
  }

  const collected = collectReliablePathValues(hookData);
  if (!collected.reliable) {
    const message = 'Post-edit hook could not recover reliable changed paths; blocking because validation cannot be routed.';
    warning(message, warnings);
    if (process.env.WORLD_PUPPETEER_HOOK_DRY_RUN === '1') dryRunOutput({ targets: [], repositoryTooling: false }, warnings);
    else if (!diagnosticMode()) block(message);
    return;
  }

  const safeCwd = hookWorkingDirectory(hookData, warnings);
  const seenPaths = new Set();
  const pathCandidates = [];
  for (const value of collected.paths) {
    const candidate = absoluteCandidate(value, safeCwd, warnings);
    if (!candidate || seenPaths.has(candidate)) continue;
    seenPaths.add(candidate);
    pathCandidates.push(candidate);
  }
  const worlds = findMarkers(projectDir);
  if (pathCandidates.length !== collected.paths.length) {
    const message = 'One or more changed paths were unsafe or outside repository containment; blocking normal edit flow.';
    if (process.env.WORLD_PUPPETEER_HOOK_DRY_RUN === '1') {
      warning(message, warnings);
    } else if (!diagnosticMode()) {
      block(message);
      return;
    }
  }
  const routes = affectedRoutesForPaths(pathCandidates, worlds);

  if (routes.targets.length === 0 && !routes.repositoryTooling) {
    const message = 'Changed paths could not be classified as world content, world metadata, or repository tooling; blocking normal edit flow.';
    if (process.env.WORLD_PUPPETEER_HOOK_DRY_RUN === '1') dryRunOutput(routes, warnings);
    else if (!diagnosticMode()) block(message);
    return;
  }

  if (process.env.WORLD_PUPPETEER_HOOK_DRY_RUN === '1') {
    dryRunOutput(routes, warnings);
    return;
  }

  let metadataValidated = false;
  if (routes.repositoryTooling) {
    if (!validateRepositoryTooling()) return;
    metadataValidated = true;
  }
  if (
    !metadataValidated &&
    routes.targets.some((entry) => entry.categories.has('metadata')) &&
    !validateWorldPuppeteerMetadata()
  ) return;

  for (const entry of routes.targets) {
    if (entry.categories.has('tabs') && !formatBuildValidateWorld(entry.world)) {
      return;
    }
  }
}

if (require.main === module) main();

module.exports = {
  affectedWorldsForPaths,
  affectedRoutesForPaths,
  absoluteCandidate,
  collectReliablePathValues,
  hookWorkingDirectory,
  parseApplyPatchPaths,
};
