#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const script = path.join(repoRoot, '.claude', 'scripts', 'build-world.cjs');
const result = spawnSync(process.execPath, [script, '--world', __dirname], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status || 0);
