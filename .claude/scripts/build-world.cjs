#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { resolveWorld } = require('./world-puppeteer-lib.cjs');

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
  if (!fs.existsSync(resolved.tabsPath)) throw new Error(`Tabs directory not found: ${resolved.tabsPath}`);

  if (fs.existsSync(resolved.compiledOutputPath) && !args.noBackup) {
    const backupDir = path.join(resolved.worldRoot, 'config-backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const parsed = path.parse(resolved.compiledOutputPath);
    fs.copyFileSync(resolved.compiledOutputPath, path.join(backupDir, `${parsed.name}-${stamp}${parsed.ext}`));
  }

  const result = {};
  for (const file of fs.readdirSync(resolved.tabsPath).sort()) {
    if (!file.endsWith('.json')) continue;
    const data = JSON.parse(fs.readFileSync(path.join(resolved.tabsPath, file), 'utf8'));
    const worldBackground = data.worldBackground;
    delete data.worldBackground;
    Object.assign(result, data);
    if (worldBackground !== undefined) {
      result.storySettings = result.storySettings || {};
      result.storySettings.worldBackground = worldBackground;
    }
  }

  fs.writeFileSync(resolved.compiledOutputPath, JSON.stringify(result, null, 2) + '\n');
  return { resolved, topLevelKeys: Object.keys(result).length };
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

module.exports = { buildWorld };
