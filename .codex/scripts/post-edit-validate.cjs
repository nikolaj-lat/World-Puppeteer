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

function absoluteCandidate(candidate) {
  if (!candidate || typeof candidate !== 'string') return false;
  return path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(projectDir, candidate);
}

function warning(message, warnings) {
  warnings.push(message);
  console.error(`WARNING: ${message}`);
}

function affectedWorldsForPaths(pathCandidates, worlds) {
  const affected = new Map();

  for (const world of worlds) {
    const resolved = resolveWorld({ worldRoot: world.root, cwd: world.root, preferNearest: false });
    for (const candidate of pathCandidates) {
      if (isInside(candidate, resolved.tabsPath)) {
        affected.set(resolved.worldRoot, resolved);
      }
    }
  }

  return Array.from(affected.values());
}

function relativeWorld(world) {
  return path.relative(projectDir, world.worldRoot) || '.';
}

function dryRunOutput(targets, warnings) {
  console.log(JSON.stringify({
    affectedWorlds: targets.map((world) => relativeWorld(world)),
    validatedEditableWorlds: targets
      .filter((world) => world.marker.role === 'editable')
      .map((world) => relativeWorld(world)),
    warnings,
  }, null, 2));
}

function block(reason) {
  console.log(JSON.stringify({ decision: 'block', reason }));
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

function validateWorld(world) {
  const relative = relativeWorld(world);
  if (world.marker.role !== 'editable') {
    block(`WORLD WRITE BLOCKED - ${relative} is role=${world.marker.role}. Ordinary content edits are not allowed.`);
    return false;
  }

  const pretty = runNodeScript('.claude/scripts/pretty-print.js', [world.tabsPath]);
  if (pretty.status !== 0 || pretty.error) {
    const detail = pretty.stdout || pretty.stderr || pretty.error?.message || 'Unknown pretty-print failure';
    block(`JSON PARSE ERROR in ${relative}:\n${detail}\n\nCheck for missing commas, brackets, or quotes.`);
    return false;
  }

  const build = runNodeScript('.claude/scripts/build-world.cjs', ['--world', world.worldRoot]);
  if (build.status !== 0 || build.error) {
    const detail = build.stdout || build.stderr || build.error?.message || 'Unknown build failure';
    block(`BUILD ERROR in ${relative}:\n${detail}`);
    return false;
  }

  const validationRun = runNodeScript('.claude/scripts/validate.js', [world.tabsPath, '--json']);
  if (validationRun.status !== 0 || validationRun.error) {
    const detail = validationRun.stdout || validationRun.stderr || validationRun.error?.message || 'Unknown validator failure';
    block(`VALIDATION TOOL ERROR in ${relative}:\n${detail}`);
    return false;
  }

  let validation;
  try {
    validation = JSON.parse(validationRun.stdout || '{}');
  } catch {
    block(`VALIDATION TOOL ERROR in ${relative} - validate.js did not return JSON:\n${validationRun.stdout}\n${validationRun.stderr}`);
    return false;
  }

  const errors = Array.isArray(validation.errors) ? validation.errors : [];
  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        let message = `${error.path || 'unknown'}: ${error.message || 'Unknown validation error'}`;
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

function main() {
  const warnings = [];
  const { data: hookData, parseError } = readHookInput();
  if (parseError) {
    warning('Post-edit hook could not parse Codex hook payload; run final world validation manually.', warnings);
    if (process.env.WORLD_PUPPETEER_HOOK_DRY_RUN === '1') dryRunOutput([], warnings);
    return;
  }

  const collected = collectReliablePathValues(hookData);
  if (!collected.reliable) {
    warning('Post-edit hook could not recover reliable changed paths; run final world validation manually.', warnings);
    if (process.env.WORLD_PUPPETEER_HOOK_DRY_RUN === '1') dryRunOutput([], warnings);
    return;
  }

  const pathCandidates = collected.paths.map(absoluteCandidate).filter(Boolean);
  const worlds = findMarkers(projectDir);
  const targets = affectedWorldsForPaths(pathCandidates, worlds);

  if (targets.length === 0) {
    if (process.env.WORLD_PUPPETEER_HOOK_DRY_RUN === '1') dryRunOutput([], warnings);
    return;
  }

  if (process.env.WORLD_PUPPETEER_HOOK_DRY_RUN === '1') {
    dryRunOutput(targets, warnings);
    return;
  }

  for (const world of targets) {
    if (!validateWorld(world)) {
      return;
    }
  }
}

if (require.main === module) main();

module.exports = {
  affectedWorldsForPaths,
  collectReliablePathValues,
  parseApplyPatchPaths,
};
