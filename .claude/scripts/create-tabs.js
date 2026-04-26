#!/usr/bin/env node

/**
 * Ensure tabs/ directory exists before Edit/Write operations.
 * Used by PreToolUse hook.
 *
 * If tabs/ is missing, automatically runs split from:
 *   1. config.json (if exists), or
 *   2. .claude/examples/minimal-world.json (fallback)
 *
 * Exits 0 if tabs/ exists or was created successfully.
 * Exits 1 if tabs/ is missing and split fails.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.join(__dirname, '../..');
const tabsDir = path.join(projectDir, 'tabs');
const configPath = path.join(projectDir, 'config.json');
const minimalWorldPath = path.join(__dirname, '../examples/minimal-world.json');
const splitScript = path.join(__dirname, 'split.js');

// If tabs/ exists, we're done
if (fs.existsSync(tabsDir)) {
  process.exit(0);
}

// tabs/ missing - initialize it
let sourcePath;
if (fs.existsSync(configPath)) {
  sourcePath = configPath;
  console.log('tabs/ not found. Auto-initializing from config.json...');
} else {
  sourcePath = minimalWorldPath;
  console.log('tabs/ not found. Auto-initializing from minimal-world.json...');
}

try {
  execSync(`node "${splitScript}" "${sourcePath}"`, { stdio: 'inherit' });
  console.log('tabs/ initialized successfully.');
  process.exit(0);
} catch (err) {
  console.error('Failed to initialize tabs/:', err.message);
  process.exit(1);
}
