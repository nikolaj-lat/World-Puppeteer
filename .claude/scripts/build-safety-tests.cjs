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
const skipped = [];
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

function createWorld(name, initialOutput = '{"prior":true}\n', options = {}) {
  const root = path.join(fixtureRoot, name);
  const tabsPath = path.join(root, 'tabs');
  const compiledOutputPath = path.join(
    root,
    ...(options.compiledOutputRelative || `${name}.json`).split(/[\\/]+/)
  );
  writeJson(path.join(tabsPath, 'world.json'), minimalConfig(name));
  fs.mkdirSync(path.dirname(compiledOutputPath), { recursive: true });
  if (initialOutput !== null) {
    fs.writeFileSync(compiledOutputPath, initialOutput);
  }

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

function backupDir(world) {
  return path.join(path.dirname(world.compiledOutputPath), 'config-backups');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function recognizedBackupPattern(world) {
  const parsed = path.parse(world.compiledOutputPath);
  return new RegExp(
    `^${escapeRegExp(parsed.name)}-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z-\\d+-[0-9a-f]+${escapeRegExp(parsed.ext)}$`
  );
}

function backupEntries(world) {
  if (!fs.existsSync(backupDir(world))) return [];
  return fs.readdirSync(backupDir(world)).sort((left, right) => left.localeCompare(right));
}

function recognizedBackupFiles(world) {
  const pattern = recognizedBackupPattern(world);
  return backupEntries(world).filter((entry) => pattern.test(entry));
}

function recognizedBackupPath(world, isoValue, unique) {
  const parsed = path.parse(world.compiledOutputPath);
  const stamp = isoValue.replace(/[:.]/g, '-');
  return path.join(
    backupDir(world),
    `${parsed.name}-${stamp}-${unique}${parsed.ext}`
  );
}

function writeRecognizedBackup(world, isoValue, unique, content = '{}\n') {
  const filePath = recognizedBackupPath(world, isoValue, unique);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function deterministicBackupPath(world, isoValue, randomValue) {
  return recognizedBackupPath(
    world,
    isoValue,
    `${process.pid}-${randomValue.toString(16).slice(2)}`
  );
}

function withFrozenBackupIdentity(isoValue, randomValue, fn) {
  const RealDate = Date;
  const realRandom = Math.random;

  class FrozenDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(isoValue);
        return;
      }
      super(...args);
    }

    static now() {
      return new RealDate(isoValue).getTime();
    }

    static parse(value) {
      return RealDate.parse(value);
    }

    static UTC(...args) {
      return RealDate.UTC(...args);
    }
  }

  global.Date = FrozenDate;
  Math.random = () => randomValue;
  try {
    return fn();
  } finally {
    global.Date = RealDate;
    Math.random = realRandom;
  }
}

function createSymlinkOrSkip(targetPath, linkPath, type, label) {
  try {
    fs.symlinkSync(targetPath, linkPath, type);
    return { created: true, blocked: false };
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'ENOTSUP' || error.code === 'EINVAL' || error.code === 'UNKNOWN') {
      skipped.push(`${label}: ${error.message}`);
      return { created: false, blocked: true };
    }
    throw error;
  }
}

function seedRetentionBackups(world, count, options = {}) {
  const seeded = [];
  for (let index = 0; index < count; index += 1) {
    const timestamp = options.sameTimestamp
      ? '2024-01-01T00:00:00.000Z'
      : `2024-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`;
    const unique = options.sameTimestamp
      ? `${String(index + 1).padStart(2, '0')}-a`
      : `${index + 1}-a`;
    seeded.push(writeRecognizedBackup(world, timestamp, unique, `seed-${index}\n`));
  }
  return seeded;
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

  {
    const world = createWorld('contained-backup');
    assert(
      !fs.existsSync(backupDir(world)),
      'config-backups must start absent in the normal backup fixture'
    );
    const result = buildWorldSource(world, { runner: passingRunner });
    assert(
      result.backupPath && fs.existsSync(result.backupPath),
      'normal contained backup creation must succeed'
    );
    assert(
      path.dirname(result.backupPath) === backupDir(world),
      'backup directory must be derived from the compiled output location'
    );
  }

  {
    const world = createWorld('existing-backup-dir');
    fs.mkdirSync(backupDir(world), { recursive: true });
    fs.writeFileSync(path.join(backupDir(world), 'note.txt'), 'keep\n');
    const result = buildWorldSource(world, { runner: passingRunner });
    assert(
      result.backupPath && fs.existsSync(result.backupPath),
      'existing valid backup directory must still allow backup creation'
    );
    assert(
      fs.readFileSync(path.join(backupDir(world), 'note.txt'), 'utf8') === 'keep\n',
      'existing unrelated files in config-backups must remain untouched'
    );
  }

  {
    const world = createWorld('config-backups-file');
    fs.writeFileSync(backupDir(world), 'not a directory\n');
    assertThrows(
      () => buildWorldSource(world, { runner: passingRunner }),
      /config-backups: expected directory|config-backups: path component is not a directory/,
      'config-backups existing as a regular file must fail closed'
    );
    assert(
      fs.readFileSync(world.compiledOutputPath, 'utf8') === '{"prior":true}\n',
      'regular-file config-backups must preserve compiled output'
    );
  }

  {
    const world = createWorld('outside-world-root');
    const escapedOutput = path.join(fixtureRoot, 'escaped-output.json');
    fs.writeFileSync(escapedOutput, '{"prior":true}\n');
    const unsafeWorld = {
      ...world,
      compiledOutputPath: escapedOutput,
    };
    assertThrows(
      () => buildWorldSource(unsafeWorld, { runner: passingRunner }),
      /paths\.compiledOutput: traversal is not allowed|paths\.compiledOutput: absolute paths are not allowed/,
      'attempted backup containment outside the selected world root must fail'
    );
    assert(
      fs.readFileSync(escapedOutput, 'utf8') === '{"prior":true}\n',
      'outside-root compiled output must remain unchanged'
    );
  }

  {
    const world = createWorld('compiled-output-directory', null);
    fs.mkdirSync(world.compiledOutputPath, { recursive: true });
    assertThrows(
      () => buildWorldSource(world, { runner: passingRunner }),
      /paths\.compiledOutput: expected file/,
      'compiled output being a non-regular file must be rejected'
    );
  }

  {
    const world = createWorld('backup-destination-directory');
    const frozenIso = '2026-06-16T12:16:28.000Z';
    const frozenRandom = 0.5;
    const destination = deterministicBackupPath(world, frozenIso, frozenRandom);
    fs.mkdirSync(destination, { recursive: true });
    assertThrows(
      () => withFrozenBackupIdentity(frozenIso, frozenRandom, () =>
        buildWorldSource(world, { runner: passingRunner })
      ),
      /config-backups destination: expected file/,
      'existing unsafe destination path must be rejected'
    );
    assert(
      fs.readFileSync(world.compiledOutputPath, 'utf8') === '{"prior":true}\n',
      'unsafe backup destination must preserve compiled output'
    );
  }

  {
    const world = createWorld('retention-fewer-than-twenty');
    const seeded = seedRetentionBackups(world, 3);
    const unrelatedFile = path.join(backupDir(world), 'note.txt');
    const malformedFile = path.join(
      backupDir(world),
      `${path.parse(world.compiledOutputPath).name}-2024-01-01T00-00-00-000Z-bad-token${path.parse(world.compiledOutputPath).ext}`
    );
    const unrelatedDir = path.join(backupDir(world), 'archive');
    fs.writeFileSync(unrelatedFile, 'keep\n');
    fs.writeFileSync(malformedFile, 'keep malformed\n');
    fs.mkdirSync(unrelatedDir, { recursive: true });
    buildWorldSource(world, { runner: passingRunner });
    assert(
      recognizedBackupFiles(world).length === 4,
      'fewer than 20 recognized backups must not prune old backups'
    );
    for (const seededPath of seeded) {
      assert(fs.existsSync(seededPath), `seeded backup must remain: ${seededPath}`);
    }
    assert(fs.existsSync(unrelatedFile), 'unrelated files must remain untouched');
    assert(fs.existsSync(unrelatedDir), 'directories in config-backups must remain untouched');
    assert(fs.existsSync(malformedFile), 'malformed similarly named files must remain untouched');
  }

  {
    const world = createWorld('retention-exactly-twenty');
    const seeded = seedRetentionBackups(world, 19);
    buildWorldSource(world, { runner: passingRunner });
    assert(
      recognizedBackupFiles(world).length === 20,
      'exactly 20 recognized backups must cause no unintended pruning'
    );
    for (const seededPath of seeded) {
      assert(fs.existsSync(seededPath), `all 19 seeded backups must remain: ${seededPath}`);
    }
  }

  {
    const world = createWorld('retention-prunes-oldest');
    const seeded = seedRetentionBackups(world, 20);
    const result = buildWorldSource(world, { runner: passingRunner });
    assert(
      recognizedBackupFiles(world).length === 20,
      'creating backup 21 must retain only the newest 20 recognized backups'
    );
    assert(
      !fs.existsSync(seeded[0]),
      'older recognized backups must be removed first'
    );
    assert(
      fs.existsSync(result.backupPath),
      'the newly created backup must be retained'
    );
  }

  {
    const world = createWorld('retention-deterministic-order');
    const frozenIso = '2026-06-16T12:16:28.000Z';
    const frozenRandom = 0.5;
    const seeded = seedRetentionBackups(world, 20, { sameTimestamp: true });
    const result = withFrozenBackupIdentity(frozenIso, frozenRandom, () =>
      buildWorldSource(world, { runner: passingRunner })
    );
    const actualRecognized = recognizedBackupFiles(world).sort((left, right) => right.localeCompare(left));
    const expectedRecognized = [
      ...seeded.map((filePath) => path.basename(filePath)),
      path.basename(result.backupPath),
    ]
      .sort((left, right) => right.localeCompare(left))
      .slice(0, 20);
    if (!expectedRecognized.includes(path.basename(result.backupPath))) {
      expectedRecognized[expectedRecognized.length - 1] = path.basename(result.backupPath);
      expectedRecognized.sort((left, right) => right.localeCompare(left));
    }
    assert(
      JSON.stringify(actualRecognized) === JSON.stringify(expectedRecognized),
      'retention ordering must be deterministic when timestamps tie'
    );
  }

  {
    const world = createWorld('retention-pruning-failure');
    const seeded = seedRetentionBackups(world, 20);
    const originalRmSync = fs.rmSync;
    const doomedPath = seeded[0];
    let newBackupPath = null;

    fs.rmSync = function patchedRmSync(targetPath, options) {
      if (path.resolve(targetPath) === path.resolve(doomedPath)) {
        throw new Error('simulated prune failure');
      }
      return originalRmSync.call(this, targetPath, options);
    };

    try {
      assertThrows(
        () => {
          const result = buildWorldSource(world, { runner: passingRunner });
          newBackupPath = result.backupPath;
        },
        /Failed to prune old build backups.*simulated prune failure/,
        'a pruning failure must report a controlled error'
      );
    } finally {
      fs.rmSync = originalRmSync;
    }

    const latestBackup = recognizedBackupFiles(world)
      .map((entry) => path.join(backupDir(world), entry))
      .sort((left, right) => path.basename(right).localeCompare(path.basename(left)))[0];
    assert(
      (newBackupPath && fs.existsSync(newBackupPath)) || (latestBackup && fs.existsSync(latestBackup)),
      'a pruning failure must not remove the newly created backup'
    );
    assert(
      fs.readFileSync(world.compiledOutputPath, 'utf8') === '{"prior":true}\n',
      'a pruning failure must not alter the compiled output'
    );
  }

  {
    const world = createWorld('symlinked-backup-dir');
    const outside = path.join(fixtureRoot, 'outside-backup-store');
    fs.mkdirSync(outside, { recursive: true });
    const linked = createSymlinkOrSkip(
      outside,
      backupDir(world),
      'dir',
      'symlinked config-backups directory'
    );
    if (!linked.blocked) {
      assertThrows(
        () => buildWorldSource(world, { runner: passingRunner }),
        /config-backups: symlinked path component is not allowed|config-backups: symlinks are not allowed/,
        'symlinked config-backups directory must be rejected'
      );
    }
  }

  {
    const world = createWorld('dangling-backup-dir');
    const missingTarget = path.join(fixtureRoot, 'missing-backup-store');
    const linked = createSymlinkOrSkip(
      missingTarget,
      backupDir(world),
      'dir',
      'dangling config-backups symlink'
    );
    if (!linked.blocked) {
      assertThrows(
        () => buildWorldSource(world, { runner: passingRunner }),
        /config-backups: symlinked path component is not allowed|config-backups: symlinks are not allowed/,
        'dangling config-backups symlink must be rejected'
      );
    }
  }

  {
    const world = createWorld('compiled-output-symlink', null);
    const outsideTarget = path.join(fixtureRoot, 'compiled-output-symlink-target.json');
    fs.writeFileSync(outsideTarget, '{"prior":true}\n');
    const linked = createSymlinkOrSkip(
      outsideTarget,
      world.compiledOutputPath,
      'file',
      'compiled output symlink'
    );
    if (!linked.blocked) {
      assertThrows(
        () => buildWorldSource(world, { runner: passingRunner }),
        /paths\.compiledOutput: symlinked path component is not allowed|paths\.compiledOutput: symlinks are not allowed/,
        'compiled output being a symlink must be rejected'
      );
      assert(
        fs.readFileSync(outsideTarget, 'utf8') === '{"prior":true}\n',
        'compiled output symlink target must remain unchanged'
      );
    }
  }

  {
    const world = createWorld('retention-symlink-entry');
    seedRetentionBackups(world, 20);
    const linked = createSymlinkOrSkip(
      path.join(fixtureRoot, 'outside-backup-target.json'),
      recognizedBackupPath(world, '2024-02-01T00:00:00.000Z', '999-a'),
      'file',
      'retention symlink entry'
    );
    if (!linked.blocked) {
      fs.writeFileSync(path.join(fixtureRoot, 'outside-backup-target.json'), 'outside\n');
      buildWorldSource(world, { runner: passingRunner });
      assert(
        fs.lstatSync(recognizedBackupPath(world, '2024-02-01T00:00:00.000Z', '999-a')).isSymbolicLink(),
        'symlink backup entries must be left untouched and not followed'
      );
      assert(
        fs.readFileSync(path.join(fixtureRoot, 'outside-backup-target.json'), 'utf8') === 'outside\n',
        'symlink backup targets must remain untouched'
      );
    }
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  if (skipped.length > 0) {
    for (const skip of skipped) console.error(`SKIP: ${skip}`);
  }
  process.exit(1);
}

if (skipped.length > 0) {
  for (const skip of skipped) console.warn(`SKIP: ${skip}`);
}

console.log('build safety tests passed');
