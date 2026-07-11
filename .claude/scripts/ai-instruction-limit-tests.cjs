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

  // v35 live validator measures leaves as JSON.stringify(leaf).length —
  // escaped string INCLUDING quotes. 4,998 ASCII chars serialize to exactly
  // 5,000, so this sits at the boundary and must pass.
  const leafBoundary = writeFixture('leaf-boundary', {
    boundaryTask: {
      custom: 'a'.repeat(4998),
    },
  });

  const boundaryCount = runJson(countScript, leafBoundary);
  const boundaryValidate = runJson(validateScript, leafBoundary);

  assert(
    boundaryCount.status === 0,
    'count.js must measure leaves as serialized JSON including quotes (4,998 ASCII = 5,000 serialized = at limit)'
  );

  assert(
    boundaryCount.parsed?.aiInstructions?.individual?.length === 0,
    'the 5,000-serialized-char leaf boundary must not be oversized'
  );
  assert(
    aiErrors(boundaryValidate).length === 0,
    'the 5,000-serialized-char leaf boundary must produce no AI validation error'
  );

  // Escapes count double: 4,990 chars + 5 newlines serialize to
  // 4,990 + 5 + 2 = ... actually 4,985 'a' + 5 '\n' = 4,990 raw but
  // 4,985 + 10 + 2 = 4,997 serialized (under); push it over with a
  // 4,994-raw string holding 5 newlines: 4,989 + 10 + 2 = 5,001.
  const escapedLeaf = writeFixture('escaped-leaf', {
    escapedTask: {
      custom: `${'a'.repeat(4989)}${'\n'.repeat(5)}`,
    },
  });

  const escapedCount = runJson(countScript, escapedLeaf);

  assert(
    escapedCount.status === 1,
    'count.js must count escaped characters (\\n) as 2 serialized chars, matching the live validator'
  );

  // Task totals are the pretty-printed (indent=2) JSON length of the whole
  // task object — keys, indentation, braces, and escapes all count — so five
  // 4,001-char leaves land well over the 20,000 cap.
  const fourThousandOne = 'a'.repeat(4001);
  const oversizedTask = writeFixture('oversized-task', {
    oversizedTask: {
      one: fourThousandOne,
      two: fourThousandOne,
      three: fourThousandOne,
      four: fourThousandOne,
      five: fourThousandOne,
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

  // generateNPCIntents carries raised caps (8,000/leaf, 40,000/task).
  const npcIntentsOverride = writeFixture('npc-intents-override', {
    generateNPCIntents: {
      one: 'a'.repeat(6000),
      two: fourThousand,
      three: fourThousand,
      four: fourThousand,
      five: fourThousand,
      six: fourThousand,
    },
  });

  const overrideCount = runJson(countScript, npcIntentsOverride);
  const overrideValidate = runJson(validateScript, npcIntentsOverride);

  assert(
    overrideCount.status === 0,
    'count.js must allow generateNPCIntents up to 40,000 codepoints with 8,000-codepoint leaves'
  );
  assert(
    overrideCount.parsed?.aiInstructions?.individual?.length === 0,
    'a 6,000-codepoint generateNPCIntents leaf must not be oversized'
  );
  assert(
    aiErrors(overrideValidate).length === 0,
    'the generateNPCIntents raised caps must produce no AI validation errors'
  );
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log('AI instruction limit tests passed');
