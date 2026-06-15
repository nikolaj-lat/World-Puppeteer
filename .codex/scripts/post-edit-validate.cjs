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

function readHookInput() {
  try {
    const input = fs.readFileSync(0, 'utf8');
    return input.trim() ? JSON.parse(input) : {};
  } catch {
    return {};
  }
}

function collectPathValues(value, out = []) {
  if (!value || typeof value !== 'object') return out;

  if (Array.isArray(value)) {
    for (const item of value) collectPathValues(item, out);
    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (
      typeof child === 'string' &&
      (normalizedKey === 'path' ||
        normalizedKey === 'file_path' ||
        normalizedKey === 'filepath' ||
        normalizedKey === 'file')
    ) {
      out.push(child);
    } else {
      collectPathValues(child, out);
    }
  }
  return out;
}

function absoluteCandidate(candidate) {
  if (!candidate || typeof candidate !== 'string') return false;
  return path.resolve(projectDir, candidate);
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

function block(reason) {
  console.log(JSON.stringify({ decision: 'block', reason }));
}

function main() {
  const hookData = readHookInput();
  const pathCandidates = collectPathValues(hookData).map(absoluteCandidate).filter(Boolean);
  const worlds = findMarkers(projectDir);
  const affected = new Map();

  for (const world of worlds) {
    const resolved = resolveWorld({ worldRoot: world.root, cwd: world.root, preferNearest: false });
    for (const candidate of pathCandidates) {
      if (isInside(candidate, resolved.tabsPath)) {
        affected.set(resolved.worldRoot, resolved);
      }
    }
  }

  if (pathCandidates.length > 0 && affected.size === 0) {
    return;
  }

  const targets = affected.size > 0
    ? Array.from(affected.values())
    : [resolveWorld({ cwd: process.cwd() })];

  for (const world of targets) {
    const relativeWorld = path.relative(projectDir, world.worldRoot) || '.';
    if (world.marker.role !== 'editable') {
      block(`WORLD WRITE BLOCKED - ${relativeWorld} is role=${world.marker.role}. Ordinary content edits are not allowed.`);
      return;
    }

    const pretty = runNodeScript('.claude/scripts/pretty-print.js', [world.tabsPath]);
    if (pretty.status !== 0 || pretty.error) {
      const detail = pretty.stdout || pretty.stderr || pretty.error?.message || 'Unknown pretty-print failure';
      block(`JSON PARSE ERROR in ${relativeWorld}:\n${detail}\n\nCheck for missing commas, brackets, or quotes.`);
      return;
    }

    const build = runNodeScript('.claude/scripts/build-world.cjs', ['--world', world.worldRoot]);
    if (build.status !== 0 || build.error) {
      const detail = build.stdout || build.stderr || build.error?.message || 'Unknown build failure';
      block(`BUILD ERROR in ${relativeWorld}:\n${detail}`);
      return;
    }

    const validationRun = runNodeScript('.claude/scripts/validate.js', [world.tabsPath, '--json']);
    let validation;
    try {
      validation = JSON.parse(validationRun.stdout || '{}');
    } catch {
      block(`VALIDATION TOOL ERROR in ${relativeWorld} - validate.js did not return JSON:\n${validationRun.stdout}\n${validationRun.stderr}`);
      return;
    }

    const errors = Array.isArray(validation.errors) ? validation.errors : [];
    if (validationRun.status !== 0 || errors.length > 0) {
      const errorMessages = errors
        .map((error) => {
          let message = `${error.path || 'unknown'}: ${error.message || 'Unknown validation error'}`;
          if (error.expected) message += ` (valid: ${error.expected})`;
          if (error.actual) message += ` (got: ${error.actual})`;
          return message;
        })
        .join('\n');

      block(`VALIDATION ERRORS in ${relativeWorld}:\n${errorMessages || validationRun.stderr}`);
      return;
    }
  }
}

main();
