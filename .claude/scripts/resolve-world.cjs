#!/usr/bin/env node

const path = require('path');
const { parseStrictArgs } = require('./cli-utils.cjs');
const { resolveWorld } = require('./world-puppeteer-lib.cjs');

function main() {
  const { options } = parseStrictArgs(
    process.argv.slice(2),
    {
      options: {
        '--world': { key: 'worldRoot', takesValue: true },
        '--cwd': { key: 'cwd', takesValue: true },
        '--json': { key: 'json' },
        '--help': { key: 'help', aliases: ['-h'] },
      },
      maxPositionals: 0,
    }
  );

  if (options.help) {
    console.log(
      'Usage: node .claude/scripts/resolve-world.cjs ' +
      '[--world <world-root>] [--cwd <directory>] [--json]'
    );
    return;
  }

  const resolved = resolveWorld({
    worldRoot: options.worldRoot,
    cwd: options.cwd || process.cwd(),
    preferNearest: !options.worldRoot,
  });
  const profileSummaries = resolved.activeProfiles.map(
    ({ profilePath, profile }) => ({
      id: profile.id,
      path: path.relative(resolved.repoRoot, profilePath),
      skills: profile.skills,
      appliesTo: profile.appliesTo,
      required: profile.required,
    })
  );
  const output = {
    repoRoot: resolved.repoRoot,
    worldRoot: resolved.worldRoot,
    role: resolved.marker.role,
    worldRole: resolved.marker.role,
    id: resolved.marker.id,
    name: resolved.marker.name,
    format: resolved.marker.format,
    tabsPath: resolved.tabsPath,
    compiledOutputPath: resolved.compiledOutputPath,
    instructionsPath: resolved.instructionsPath,
    activeProfiles: profileSummaries,
    validationProfiles: resolved.marker.toolchain.validationProfiles,
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`Resolved world: ${output.name}`);
    console.log(`Role: ${output.role}`);
    console.log(
      `Root: ${path.relative(resolved.repoRoot, output.worldRoot) || '.'}`
    );
    console.log(
      `Output: ${path.relative(resolved.repoRoot, output.compiledOutputPath)}`
    );
    console.log(
      `Tabs: ${path.relative(resolved.repoRoot, output.tabsPath)}`
    );
    console.log(
      `Profiles: ${profileSummaries.map((profile) => profile.id).join(', ') || '(none)'}`
    );
    console.log(`Validators: ${output.validationProfiles.join(', ')}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
