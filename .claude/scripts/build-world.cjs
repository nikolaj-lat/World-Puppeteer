#!/usr/bin/env node

const path = require('path');
const {
  buildWorldSource,
  resolveWorld,
  runConfiguredBuild,
} = require('./world-puppeteer-lib.cjs');

function parseArgs(argv) {
  const args = {};
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--world') {
      if (seen.has(arg)) throw new Error('--world may be provided only once');
      seen.add(arg);
      const value = argv[++i];
      if (!value || value.startsWith('-')) throw new Error('--world requires a value');
      args.worldRoot = value;
    } else if (arg === '--no-backup') {
      if (seen.has(arg)) throw new Error('--no-backup may be provided only once');
      seen.add(arg);
      args.noBackup = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return args;
}

function buildWorld(args = {}) {
  const resolved = resolveWorld({ worldRoot: args.worldRoot, cwd: args.worldRoot || process.cwd(), preferNearest: true });
  const build = runConfiguredBuild(resolved, { noBackup: args.noBackup });
  if (build.status !== 0 || build.error) throw build.error || new Error(build.stderr || 'Build failed');
  return { resolved, topLevelKeys: build.output.topLevelKeys };
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node .claude/scripts/build-world.cjs [--world <world-root>] [--no-backup]');
    process.exit(0);
  }
  const output = buildWorld(args);
  console.log(
    `Rebuilt ${path.relative(output.resolved.repoRoot, output.resolved.compiledOutputPath)} (${output.topLevelKeys} top-level keys).`
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

module.exports = { buildWorld, buildWorldSource };
