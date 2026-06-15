#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  findRepoRoot,
} = require('./world-puppeteer-lib.cjs');
const {
  inspectReferencePack,
  safeReportPath,
  validateReferencePackRegistry,
} = require('./reference-pack-architecture.cjs');

const repoRoot = findRepoRoot(process.cwd());
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function copySchema(root) {
  const schemaDir = path.join(root, '.world-puppeteer', 'schemas');
  fs.mkdirSync(schemaDir, { recursive: true });
  for (const file of ['reference-pack.schema.json', 'reference-pack-index.schema.json']) {
    fs.copyFileSync(path.join(repoRoot, '.world-puppeteer', 'schemas', file), path.join(schemaDir, file));
  }
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-reference-packs-'));
  copySchema(root);
  return root;
}

function packManifest(id, files = ['payload.json']) {
  return {
    schemaVersion: 1,
    id,
    name: id,
    source: 'fixture',
    sourceVersion: '1.0.0',
    description: 'fixture reference pack',
    compatibleFormats: ['voyage-v33'],
    domains: ['ai-instructions'],
    licenseNotes: 'fixture',
    files,
    sourceSections: [{
      file: files[0],
      sourcePath: 'aiInstructions',
      candidateTargetPath: 'aiInstructions',
      candidateTargetFile: 'ai-instructions.json',
      domain: 'ai-instructions',
    }],
  };
}

function writePack(root, dirName, manifest = packManifest(dirName), payloads = { 'payload.json': { aiInstructions: { generateStory: ['ok'] } } }) {
  const packDir = path.join(root, '.world-puppeteer', 'reference-packs', dirName);
  fs.mkdirSync(packDir, { recursive: true });
  writeJson(path.join(packDir, 'pack.json'), manifest);
  fs.writeFileSync(path.join(packDir, 'README.md'), `${manifest.name}\n`);
  for (const [relative, value] of Object.entries(payloads)) {
    const filePath = path.join(packDir, relative);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (typeof value === 'string') fs.writeFileSync(filePath, value);
    else writeJson(filePath, value);
  }
}

function assertThrows(fn, matcher, message) {
  try {
    fn();
    failures.push(`${message}: expected error`);
  } catch (error) {
    assert(matcher.test(error.message), `${message}: ${error.message}`);
  }
}

const canonical = validateReferencePackRegistry(repoRoot);
assert(canonical.errors.length === 0, `canonical reference-pack registry must pass: ${canonical.errors.join('; ')}`);
assert(canonical.packsById.has('meteion-story-instructions'), 'canonical registry must include Meteion');
assert(canonical.packsById.has('sephii-instruction-pack'), 'canonical registry must include Sephii');
for (const [id, entry] of canonical.packsById) {
  const actual = fs.readdirSync(entry.packDir)
    .filter((name) => !['pack.json', 'README.md'].includes(name))
    .sort();
  assert(JSON.stringify(actual) === JSON.stringify([...entry.manifest.files].sort()), `${id}: exact payload inventory must match manifest`);
}

const validRoot = fixtureRoot();
writePack(validRoot, 'one', packManifest('one'));
writeJson(path.join(validRoot, '.world-puppeteer', 'reference-packs', 'index.json'), { schemaVersion: 1, packs: ['one'] });
assert(validateReferencePackRegistry(validRoot).errors.length === 0, 'valid fixture registry must pass');
const report = inspectReferencePack({ repoRoot: validRoot, packId: 'one' }).report;
assert(report.readOnly === true && report.files.includes('payload.json'), 'inspection report must be read-only and list payloads');

const missingPayloadRoot = fixtureRoot();
writePack(missingPayloadRoot, 'one', packManifest('one', ['missing.json']), {});
writeJson(path.join(missingPayloadRoot, '.world-puppeteer', 'reference-packs', 'index.json'), { schemaVersion: 1, packs: ['one'] });
assert(validateReferencePackRegistry(missingPayloadRoot).errors.some((error) => error.includes('listed payload missing')), 'missing payload must fail');

const unlistedPayloadRoot = fixtureRoot();
writePack(unlistedPayloadRoot, 'one', packManifest('one'), {
  'payload.json': { aiInstructions: {} },
  'extra.json': { aiInstructions: {} },
});
writeJson(path.join(unlistedPayloadRoot, '.world-puppeteer', 'reference-packs', 'index.json'), { schemaVersion: 1, packs: ['one'] });
assert(validateReferencePackRegistry(unlistedPayloadRoot).errors.some((error) => error.includes('payload file not listed')), 'unlisted payload must fail');

const traversalRoot = fixtureRoot();
writePack(traversalRoot, 'one', packManifest('one', ['../escape.json']), {});
writeJson(path.join(traversalRoot, '.world-puppeteer', 'reference-packs', 'index.json'), { schemaVersion: 1, packs: ['one'] });
assert(validateReferencePackRegistry(traversalRoot).errors.some((error) => error.includes('unsafe payload path')), 'path traversal payload must fail');


const unsafeSourceRoot = fixtureRoot();
writePack(unsafeSourceRoot, 'one', packManifest('one', ['../../outside.json']), {});
fs.writeFileSync(path.join(unsafeSourceRoot, '.world-puppeteer', 'outside.json'), '{ malformed outside payload');
writeJson(path.join(unsafeSourceRoot, '.world-puppeteer', 'reference-packs', 'index.json'), { schemaVersion: 1, packs: ['one'] });
const unsafeSourceErrors = validateReferencePackRegistry(unsafeSourceRoot).errors;
assert(unsafeSourceErrors.some((error) => error.includes('unsafe payload path')), 'unsafe source-section payload must fail path validation');
assert(
  unsafeSourceErrors.some((error) => error.includes('is not a validated safe payload')),
  'source sections must refuse payloads that failed path validation'
);
assert(
  !unsafeSourceErrors.some((error) => error.includes('malformed outside payload')),
  'unsafe payloads must not be read after path validation fails'
);

const invalidReadmeRoot = fixtureRoot();
writePack(invalidReadmeRoot, 'one', packManifest('one'));
const invalidReadmePath = path.join(invalidReadmeRoot, '.world-puppeteer', 'reference-packs', 'one', 'README.md');
fs.rmSync(invalidReadmePath);
fs.mkdirSync(invalidReadmePath);
writeJson(path.join(invalidReadmeRoot, '.world-puppeteer', 'reference-packs', 'index.json'), { schemaVersion: 1, packs: ['one'] });
assert(
  validateReferencePackRegistry(invalidReadmeRoot).errors.some((error) => error.includes('README.md: not a regular file')),
  'pack control files must be regular files'
);

const malformedRoot = fixtureRoot();
const malformedDir = path.join(malformedRoot, '.world-puppeteer', 'reference-packs', 'one');
fs.mkdirSync(malformedDir, { recursive: true });
fs.writeFileSync(path.join(malformedDir, 'pack.json'), '{ broken');
fs.writeFileSync(path.join(malformedDir, 'README.md'), 'one\n');
writeJson(path.join(malformedRoot, '.world-puppeteer', 'reference-packs', 'index.json'), { schemaVersion: 1, packs: ['one'] });
assert(validateReferencePackRegistry(malformedRoot).errors.some((error) => error.includes('invalid JSON')), 'malformed manifest must fail');

const duplicateRoot = fixtureRoot();
writePack(duplicateRoot, 'one-a', packManifest('one'));
writePack(duplicateRoot, 'one-b', packManifest('one'));
writeJson(path.join(duplicateRoot, '.world-puppeteer', 'reference-packs', 'index.json'), { schemaVersion: 1, packs: ['one'] });
assert(validateReferencePackRegistry(duplicateRoot).errors.some((error) => error.includes('duplicate reference pack id')), 'duplicate pack IDs must fail');

assertThrows(
  () => safeReportPath(validRoot, 'tabs/report.json'),
  /report output must stay under/,
  'reports outside allowlisted root must fail'
);
assertThrows(
  () => safeReportPath(validRoot, '.world-puppeteer/reference-packs/report.json'),
  /report output must stay under/,
  'reports into source pack root must fail'
);
const safeReport = safeReportPath(validRoot, '.world-puppeteer/reports/reference-packs/one.json');
assert(safeReport.endsWith(path.join('.world-puppeteer', 'reports', 'reference-packs', 'one.json')), 'safe report path must resolve under report root');

function tryCreateSymlink(target, linkPath, type, label) {
  try {
    fs.symlinkSync(target, linkPath, type);
    return true;
  } catch (error) {
    const permissionCodes = new Set(['EPERM', 'EACCES', 'ENOTSUP']);
    if (permissionCodes.has(error.code)) {
      console.warn(`warning: ${label} skipped because symlink creation is not permitted: ${error.message}`);
      return false;
    }
    throw error;
  }
}

{
  const symlinkRoot = fixtureRoot();
  const packDir = path.join(symlinkRoot, '.world-puppeteer', 'reference-packs', 'one');
  fs.mkdirSync(packDir, { recursive: true });
  const outside = path.join(symlinkRoot, 'outside.json');
  writeJson(outside, { aiInstructions: {} });

  const created = tryCreateSymlink(
    outside,
    path.join(packDir, 'payload.json'),
    'file',
    'symlink payload test'
  );

  if (created) {
    writeJson(path.join(packDir, 'pack.json'), packManifest('one'));
    fs.writeFileSync(path.join(packDir, 'README.md'), 'one\n');
    writeJson(
      path.join(symlinkRoot, '.world-puppeteer', 'reference-packs', 'index.json'),
      { schemaVersion: 1, packs: ['one'] }
    );
    const errors = validateReferencePackRegistry(symlinkRoot).errors;
    assert(
      errors.some((error) => error.includes('symlinked payloads are not allowed')),
      'symlink payload escape must fail'
    );
  }
}

{
  const symlinkPackRoot = fixtureRoot();
  const packsRoot = path.join(symlinkPackRoot, '.world-puppeteer', 'reference-packs');
  const outsidePack = path.join(symlinkPackRoot, 'outside-pack');
  fs.mkdirSync(packsRoot, { recursive: true });
  fs.mkdirSync(outsidePack, { recursive: true });
  writeJson(path.join(outsidePack, 'pack.json'), packManifest('linked-pack'));
  fs.writeFileSync(path.join(outsidePack, 'README.md'), 'linked pack\n');
  writeJson(
    path.join(outsidePack, 'payload.json'),
    { aiInstructions: { generateStory: ['ok'] } }
  );

  const created = tryCreateSymlink(
    outsidePack,
    path.join(packsRoot, 'linked-pack'),
    process.platform === 'win32' ? 'junction' : 'dir',
    'symlink pack-directory test'
  );

  if (created) {
    writeJson(
      path.join(packsRoot, 'index.json'),
      { schemaVersion: 1, packs: ['linked-pack'] }
    );
    const errors = validateReferencePackRegistry(symlinkPackRoot).errors;
    assert(
      errors.some((error) =>
        error.includes('symlinked reference-pack entries are not allowed')
      ),
      'symlinked reference-pack directories must fail explicitly'
    );
  }
}

{
  const reportSymlinkRoot = fixtureRoot();
  writePack(reportSymlinkRoot, 'one', packManifest('one'));
  writeJson(
    path.join(reportSymlinkRoot, '.world-puppeteer', 'reference-packs', 'index.json'),
    { schemaVersion: 1, packs: ['one'] }
  );

  const reportParent = path.join(
    reportSymlinkRoot,
    '.world-puppeteer',
    'reports'
  );
  const outsideReports = path.join(reportSymlinkRoot, 'outside-reports');
  fs.mkdirSync(reportParent, { recursive: true });
  fs.mkdirSync(outsideReports, { recursive: true });

  const created = tryCreateSymlink(
    outsideReports,
    path.join(reportParent, 'reference-packs'),
    process.platform === 'win32' ? 'junction' : 'dir',
    'symlink report-root test'
  );

  if (created) {
    assertThrows(
      () => inspectReferencePack({
        repoRoot: reportSymlinkRoot,
        packId: 'one',
        outputPath: '.world-puppeteer/reports/reference-packs/one.json',
      }),
      /symlinked path component|report root realpath escapes repository/,
      'symlinked report roots must fail before writing'
    );
    assert(
      !fs.existsSync(path.join(outsideReports, 'one.json')),
      'report inspection must not write through a symlinked report root'
    );
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('reference-pack architecture tests passed');
