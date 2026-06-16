#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../..');

const SUPPORTED_COMMANDS = [
  ['node', ['.claude/scripts/tooling-architecture-tests.cjs']],
  ['node', ['.claude/scripts/metadata-hardening-tests.cjs']],
  ['node', ['.claude/scripts/cli-contract-tests.cjs']],
  ['node', ['.claude/scripts/ai-instruction-limit-tests.cjs']],
  ['node', ['.claude/scripts/build-safety-tests.cjs']],
  ['node', ['.claude/scripts/reference-pack-architecture-tests.cjs']],
  ['node', ['.claude/scripts/world-path-containment-tests.cjs']],
  ['node', ['.claude/scripts/transactional-tooling-tests.cjs']],
  ['node', ['.claude/scripts/voyage-tooling-tests.cjs']],
  ['node', ['.claude/scripts/validate-world-puppeteer.cjs']],
];

for (const [command, args] of SUPPORTED_COMMANDS) {
  const label = `${command} ${args.join(' ')}`;
  console.log(`==> ${label}`);
  const result = spawnSync(command === 'node' ? process.execPath : command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('supported test gate passed');
