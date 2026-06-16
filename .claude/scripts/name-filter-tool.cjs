const fs = require('fs');
const path = require('path');
const { parseStrictArgs } = require('./cli-utils.cjs');
const {
  resolveWorld,
  runConfiguredBuild,
  runTransactionalFileMutation,
} = require('./world-puppeteer-lib.cjs');
const DEFAULT_FILTERS = require('./name-filter-settings.data.json');

const MOD_ATTRIBUTION = Object.freeze({ shortId: '0bt3nPRLuqvh', version: 13 });

function usage(invocationPath) {
  return [
    'Usage:',
    `  node ${invocationPath} --world <world-root>`,
    '',
    'The --world flag may be omitted only when the current working directory',
    'resolves unambiguously to an editable world marker.',
  ].join('\n');
}

function parseArgs(argv) {
  const { options } = parseStrictArgs(argv, {
    options: {
      '--world': { key: 'worldRoot', takesValue: true },
      '--help': { key: 'help', aliases: ['-h'] },
    },
    maxPositionals: 0,
  });

  return options;
}

function planNameFilterMutation(world, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const metaPath = path.join(world.tabsPath, 'meta.json');
  if (!fsImpl.existsSync(metaPath)) {
    throw new Error(`Target world has no meta tab: ${metaPath}`);
  }

  const originalText = fsImpl.readFileSync(metaPath, 'utf8');
  const meta = JSON.parse(originalText);
  const existingCount =
    meta.nameFilterSettings && typeof meta.nameFilterSettings === 'object'
      ? Object.keys(meta.nameFilterSettings).length
      : 0;

  if (existingCount > 0) {
    return {
      metaPath,
      originalText,
      existingCount,
      skip: true,
    };
  }

  meta.nameFilterSettings = DEFAULT_FILTERS;
  meta.mods = Array.isArray(meta.mods) ? meta.mods : [];
  if (!meta.mods.some((entry) => entry.shortId === MOD_ATTRIBUTION.shortId)) {
    meta.mods.push(MOD_ATTRIBUTION);
  }

  return {
    metaPath,
    originalText,
    existingCount: 0,
    skip: false,
    nextText: JSON.stringify(meta, null, 2) + '\n',
    entryCount: Object.keys(DEFAULT_FILTERS).length,
  };
}

function buildFailureDetail(build) {
  return (
    build.stderr ||
    build.stdout ||
    build.error?.message ||
    'Unknown configured build failure'
  );
}

function runNameFilterCommand(options = {}) {
  const {
    argv = process.argv.slice(2),
    cwd = process.cwd(),
    invocationPath,
    fsImpl = fs,
    resolveWorldImpl = resolveWorld,
    runConfiguredBuildImpl = runConfiguredBuild,
  } = options;

  const parsed = parseArgs(argv);
  if (parsed.help) {
    console.log(usage(invocationPath));
    return 0;
  }

  const world = resolveWorldImpl({
    cwd,
    worldRoot: parsed.worldRoot || undefined,
    preferNearest: true,
  });

  if (world.marker.role !== 'editable') {
    throw new Error(
      `Refusing to modify world "${world.marker.id}" because role=${world.marker.role}; ` +
        'name-filter injection requires an editable world.'
    );
  }

  const plan = planNameFilterMutation(world, { fsImpl });
  if (plan.skip) {
    console.log(
      `nameFilterSettings already exists with ${plan.existingCount} entries. Skipping.`
    );
    return 0;
  }

  runTransactionalFileMutation(
    [{ path: plan.metaPath, content: plan.nextText }],
    () => {
      const build = runConfiguredBuildImpl(world);
      if (build.status !== 0 || build.error) {
        throw new Error(`Configured build failed: ${buildFailureDetail(build)}`);
      }
    },
    { fs: fsImpl }
  );

  console.log(
    `Injected ${plan.entryCount} name filter entries into ` +
      `${path.relative(world.repoRoot, plan.metaPath)} and rebuilt ` +
      `${path.relative(world.repoRoot, world.compiledOutputPath)}.`
  );
  return 0;
}

function runNameFilterCli(options = {}) {
  try {
    process.exitCode = runNameFilterCommand(options);
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_FILTERS,
  MOD_ATTRIBUTION,
  parseArgs,
  planNameFilterMutation,
  runNameFilterCli,
  runNameFilterCommand,
  usage,
};
