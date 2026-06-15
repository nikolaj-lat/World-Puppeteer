#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../..');
const countScript = path.join(repoRoot, '.claude', 'scripts', 'count.js');
const validateScript = path.join(repoRoot, '.claude', 'scripts', 'validate.js');
const templateTabs = path.join(repoRoot, 'templates', 'tabs');
const fixtureRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'world-puppeteer-ai-instruction-tests-')
);
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, targetPath);
    else fs.copyFileSync(sourcePath, targetPath);
  }
}

function writeFixture(name, aiInstructions) {
  const tabsPath = path.join(fixtureRoot, name, 'tabs');
  copyDirectory(templateTabs, tabsPath);
  fs.writeFileSync(
    path.join(tabsPath, 'ai-instructions.json'),
    `${JSON.stringify({ aiInstructions }, null, 2)}\n`
  );
  return tabsPath;
}

function runJson(scriptPath, tabsPath) {
  const result = spawnSync(
    process.execPath,
    [scriptPath, tabsPath, '--json'],
    { cwd: repoRoot, encoding: 'utf8' }
  );

  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    failures.push(
      `${path.basename(scriptPath)} did not emit JSON for ${tabsPath}: ` +
      `${error.message}\nstdout=${result.stdout}\nstderr=${result.stderr}`
    );
  }

  return { ...result, parsed };
}

function aiErrors(result) {
  return (result.parsed?.errors || []).filter((error) =>
    typeof error.path === 'string' && error.path.startsWith('aiInstructions')
  );
}

const fourThousand = 'a'.repeat(4000);

try {
  const separateTasks = writeFixture('separate-tasks', {
    taskOne: {
      one: fourThousand,
      two: fourThousand,
      three: fourThousand,
      four: fourThousand,
    },
    taskTwo: {
      one: fourThousand,
      two: fourThousand,
      three: fourThousand,
      four: fourThousand,
    },
  });

  const separateCount = runJson(countScript, separateTasks);
  const separateValidate = runJson(validateScript, separateTasks);

  assert(
    separateCount.status === 0,
    'count.js must not apply one 20,000 limit across separate AI tasks'
  );

  assert(
    separateCount.parsed?.aiInstructions?.tasks?.length === 2,
    'count.js must report each top-level AI task separately'
  );
  assert(
    aiErrors(separateValidate).length === 0,
    'separate valid AI tasks must produce no AI validation errors'
  );

  const unicodeBoundary = writeFixture('unicode-boundary', {
    unicodeTask: {
      custom: '😀'.repeat(5000),
    },
  });

  const unicodeCount = runJson(countScript, unicodeBoundary);
  const unicodeValidate = runJson(validateScript, unicodeBoundary);

  assert(
    unicodeCount.status === 0,
    'count.js must count 5,000 emoji as 5,000 Unicode codepoints'
  );

  assert(
    unicodeCount.parsed?.aiInstructions?.individual?.length === 0,
    'the 5,000-codepoint string boundary must not be oversized'
  );
  assert(
    aiErrors(unicodeValidate).length === 0,
    'the 5,000-codepoint string boundary must produce no AI validation error'
  );

  const oversizedTask = writeFixture('oversized-task', {
    oversizedTask: {
      one: fourThousand,
      two: fourThousand,
      three: fourThousand,
      four: fourThousand,
      five: fourThousand,
    },
  });

  const oversizedCount = runJson(countScript, oversizedTask);
  const oversizedValidate = runJson(validateScript, oversizedTask);
  const oversizedCountTasks =
    oversizedCount.parsed?.aiInstructions?.tasks || [];
  const oversizedValidateErrors = aiErrors(oversizedValidate);

  assert(
    oversizedCount.status === 1,
    'count.js must reject a top-level AI task above 20,000 codepoints'
  );
  assert(
    oversizedCountTasks.some((task) =>
      task.path === 'aiInstructions.oversizedTask' &&
      task.used > task.limit
    ),
    'count.js must report the oversized task at its full task path'
  );
  assert(
    oversizedCount.parsed?.aiInstructions?.individual?.length === 0,
    'the oversized task fixture must not be misreported as a leaf violation'
  );
  assert(
    oversizedValidate.status === 1,
    'validate.js must reject a top-level AI task above 20,000 codepoints'
  );
  assert(
    oversizedValidateErrors.some((error) =>
      error.path === 'aiInstructions.oversizedTask' &&
      error.message.includes('AI instruction task too long')
    ),
    'validate.js must report the 20,000-codepoint violation at task scope'
  );
  assert(
    !oversizedValidateErrors.some((error) =>
      error.path !== 'aiInstructions.oversizedTask'
    ),
    'the oversized task fixture must not produce false leaf violations'
  );
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log('AI instruction limit tests passed');
