#!/usr/bin/env node

const path = require('path');
const { resolveWorld } = require('./world-puppeteer-lib.cjs');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--world') args.worldRoot = argv[++i];
    else if (arg === '--cwd') args.cwd = argv[++i];
    else if (arg === '--json') args.json = true;
  }
  return args;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const resolved = resolveWorld({ ...args, preferNearest: !args.worldRoot });
  const profileSummaries = resolved.activeProfiles.map(({ profilePath, profile }) => ({
    id: profile.id,
    path: path.relative(resolved.repoRoot, profilePath),
    skills: profile.skills,
    appliesTo: profile.appliesTo,
    required: profile.required,
  }));
  const output = {
    repoRoot: resolved.repoRoot,
    worldRoot: resolved.worldRoot,
    role: resolved.marker.role,
    id: resolved.marker.id,
    name: resolved.marker.name,
    format: resolved.marker.format,
    tabsPath: resolved.tabsPath,
    compiledOutputPath: resolved.compiledOutputPath,
    activeProfiles: profileSummaries,
    validationProfiles: resolved.marker.toolchain.validationProfiles,
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`Resolved world: ${output.name}`);
    console.log(`Role: ${output.role}`);
    console.log(`Root: ${path.relative(resolved.repoRoot, output.worldRoot) || '.'}`);
    console.log(`Output: ${path.relative(resolved.repoRoot, output.compiledOutputPath)}`);
    console.log(`Profiles: ${profileSummaries.map((p) => p.id).join(', ') || '(none)'}`);
    console.log(`Validators: ${output.validationProfiles.join(', ')}`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
