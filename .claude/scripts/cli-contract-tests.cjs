#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../..');
const failures = [];

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function expectFailure(script, args, pattern, label) {
  const result = run(script, args);
  assert(result.status !== 0, `${label}: expected nonzero exit`);
  assert(
    pattern.test(`${result.stdout}\n${result.stderr}`),
    `${label}: unexpected output: ${result.stdout}${result.stderr}`
  );
}

function expectSuccess(script, args, label) {
  const result = run(script, args);
  assert(
    result.status === 0,
    `${label}: expected success, got ${result.status}: ` +
    `${result.stdout}${result.stderr}`
  );
  return result;
}

const count = '.claude/scripts/count.js';
const validate = '.claude/scripts/validate.js';
const resolve = '.claude/scripts/resolve-world.cjs';
const referencePacks = '.claude/scripts/reference-pack-architecture.cjs';
const build = '.claude/scripts/build-world.cjs';
const buildCompat = '.claude/scripts/build.js';
const metadata = '.claude/scripts/validate-world-puppeteer.cjs';
const pretty = '.claude/scripts/pretty-print.js';

expectFailure(count, ['--bogus'], /Unknown option: --bogus/, 'count unknown flag');
expectFailure(count, ['--json', '--json'], /--json may be provided only once/, 'count duplicate flag');
expectFailure(count, ['--world'], /--world requires a value/, 'count missing world value');
expectFailure(
  count,
  ['--world', 'templates', 'templates/tabs'],
  /--world cannot be combined/,
  'count world and positional conflict'
);
expectSuccess(count, ['--world', 'templates', '--json'], 'count template world');
expectSuccess(count, ['--help'], 'count help');

expectFailure(validate, ['--bogus'], /Unknown option: --bogus/, 'validate unknown flag');
expectFailure(validate, ['--world'], /--world requires a value/, 'validate missing world value');
expectFailure(
  validate,
  ['--world', 'templates', 'templates/tabs'],
  /--world cannot be combined/,
  'validate world and positional conflict'
);
expectSuccess(validate, ['--world', 'templates', '--json'], 'validate template world');
expectSuccess(validate, ['--help'], 'validate help');

expectFailure(resolve, ['--bogus'], /Unknown option: --bogus/, 'resolve unknown flag');
expectFailure(resolve, ['--json', '--json'], /--json may be provided only once/, 'resolve duplicate flag');
expectFailure(resolve, ['--world'], /--world requires a value/, 'resolve missing world value');
const resolveResult = expectSuccess(
  resolve,
  ['--world', 'templates', '--json'],
  'resolve template world'
);
try {
  const parsed = JSON.parse(resolveResult.stdout);
  assert(parsed.role === 'template', 'resolve template role must be template');
  assert(parsed.worldRole === 'template', 'resolve template worldRole must mirror role');
  assert(typeof parsed.instructionsPath === 'string' && parsed.instructionsPath.length > 0, 'resolve template JSON must include instructionsPath');
  assert(typeof parsed.tabsPath === 'string' && parsed.tabsPath.length > 0, 'resolve template JSON must include tabsPath');
  assert(typeof parsed.compiledOutputPath === 'string' && parsed.compiledOutputPath.length > 0, 'resolve template JSON must include compiledOutputPath');
} catch (error) {
  failures.push(`resolve template JSON parse failed: ${error.message}`);
}
expectSuccess(resolve, ['--help'], 'resolve help');

expectFailure(
  referencePacks,
  ['--bogus'],
  /Unknown option: --bogus/,
  'reference-pack unknown flag'
);
expectFailure(
  referencePacks,
  ['inspect'],
  /inspect requires --pack/,
  'reference-pack inspect missing pack'
);
expectFailure(
  referencePacks,
  ['validate', '--pack', 'meteion-story-instructions'],
  /validate does not accept --pack/,
  'reference-pack validate option conflict'
);
expectSuccess(
  referencePacks,
  ['validate', '--json'],
  'reference-pack validation JSON'
);
expectSuccess(
  referencePacks,
  ['inspect', '--pack', 'meteion-story-instructions', '--json'],
  'reference-pack inspection JSON'
);
expectSuccess(referencePacks, ['--help'], 'reference-pack help');

expectFailure(build, ['--bogus'], /Unknown option: --bogus/, 'build unknown flag');
expectFailure(build, ['--world'], /--world requires a value/, 'build missing world value');
expectFailure(
  build,
  ['--world', 'templates', '--world', 'templates'],
  /--world may be provided only once/,
  'build duplicate world'
);
expectSuccess(build, ['--help'], 'build help');
expectSuccess(buildCompat, ['--help'], 'build compatibility wrapper help');

expectFailure(metadata, ['--bogus'], /Unknown option: --bogus/, 'metadata unknown flag');
expectFailure(metadata, ['unexpected'], /Unexpected positional argument/, 'metadata unexpected positional');
expectSuccess(metadata, ['--json'], 'metadata validation JSON');
expectSuccess(metadata, ['--help'], 'metadata help');

expectFailure(pretty, ['--bogus'], /Unknown option: --bogus/, 'pretty-print unknown flag');
expectFailure(
  pretty,
  ['--world', 'templates', 'templates/tabs'],
  /--world cannot be combined/,
  'pretty-print world and positional conflict'
);
expectSuccess(pretty, ['--help'], 'pretty-print help');

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log('CLI contract tests passed');
