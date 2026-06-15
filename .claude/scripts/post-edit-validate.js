#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const sharedHook = path.join(repoRoot, '.codex', 'scripts', 'post-edit-validate.cjs');

const input = fs.readFileSync(0, 'utf8');
const result = spawnSync(process.execPath, [sharedHook], {
  cwd: repoRoot,
  input,
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? (result.error ? 1 : 0));
