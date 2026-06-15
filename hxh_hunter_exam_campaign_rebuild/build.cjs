#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const script = path.join(repoRoot, '.claude', 'scripts', 'build-world.cjs');

function exitCodeForSpawnResult(result) {
  if (result.error) return 1;
  return result.status ?? 1;
}

function main() {
  const result = spawnSync(process.execPath, [script, '--world', __dirname], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) console.error(result.error.message);
  process.exit(exitCodeForSpawnResult(result));
}

if (require.main === module) main();

module.exports = { exitCodeForSpawnResult };
