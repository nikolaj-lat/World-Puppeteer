#!/usr/bin/env node

const path = require('path');
const { resolveWorld } = require('./world-puppeteer-lib.cjs');

try {
  const resolved = resolveWorld({ cwd: process.cwd() });
  console.log('World Puppeteer context');
  console.log(`- world: ${resolved.marker.name}`);
  console.log(`- role: ${resolved.marker.role}`);
  console.log(`- root: ${path.relative(resolved.repoRoot, resolved.worldRoot) || '.'}`);
  console.log(`- output: ${path.relative(resolved.repoRoot, resolved.compiledOutputPath)}`);
  console.log(`- activeProfiles: ${(resolved.marker.activeProfiles || []).join(', ') || '(none)'}`);
  console.log(`- validationProfiles: ${resolved.marker.toolchain.validationProfiles.join(', ')}`);
} catch (error) {
  console.log(`World Puppeteer context unavailable: ${error.message}`);
}
