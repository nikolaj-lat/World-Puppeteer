#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');

function run(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  if (result.error) {
    console.error(
      `Could not run git: ${result.error.message}`
    );
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(
      result.stderr ||
      result.stdout ||
      `git exited ${result.status}`
    );
    process.exit(result.status || 1);
  }

  return result.stdout.trim();
}

run([
  'config',
  '--local',
  'core.hooksPath',
  '.githooks',
]);

const configured = run([
  'config',
  '--local',
  '--get',
  'core.hooksPath',
]);

if (configured !== '.githooks') {
  console.error(
    `Unexpected core.hooksPath value: ${configured}`
  );
  process.exit(1);
}

console.log(
  'Installed repository Git hooks via core.hooksPath=.githooks'
);