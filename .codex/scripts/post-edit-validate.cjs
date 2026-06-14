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

const projectDir = path.join(__dirname, '..', '..');
const tabsDir = path.join(projectDir, 'tabs');

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

function isTabsPath(candidate) {
  if (!candidate || typeof candidate !== 'string') return false;
  const absolute = path.resolve(projectDir, candidate);
  const tabsAbsolute = path.resolve(tabsDir);
  return absolute === tabsAbsolute || absolute.startsWith(tabsAbsolute + path.sep);
}

function runNodeScript(scriptRelativePath, args = []) {
  const result = spawnSync('node', [scriptRelativePath, ...args], {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
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
  const pathCandidates = collectPathValues(hookData);

  // If Codex supplies edited paths, avoid work for unrelated files. If it
  // doesn't, validate anyway so apply_patch-style edits do not bypass checks.
  if (pathCandidates.length > 0 && !pathCandidates.some(isTabsPath)) {
    return;
  }

  const pretty = runNodeScript('.claude/scripts/pretty-print.js');
  if (pretty.status !== 0 || pretty.error) {
    const detail = pretty.stdout || pretty.stderr || pretty.error?.message || 'Unknown pretty-print failure';
    block(`JSON PARSE ERROR - fix malformed JSON before continuing:\n${detail}\n\nCheck for missing commas, brackets, or quotes.`);
    return;
  }

  const validationRun = runNodeScript('.claude/scripts/validate.js', ['--json']);
  let validation;
  try {
    validation = JSON.parse(validationRun.stdout || '{}');
  } catch {
    block(`VALIDATION TOOL ERROR - validate.js did not return JSON:\n${validationRun.stdout}\n${validationRun.stderr}`);
    return;
  }

  const errors = Array.isArray(validation.errors) ? validation.errors : [];
  if (errors.length === 0) {
    runNodeScript('.claude/scripts/build.js');
    return;
  }

  const errorMessages = errors
    .map((error) => {
      let message = `${error.path || 'unknown'}: ${error.message || 'Unknown validation error'}`;
      if (error.expected) message += ` (valid: ${error.expected})`;
      if (error.actual) message += ` (got: ${error.actual})`;
      return message;
    })
    .join('\n');

  block(
    `VALIDATION ERRORS:\n${errorMessages}\n\nFix the invalid values or use the matching Codex project skill/custom agent for the affected tab.`
  );
}

main();
