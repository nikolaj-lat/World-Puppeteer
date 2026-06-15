#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  findRepoRoot,
  isInside,
  readJson,
  resolveWorld,
  validateModRegistry,
} = require('./world-puppeteer-lib.cjs');

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
    'The command performs no writes to the target world.',
  ].join('\n');
}

function payloadInfo(modDir, relativePath) {
  const fullPath = path.join(modDir, relativePath);
  const info = {
    path: relativePath,
    kind: relativePath.endsWith('.json') ? 'json' : 'file',
    topLevelKeys: [],
  };
  if (info.kind === 'json') {
    const parsed = readJson(fullPath);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      info.topLevelKeys = Object.keys(parsed).sort();
    }
  }
  return info;
}

function readTargetTopLevelKeys(world, domain) {
  const target = path.join(world.tabsPath, `${domain}.json`);
  if (!fs.existsSync(target)) return { target, keys: [] };
  const parsed = readJson(target);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { target, keys: [] };
  return { target, keys: Object.keys(parsed).sort() };
}

function validatePlanShape(plan) {
  const errors = [];
  const operations = new Set(['reference', 'add', 'adapt']);
  for (const key of [
    'schemaVersion',
    'modId',
    'modVersion',
    'targetWorldId',
    'mode',
    'affectedDomains',
    'sourcePayloads',
    'proposedOperations',
    'conflicts',
    'warnings',
    'approvalRequired',
  ]) {
    if (!(key in plan)) errors.push(`plan missing ${key}`);
  }
  if (plan.schemaVersion !== 1) errors.push('plan.schemaVersion must be 1');
  if (!['reference', 'apply'].includes(plan.mode)) errors.push('plan.mode must be reference or apply');
  if (!Array.isArray(plan.affectedDomains) || plan.affectedDomains.length === 0) errors.push('plan.affectedDomains must be non-empty');
  for (const operation of plan.proposedOperations || []) {
    if (!operations.has(operation.type)) errors.push(`unsupported operation type: ${operation.type}`);
    if (operation.type === 'replace') errors.push('replace operation is not allowed');
  }
  return errors;
}

function createPlan({ modId, worldRoot, mode, repoRoot }) {
  const registry = validateModRegistry(repoRoot);
  if (registry.errors.length > 0) throw new Error(`Mod registry is invalid:\n${registry.errors.join('\n')}`);
  const mod = registry.modsById.get(modId);
  if (!mod) throw new Error(`Unknown mod id: ${modId}`);

  const world = resolveWorld({ worldRoot, cwd: worldRoot || process.cwd(), preferNearest: !worldRoot });
  const selectedMode = mode || mod.manifest.defaultMode;
  if (!mod.manifest.supportedModes.includes(selectedMode)) {
    throw new Error(`Mod ${modId} does not support mode ${selectedMode}`);
  }
  if (!mod.manifest.compatibleFormats.includes(world.marker.format)) {
    throw new Error(`Mod ${modId} is not compatible with world format ${world.marker.format}`);
  }
  if ((world.marker.appliedMods || []).some((record) => record.modId === modId)) {
    throw new Error(`Mod ${modId} already appears in appliedMods for ${world.marker.id}; do not reapply or update silently.`);
  }

  const sourcePayloads = mod.manifest.files.map((file) => payloadInfo(mod.modDir, file));
  const warnings = [
    ...registry.warnings,
    'Creative adaptation requires human or specialist-agent judgment before application.',
  ];
  const conflicts = [];
  const proposedOperations = [];

  for (const payload of sourcePayloads) {
    const collisionKeys = new Set();
    const targetPaths = [];
    for (const domain of mod.manifest.domains) {
      const target = readTargetTopLevelKeys(world, domain);
      targetPaths.push(path.relative(world.worldRoot, target.target).replace(/\\/g, '/'));
      for (const key of payload.topLevelKeys) {
        if (target.keys.includes(key)) collisionKeys.add(key);
      }
    }
    if (collisionKeys.size > 0) {
      conflicts.push({
        source: payload.path,
        target: targetPaths.join(', '),
        keys: Array.from(collisionKeys).sort(),
      });
      proposedOperations.push({
        type: 'adapt',
        source: payload.path,
        target: targetPaths.join(', '),
        requiresApproval: true,
        reason: 'Source JSON top-level keys collide with target tab keys; manual adaptation is required.',
      });
    } else {
      proposedOperations.push({
        type: selectedMode === 'reference' ? 'reference' : 'add',
        source: payload.path,
        target: targetPaths.join(', '),
        requiresApproval: true,
        reason: selectedMode === 'reference'
          ? 'Reference the payload during human or agent-guided adaptation; no target-world write is proposed.'
          : 'No exact top-level key collision was detected; additive application still requires approval.',
      });
    }
  }

  const plan = {
    schemaVersion: 1,
    modId: mod.manifest.id,
    modVersion: mod.manifest.version,
    targetWorldId: world.marker.id,
    mode: selectedMode,
    affectedDomains: [...mod.manifest.domains].sort(),
    sourcePayloads,
    proposedOperations,
    conflicts,
    warnings,
    approvalRequired: true,
  };

  const errors = validatePlanShape(plan);
  if (errors.length > 0) throw new Error(`Dry-run plan failed schema validation:\n${errors.join('\n')}`);
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
    const repoRoot = findRepoRoot(process.cwd());
    const { plan, world } = createPlan({ modId: args.modId, worldRoot: args.worldRoot, mode: args.mode, repoRoot });
    const output = JSON.stringify(plan, null, 2) + '\n';
    if (args.out) {
      const outPath = path.resolve(process.cwd(), args.out);
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
  validatePlanShape,
};
