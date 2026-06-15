#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ZERO_SHA_RE = /^0+$/;
const EMPTY_TREE_SHA =
  '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'config-backups',
  '.hook-smoke-world',
]);

function fail(message) {
  console.error(`Changed-path verification failed: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const result = {
    mode: null,
    repo: null,
    paths: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--mode') {
      if (result.mode !== null) {
        fail('duplicate --mode option');
      }
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        fail('--mode requires a value');
      }
      result.mode = value;
      index += 1;
      continue;
    }

    if (token === '--repo') {
      if (result.repo !== null) {
        fail('duplicate --repo option');
      }
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        fail('--repo requires a value');
      }
      result.repo = value;
      index += 1;
      continue;
    }

    if (token === '--path') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        fail('--path requires a value');
      }
      result.paths.push(value);
      index += 1;
      continue;
    }

    if (token === '--help') {
      console.log(
        'Usage: verify-changed-paths.cjs ' +
        '--mode <pre-commit|pre-push|explicit> ' +
        '[--repo <path>] [--path <path> ...]'
      );
      process.exit(0);
    }

    fail(`unknown option: ${token}`);
  }

  if (
    !['pre-commit', 'pre-push', 'explicit'].includes(result.mode)
  ) {
    fail(
      '--mode must be pre-commit, pre-push, or explicit'
    );
  }

  if (
    result.mode !== 'explicit' &&
    result.paths.length > 0
  ) {
    fail('--path is only valid with --mode explicit');
  }

  if (
    result.mode === 'explicit' &&
    result.paths.length === 0
  ) {
    fail('--mode explicit requires at least one --path');
  }

  return result;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: 'utf8',
    stdio: options.capture === false
      ? ['inherit', 'inherit', 'inherit']
      : ['pipe', 'pipe', 'pipe'],
    shell: false,
    timeout: options.timeout || 300_000,
    env: process.env,
  });

  if (result.error) {
    fail(
      `${command} could not run: ${result.error.message}`
    );
  }

  return result;
}

function git(repoRoot, args, options = {}) {
  return run(
    'git',
    ['-C', repoRoot, ...args],
    options
  );
}

function requireGitSuccess(result, description) {
  if (result.status !== 0) {
    const detail =
      result.stderr ||
      result.stdout ||
      `exit code ${result.status}`;
    fail(`${description}: ${detail.trim()}`);
  }
}

function resolveRepoRoot(candidate) {
  if (candidate) {
    const resolved = path.resolve(candidate);
    if (!fs.existsSync(resolved)) {
      fail(`repository path does not exist: ${resolved}`);
    }
    return resolved;
  }

  const result = run(
    'git',
    ['rev-parse', '--show-toplevel'],
    { cwd: process.cwd() }
  );
  requireGitSuccess(result, 'could not resolve repository root');
  return path.resolve(result.stdout.trim());
}

function splitNull(text) {
  return String(text || '')
    .split('\0')
    .filter(Boolean);
}

function changedPathsForPreCommit(repoRoot) {
  const result = git(
    repoRoot,
    [
      'diff',
      '--cached',
      '--name-only',
      '--diff-filter=ACMRD',
      '-z',
    ]
  );
  requireGitSuccess(result, 'could not read staged paths');
  return splitNull(result.stdout);
}

function changedPathsForRange(repoRoot, base, head) {
  const result = git(
    repoRoot,
    [
      'diff',
      '--name-only',
      '--diff-filter=ACMRD',
      '-z',
      base,
      head,
    ]
  );
  requireGitSuccess(
    result,
    `could not compare ${base}..${head}`
  );
  return splitNull(result.stdout);
}

function changedPathsForPrePush(repoRoot) {
  const input = fs.readFileSync(0, 'utf8');
  const paths = [];

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    if (parts.length !== 4) {
      fail(
        `malformed pre-push input line: ${JSON.stringify(line)}`
      );
    }

    const [, localSha, , remoteSha] = parts;
    if (ZERO_SHA_RE.test(localSha)) {
      continue;
    }

    const base = ZERO_SHA_RE.test(remoteSha)
      ? EMPTY_TREE_SHA
      : remoteSha;

    paths.push(
      ...changedPathsForRange(repoRoot, base, localSha)
    );
  }

  return paths;
}

function normalizeRelative(repoRoot, candidate) {
  const absolute = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(repoRoot, candidate);
  const relative = path.relative(repoRoot, absolute);

  if (
    relative === '' ||
    relative.startsWith(`..${path.sep}`) ||
    relative === '..' ||
    path.isAbsolute(relative)
  ) {
    fail(`changed path is outside repository: ${candidate}`);
  }

  return relative.split(path.sep).join('/');
}

function unique(values) {
  return [...new Set(values)];
}

function isInside(candidate, directory) {
  const relative = path.relative(
    path.resolve(directory),
    path.resolve(candidate)
  );
  return (
    relative === '' ||
    (
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

function samePath(left, right) {
  return path.resolve(left) === path.resolve(right);
}

function walkForMarkers(root) {
  const markers = [];

  function visit(directory) {
    let entries;
    try {
      entries = fs.readdirSync(
        directory,
        { withFileTypes: true }
      );
    } catch (error) {
      fail(
        `could not scan ${directory}: ${error.message}`
      );
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        visit(path.join(directory, entry.name));
        continue;
      }

      if (
        entry.isFile() &&
        entry.name === '.world-puppeteer.json'
      ) {
        markers.push(path.join(directory, entry.name));
      }
    }
  }

  visit(root);
  return markers;
}

function loadWorlds(repoRoot) {
  return walkForMarkers(repoRoot)
    .map((markerPath) => {
      let marker;
      try {
        marker = JSON.parse(
          fs.readFileSync(markerPath, 'utf8')
        );
      } catch (error) {
        fail(
          `invalid marker ${path.relative(
            repoRoot,
            markerPath
          )}: ${error.message}`
        );
      }

      if (!marker.paths || typeof marker.paths !== 'object') {
        fail(
          `marker has no paths object: ${path.relative(
            repoRoot,
            markerPath
          )}`
        );
      }

      const root = path.dirname(markerPath);
      return {
        root,
        markerPath,
        marker,
        tabsPath: path.resolve(
          root,
          marker.paths.tabs || 'tabs'
        ),
        compiledOutputPath: path.resolve(
          root,
          marker.paths.compiledOutput || 'config.json'
        ),
        instructionsPath: path.resolve(
          root,
          marker.paths.instructions || 'AGENTS.override.md'
        ),
      };
    })
    .sort((left, right) =>
      right.root.length - left.root.length
    );
}

function classifyPaths(repoRoot, relativePaths, worlds) {
  const affected = new Map();
  let repositoryTooling = false;

  const toolingRoots = [
    '.agents',
    '.claude',
    '.codex',
    '.githooks',
    '.world-puppeteer',
  ].map((relative) => path.join(repoRoot, relative));

  const toolingFiles = new Set([
    'AGENTS.md',
    'CLAUDE.md',
    'package.json',
    'package-lock.json',
  ]);

  for (const relative of relativePaths) {
    const absolute = path.resolve(repoRoot, relative);

    if (
      toolingRoots.some((root) => isInside(absolute, root)) ||
      toolingFiles.has(relative)
    ) {
      repositoryTooling = true;
    }

    if (
      relative.endsWith('/.world-puppeteer.json') &&
      !fs.existsSync(absolute)
    ) {
      fail(
        `deleted world marker requires explicit manual review: ${relative}`
      );
    }

    for (const world of worlds) {
      let category = null;

      if (isInside(absolute, world.tabsPath)) {
        category = 'tabs';
      } else if (samePath(absolute, world.compiledOutputPath)) {
        category = 'compiled';
      } else if (
        samePath(absolute, world.markerPath) ||
        samePath(absolute, world.instructionsPath)
      ) {
        category = 'metadata';
      } else {
        const metadataRoots = [
          path.join(world.root, '.world-puppeteer'),
          path.join(world.root, '.agents', 'skills'),
          path.join(world.root, '.claude', 'skills'),
        ];
        if (
          metadataRoots.some((root) =>
            isInside(absolute, root)
          )
        ) {
          category = 'metadata';
        }
      }

      if (!category) continue;

      const existing = affected.get(world.root) || {
        world,
        categories: new Set(),
      };
      existing.categories.add(category);
      affected.set(world.root, existing);
      break;
    }
  }

  return {
    affected: [...affected.values()],
    repositoryTooling,
  };
}

function dirtyPaths(repoRoot, mode) {
  const commands = mode === 'pre-commit'
    ? [
        ['diff', '--name-only', '--diff-filter=ACMRD', '-z'],
      ]
    : [
        ['diff', '--name-only', '--diff-filter=ACMRD', '-z'],
        [
          'diff',
          '--cached',
          '--name-only',
          '--diff-filter=ACMRD',
          '-z',
        ],
      ];

  const paths = [];
  for (const args of commands) {
    const result = git(repoRoot, args);
    requireGitSuccess(result, 'could not inspect dirty paths');
    paths.push(...splitNull(result.stdout));
  }
  return unique(paths);
}

function assertNoSnapshotMismatch(
  repoRoot,
  mode,
  relevantPaths
) {
  if (mode === 'explicit') return;

  const dirty = new Set(
    dirtyPaths(repoRoot, mode).map((candidate) =>
      normalizeRelative(repoRoot, candidate)
    )
  );

  const overlap = relevantPaths.filter((candidate) =>
    dirty.has(candidate)
  );

  if (overlap.length > 0) {
    fail(
      `${
        mode === 'pre-commit'
          ? 'staged paths also have unstaged changes'
          : 'pushed paths differ from the current working tree'
      }:\n${overlap.map((pathValue) =>
        `- ${pathValue}`
      ).join('\n')}`
    );
  }
}

function jsonFilesUnder(directory) {
  const files = [];

  function visit(current) {
    let entries;
    try {
      entries = fs.readdirSync(
        current,
        { withFileTypes: true }
      );
    } catch (error) {
      fail(
        `could not read tabs directory ${current}: ${error.message}`
      );
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (
        entry.isFile() &&
        entry.name.toLowerCase().endsWith('.json')
      ) {
        files.push(full);
      }
    }
  }

  if (!fs.existsSync(directory)) {
    fail(`tabs directory does not exist: ${directory}`);
  }

  visit(directory);
  return files.sort();
}

function parseWorldTabs(repoRoot, world) {
  const errors = [];

  for (const file of jsonFilesUnder(world.tabsPath)) {
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      errors.push(
        `${path.relative(repoRoot, file)}: ${error.message}`
      );
    }
  }

  if (errors.length > 0) {
    fail(`JSON parse errors:\n${errors.map((error) =>
      `- ${error}`
    ).join('\n')}`);
  }
}

function runVisible(command, args, repoRoot, description) {
  console.log(`\n=== ${description} ===`);
  const result = run(
    command,
    args,
    {
      cwd: repoRoot,
      capture: false,
      timeout: 600_000,
    }
  );
  if (result.status !== 0) {
    fail(`${description} exited ${result.status}`);
  }
}

function npmInvocation(args) {
  if (process.platform !== 'win32') {
    return {
      command: 'npm',
      args,
    };
  }

  const candidates = [
    process.env.npm_execpath,
    path.join(
      path.dirname(process.execPath),
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js'
    ),
  ].filter(Boolean);

  const npmCli = candidates.find((candidate) =>
    fs.existsSync(candidate)
  );

  if (!npmCli) {
    fail(
      'could not locate npm-cli.js beside the active Node executable'
    );
  }

  return {
    command: process.execPath,
    args: [npmCli, ...args],
  };
}

function runNpmVisible(args, repoRoot, description) {
  const invocation = npmInvocation(args);
  runVisible(
    invocation.command,
    invocation.args,
    repoRoot,
    description
  );
}

function probeNpmLauncher(repoRoot) {
  const invocation = npmInvocation(['--version']);
  const result = run(
    invocation.command,
    invocation.args,
    {
      cwd: repoRoot,
      timeout: 120_000,
    }
  );

  if (result.status !== 0) {
    const detail =
      result.stderr ||
      result.stdout ||
      `exit code ${result.status}`;
    fail(`npm launcher probe failed: ${detail.trim()}`);
  }

  console.log(
    `npm launcher probe passed: ${result.stdout.trim()}`
  );
}

function isTracked(repoRoot, relative) {
  const result = git(
    repoRoot,
    ['ls-files', '--error-unmatch', '--', relative]
  );
  return result.status === 0;
}

function verifyGeneratedOutput(
  repoRoot,
  world,
  mode
) {
  if (mode === 'explicit') return;

  const relative = path
    .relative(repoRoot, world.compiledOutputPath)
    .split(path.sep)
    .join('/');

  if (!isTracked(repoRoot, relative)) {
    return;
  }

  const args = mode === 'pre-commit'
    ? ['diff', '--quiet', '--', relative]
    : ['diff', '--quiet', 'HEAD', '--', relative];

  const result = git(repoRoot, args);
  if (result.status === 1) {
    fail(
      `generated output is not synchronized with the verified ` +
      `world state: ${relative}`
    );
  }
  requireGitSuccess(
    result,
    `could not compare generated output ${relative}`
  );
}

function verifyWorld(repoRoot, entry, mode) {
  const world = entry.world;
  const relativeRoot =
    path.relative(repoRoot, world.root) || '.';

  parseWorldTabs(repoRoot, world);

  const buildScript = path.join(
    repoRoot,
    '.claude',
    'scripts',
    'build-world.cjs'
  );
  const validateScript = path.join(
    repoRoot,
    '.claude',
    'scripts',
    'validate.js'
  );

  if (!fs.existsSync(buildScript)) {
    fail(
      `build script is missing for affected world ${relativeRoot}`
    );
  }
  if (!fs.existsSync(validateScript)) {
    fail(
      `validation script is missing for affected world ${relativeRoot}`
    );
  }

  runVisible(
    process.execPath,
    [
      buildScript,
      '--world',
      world.root,
      '--no-backup',
    ],
    repoRoot,
    `build ${relativeRoot}`
  );

  runVisible(
    process.execPath,
    [
      validateScript,
      '--world',
      world.root,
      '--json',
    ],
    repoRoot,
    `validate ${relativeRoot}`
  );

  verifyGeneratedOutput(repoRoot, world, mode);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot(args.repo);

  let rawPaths;
  if (args.mode === 'pre-commit') {
    rawPaths = changedPathsForPreCommit(repoRoot);
  } else if (args.mode === 'pre-push') {
    rawPaths = changedPathsForPrePush(repoRoot);
  } else {
    rawPaths = args.paths;
  }

  const relativePaths = unique(
    rawPaths.map((candidate) =>
      normalizeRelative(repoRoot, candidate)
    )
  );

  if (relativePaths.length === 0) {
    console.log('Changed-path verification: no changed paths.');
    return;
  }

  const worlds = loadWorlds(repoRoot);
  const routes = classifyPaths(
    repoRoot,
    relativePaths,
    worlds
  );

  const relevant = new Set();
  for (const entry of routes.affected) {
    for (const relative of relativePaths) {
      const absolute = path.resolve(repoRoot, relative);
      if (
        isInside(absolute, entry.world.root)
      ) {
        relevant.add(relative);
      }
    }
  }
  if (routes.repositoryTooling) {
    for (const relative of relativePaths) {
      const absolute = path.resolve(repoRoot, relative);
      if (
        [
          '.agents',
          '.claude',
          '.codex',
          '.githooks',
          '.world-puppeteer',
        ].some((root) =>
          isInside(
            absolute,
            path.join(repoRoot, root)
          )
        ) ||
        [
          'AGENTS.md',
          'CLAUDE.md',
          'package.json',
          'package-lock.json',
        ].includes(relative)
      ) {
        relevant.add(relative);
      }
    }
  }

  assertNoSnapshotMismatch(
    repoRoot,
    args.mode,
    [...relevant]
  );

  for (const entry of routes.affected) {
    if (
      entry.categories.has('tabs') ||
      entry.categories.has('compiled')
    ) {
      verifyWorld(repoRoot, entry, args.mode);
    }
  }

  const metadataChanged = routes.affected.some((entry) =>
    entry.categories.has('metadata')
  );

  if (routes.repositoryTooling) {
    runNpmVisible(
      ['test'],
      repoRoot,
      'tooling tests'
    );
    runNpmVisible(
      ['run', 'test:reference-packs'],
      repoRoot,
      'reference-pack tests'
    );
    runNpmVisible(
      ['run', 'validate:metadata'],
      repoRoot,
      'metadata validation'
    );
  } else if (metadataChanged) {
    runNpmVisible(
      ['run', 'validate:metadata'],
      repoRoot,
      'metadata validation'
    );
  }

  console.log(
    `\nChanged-path verification passed for ` +
    `${relativePaths.length} changed path(s).`
  );
}

if (process.env.WORLD_PUPPETEER_NPM_PROBE === '1') {
  const probeRepo = resolveRepoRoot(
    process.env.WORLD_PUPPETEER_NPM_PROBE_REPO || null
  );
  probeNpmLauncher(probeRepo);
} else {
  main();
}