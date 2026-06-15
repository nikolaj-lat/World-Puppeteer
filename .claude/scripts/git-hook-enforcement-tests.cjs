#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const verifier = path.join(
  repoRoot,
  '.claude',
  'scripts',
  'verify-changed-paths.cjs'
);

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ...(options.env || {}),
    },
  });
}

function mustSucceed(result, label) {
  assert.strictEqual(
    result.status,
    0,
    `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  );
}

const npmProbe = run(
  process.execPath,
  [verifier],
  {
    cwd: repoRoot,
    env: {
      WORLD_PUPPETEER_NPM_PROBE: '1',
      WORLD_PUPPETEER_NPM_PROBE_REPO: repoRoot,
    },
  }
);
mustSucceed(
  npmProbe,
  'cross-platform npm launcher probe'
);
assert.match(
  npmProbe.stdout,
  /npm launcher probe passed:/i
);

const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'wp-git-hook-tests-')
);

try {
  mustSucceed(
    run('git', ['init', '--initial-branch=main'], {
      cwd: tempRoot,
    }),
    'git init'
  );
  mustSucceed(
    run(
      'git',
      ['config', 'user.name', 'World Puppeteer Tests'],
      { cwd: tempRoot }
    ),
    'git user.name'
  );
  mustSucceed(
    run(
      'git',
      ['config', 'user.email', 'tests@example.invalid'],
      { cwd: tempRoot }
    ),
    'git user.email'
  );

  const worldRoot = path.join(tempRoot, 'world');
  const marker = {
    schemaVersion: 1,
    id: 'hook-test-world',
    name: 'Hook Test World',
    role: 'editable',
    format: 'voyage-v33',
    paths: {
      tabs: 'tabs',
      compiledOutput: 'world.json',
      instructions: 'AGENTS.override.md',
    },
    toolchain: {
      formatProfile: 'voyage-json-tabs',
      buildProfile: 'world-build-cjs',
      validationProfiles: [
        'voyage-local-validator',
      ],
    },
    activeProfiles: [],
  };

  writeJson(
    path.join(worldRoot, '.world-puppeteer.json'),
    marker
  );
  writeJson(
    path.join(worldRoot, 'tabs', 'data.json'),
    {}
  );
  fs.writeFileSync(
    path.join(tempRoot, 'README.md'),
    'baseline\n',
    'utf8'
  );

  mustSucceed(
    run('git', ['add', '.'], { cwd: tempRoot }),
    'stage baseline'
  );
  mustSucceed(
    run('git', ['commit', '-m', 'baseline'], {
      cwd: tempRoot,
    }),
    'commit baseline'
  );

  const baseline = run(
    'git',
    ['rev-parse', 'HEAD'],
    { cwd: tempRoot }
  );
  mustSucceed(baseline, 'read baseline sha');
  const baselineSha = baseline.stdout.trim();

  fs.writeFileSync(
    path.join(worldRoot, 'tabs', 'data.json'),
    '{',
    'utf8'
  );
  mustSucceed(
    run(
      'git',
      ['add', 'world/tabs/data.json'],
      { cwd: tempRoot }
    ),
    'stage invalid JSON'
  );

  const preCommit = run(
    process.execPath,
    [
      verifier,
      '--mode',
      'pre-commit',
      '--repo',
      tempRoot,
    ],
    { cwd: repoRoot }
  );
  assert.notStrictEqual(
    preCommit.status,
    0,
    'pre-commit verification should block invalid JSON'
  );
  assert.match(
    `${preCommit.stdout}\n${preCommit.stderr}`,
    /JSON parse errors/i
  );

  mustSucceed(
    run(
      'git',
      ['commit', '--no-verify', '-m', 'invalid'],
      { cwd: tempRoot }
    ),
    'commit invalid fixture'
  );

  const invalidHead = run(
    'git',
    ['rev-parse', 'HEAD'],
    { cwd: tempRoot }
  );
  mustSucceed(invalidHead, 'read invalid sha');
  const invalidSha = invalidHead.stdout.trim();

  const pushInput =
    `refs/heads/main ${invalidSha} ` +
    `refs/heads/main ${baselineSha}\n`;

  const prePush = run(
    process.execPath,
    [
      verifier,
      '--mode',
      'pre-push',
      '--repo',
      tempRoot,
    ],
    {
      cwd: repoRoot,
      input: pushInput,
    }
  );
  assert.notStrictEqual(
    prePush.status,
    0,
    'pre-push verification should block invalid JSON'
  );
  assert.match(
    `${prePush.stdout}\n${prePush.stderr}`,
    /JSON parse errors/i
  );

  mustSucceed(
    run(
      'git',
      ['reset', '--hard', baselineSha],
      { cwd: tempRoot }
    ),
    'restore baseline'
  );

  fs.writeFileSync(
    path.join(tempRoot, 'README.md'),
    'unrelated change\n',
    'utf8'
  );
  mustSucceed(
    run(
      'git',
      ['add', 'README.md'],
      { cwd: tempRoot }
    ),
    'stage unrelated change'
  );

  const unrelated = run(
    process.execPath,
    [
      verifier,
      '--mode',
      'pre-commit',
      '--repo',
      tempRoot,
    ],
    { cwd: repoRoot }
  );
  mustSucceed(
    unrelated,
    'unrelated staged change should pass'
  );

  for (const hookName of ['pre-commit', 'pre-push']) {
    const hookPath = path.join(
      repoRoot,
      '.githooks',
      hookName
    );
    assert.ok(
      fs.existsSync(hookPath),
      `${hookName} hook is missing`
    );
    const text = fs.readFileSync(hookPath, 'utf8');
    assert.match(text, /^#!\/bin\/sh/);
    assert.match(
      text,
      /verify-changed-paths\.cjs/
    );
  }

  console.log('Git hook enforcement tests passed');
} finally {
  fs.rmSync(tempRoot, {
    recursive: true,
    force: true,
  });
}