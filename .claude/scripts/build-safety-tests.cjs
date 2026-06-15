#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  acquireBuildLock,
  buildLockPath,
  buildWorldSource,
  releaseBuildLock,
} = require('./world-puppeteer-lib.cjs');

const failures = [];
const fixtureRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'world-puppeteer-build-safety-')
);

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertThrows(fn, matcher, message) {
  try {
    fn();
    failures.push(`${message}: expected error`);
  } catch (error) {
    assert(matcher.test(error.message), `${message}: ${error.message}`);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function minimalConfig(label) {
  return {
    configVersion: 'V33',
    heroesVersion: '1.0.0',
    storySettings: { worldBackground: label },
    aiInstructions: {},
  };
}

function createWorld(name, initialOutput = '{"prior":true}\n') {
  const root = path.join(fixtureRoot, name);
  const tabsPath = path.join(root, 'tabs');
  const compiledOutputPath = path.join(root, `${name}.json`);
  writeJson(path.join(tabsPath, 'world.json'), minimalConfig(name));
  fs.writeFileSync(compiledOutputPath, initialOutput);

  return {
    repoRoot: path.resolve(__dirname, '../..'),
    worldRoot: root,
    tabsPath,
    compiledOutputPath,
    marker: {
      toolchain: {
        validationProfiles: ['voyage-local-validator'],
      },
    },
  };
}

const passingRunner = () => ({
  status: 0,
  stdout: '{"errors":[],"warnings":[]}',
  stderr: '',
});
const failingRunner = () => ({
  status: 1,
  stdout: '{"errors":[{"path":"fixture","message":"invalid"}],"warnings":[]}',
  stderr: '',
});

function tempArtifacts(world) {
  return fs.readdirSync(world.worldRoot).filter((name) =>
    name.startsWith('.world-puppeteer-build-')
  );
}

try {
  {
    const world = createWorld('live-lock');
    const lock = acquireBuildLock(world.compiledOutputPath);
    assertThrows(
      () => buildWorldSource(world, {
        runner: passingRunner,
        noBackup: true,
      }),
      /Build already in progress/,
      'live build lock must block a concurrent build'
    );
    assert(
      fs.readFileSync(world.compiledOutputPath, 'utf8') === '{"prior":true}\n',
      'live-lock contention must not alter compiled output'
    );
    releaseBuildLock(lock);
    assert(
      !fs.existsSync(buildLockPath(world.compiledOutputPath)),
      'released live lock must be removed'
    );
  }

  {
    const world = createWorld('failed-validation');
    assertThrows(
      () => buildWorldSource(world, { runner: failingRunner }),
      /Compiled candidate failed/,
      'validation failure must abort build'
    );
    assert(
      !fs.existsSync(buildLockPath(world.compiledOutputPath)),
      'validation failure must release build lock'
    );
    assert(
      tempArtifacts(world).length === 0,
      'validation failure must remove candidate temp file'
    );
    assert(
      fs.readFileSync(world.compiledOutputPath, 'utf8') === '{"prior":true}\n',
      'validation failure must preserve output byte-for-byte'
    );
  }

  {
    const world = createWorld('backup-failure');
    assertThrows(
      () => buildWorldSource(world, {
        runner: passingRunner,
        createBuildBackup() {
          throw new Error('simulated backup failure');
        },
      }),
      /simulated backup failure/,
      'backup failure must abort build'
    );
    assert(
      !fs.existsSync(buildLockPath(world.compiledOutputPath)),
      'backup failure must release build lock'
    );
    assert(
      tempArtifacts(world).length === 0,
      'backup failure must remove candidate temp file'
    );
    assert(
      fs.readFileSync(world.compiledOutputPath, 'utf8') === '{"prior":true}\n',
      'backup failure must preserve output byte-for-byte'
    );
  }

  {
    const world = createWorld('replace-failure');
    assertThrows(
      () => buildWorldSource(world, {
        runner: passingRunner,
        noBackup: true,
        atomicReplaceFile() {
          throw new Error('simulated replace failure');
        },
      }),
      /simulated replace failure/,
      'replace failure must abort build'
    );
    assert(
      !fs.existsSync(buildLockPath(world.compiledOutputPath)),
      'replace failure must release build lock'
    );
    assert(
      tempArtifacts(world).length === 0,
      'replace failure must remove candidate temp file'
    );
    assert(
      fs.readFileSync(world.compiledOutputPath, 'utf8') === '{"prior":true}\n',
      'replace failure must preserve output byte-for-byte'
    );
  }

  {
    const world = createWorld('dead-owner-lock');
    const lockPath = buildLockPath(world.compiledOutputPath);
    fs.writeFileSync(
      lockPath,
      JSON.stringify({
        schemaVersion: 1,
        pid: 2147483647,
        token: 'dead-owner',
        startedAt: '2000-01-01T00:00:00.000Z',
      }) + '\n'
    );

    buildWorldSource(world, {
      runner: passingRunner,
      noBackup: true,
    });

    assert(
      !fs.existsSync(lockPath),
      'dead-owner lock must be reclaimed and removed after build'
    );
    assert(
      JSON.parse(fs.readFileSync(world.compiledOutputPath, 'utf8'))
        .storySettings.worldBackground === 'dead-owner-lock',
      'build must succeed after reclaiming dead-owner lock'
    );
  }

  {
    const world = createWorld('malformed-stale-lock');
    const lockPath = buildLockPath(world.compiledOutputPath);
    fs.writeFileSync(lockPath, '{ malformed lock');
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(lockPath, old, old);

    buildWorldSource(world, {
      runner: passingRunner,
      noBackup: true,
      lockStaleMs: 1_000,
    });

    assert(
      !fs.existsSync(lockPath),
      'stale malformed lock must be reclaimed'
    );
  }

  {
    const world = createWorld('malformed-fresh-lock');
    const lockPath = buildLockPath(world.compiledOutputPath);
    fs.writeFileSync(lockPath, '{ malformed lock');

    assertThrows(
      () => buildWorldSource(world, {
        runner: passingRunner,
        noBackup: true,
        lockStaleMs: 60_000,
      }),
      /Build already in progress/,
      'fresh malformed lock must fail closed'
    );
    fs.rmSync(lockPath, { force: true });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log('build safety tests passed');
