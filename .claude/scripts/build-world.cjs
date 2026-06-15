#!/usr/bin/env node

const path = require('path');
const {
  buildWorldSource,
  resolveWorld,
  runConfiguredBuild,
} = require('./world-puppeteer-lib.cjs');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--world') args.worldRoot = argv[++i];
    else if (arg === '--no-backup') args.noBackup = true;
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
  const output = buildWorld(parseArgs(process.argv.slice(2)));
  console.log(
    `Rebuilt ${path.relative(output.resolved.repoRoot, output.resolved.compiledOutputPath)} (${output.topLevelKeys} top-level keys).`
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

module.exports = { buildWorld, buildWorldSource };
