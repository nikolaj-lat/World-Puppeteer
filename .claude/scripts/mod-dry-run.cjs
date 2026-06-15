#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  findRepoRoot,
  isInside,
  resolveWorld,
} = require('./world-puppeteer-lib.cjs');
const {
  createDryRunPlan,
  validateAgainstSchemaFile,
} = require('./mod-architecture.cjs');

function parseArgs(argv) {
  const args = { mode: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--mod') args.modId = argv[++i];
    else if (arg === '--world') args.worldRoot = argv[++i];
    else if (arg === '--mode') args.mode = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    'Usage: node .claude/scripts/mod-dry-run.cjs --mod <mod-id> --world <world-root> [--mode reference|apply] [--out plan.json]',
    '',
    'The command validates manifests, payload mappings, dependencies, compatibility, provenance, and the emitted plan schema.',
    'It performs no writes to the target world. Optional --out must remain inside the repository and outside the target world.',
  ].join('\n');
}

function validatePlanShape(plan, repoRoot = findRepoRoot(process.cwd())) {
  return validateAgainstSchemaFile(
    plan,
    path.join(repoRoot, '.world-puppeteer', 'schemas', 'mod-integration-plan.schema.json')
  );
}

function createPlan({ modId, worldRoot, mode, repoRoot, cwd = process.cwd() }) {
  const resolvedWorldRoot = path.resolve(cwd, worldRoot);
  const world = resolveWorld({
    worldRoot: resolvedWorldRoot,
    cwd,
    repoRoot,
    preferNearest: false,
  });
  const { plan } = createDryRunPlan({ repoRoot, world, modId, mode });
  return { plan, world };
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      return;
    }
    if (!args.modId) throw new Error('--mod is required');
    if (!args.worldRoot) throw new Error('--world is required');

    const cwd = process.cwd();
    const repoRoot = findRepoRoot(cwd);
    const { plan, world } = createPlan({
      modId: args.modId,
      worldRoot: args.worldRoot,
      mode: args.mode,
      repoRoot,
      cwd,
    });
    const output = JSON.stringify(plan, null, 2) + '\n';

    if (args.out) {
      const outPath = path.resolve(cwd, args.out);
      if (!isInside(outPath, repoRoot)) throw new Error('--out must remain inside the repository');
      if (isInside(outPath, world.worldRoot)) throw new Error('--out must not write inside the target world');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, output);
    }
    process.stdout.write(output);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  createPlan,
  parseArgs,
  validatePlanShape,
};
