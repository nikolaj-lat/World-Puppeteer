const fs = require('fs');
const path = require('path');

const TEXT_FILE_PATTERN = /\.(md|json|js|cjs|toml|ya?ml)$/i;

const STALE_REFERENCE_RULES = [
  {
    id: 'bypass-permissions',
    test: (text) => text.includes('bypassPermissions'),
    message: 'contains bypassPermissions',
  },
  {
    id: 'create-tabs',
    test: (text) => text.includes('create-tabs.js'),
    message: 'references create-tabs.js',
  },
  {
    id: 'create-checklist',
    test: (text) => text.includes('create-checklist.js'),
    message: 'references create-checklist.js',
  },
  {
    id: 'obsolete-utility-alias',
    test: (text) => /\b(skill|agent): (count|charts|maps)\b/.test(text),
    message: 'active obsolete utility name remains',
  },
  {
    id: 'obsolete-mod-architecture',
    test: (text, filePath) =>
      path.normalize(filePath) !== path.normalize('.claude/mods/README.md') &&
      (
        text.includes('.world-puppeteer/mods') ||
        text.includes('mod-integrator') ||
        text.includes('mod-integration/SKILL.md') ||
        text.includes('mod.schema.json') ||
        text.includes('mod-integration-plan.schema.json')
      ),
    message: 'references removed mod architecture',
  },
];

function listInstructionTextFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  if (fs.lstatSync(dir).isSymbolicLink()) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      listInstructionTextFiles(full, out);
    } else if (TEXT_FILE_PATTERN.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function staleReferenceTargets(repoRoot, options = {}) {
  const validatedWorlds = Array.isArray(options.validatedWorlds) ? options.validatedWorlds : [];
  const targets = [
    ...listInstructionTextFiles(path.join(repoRoot, '.claude', 'agents')),
    ...listInstructionTextFiles(path.join(repoRoot, '.claude', 'skills')),
    ...listInstructionTextFiles(path.join(repoRoot, '.claude', 'scripts')),
    ...listInstructionTextFiles(path.join(repoRoot, '.agents')),
    ...listInstructionTextFiles(path.join(repoRoot, '.codex')),
    path.join(repoRoot, '.claude', 'settings.json'),
    path.join(repoRoot, 'AGENTS.md'),
    path.join(repoRoot, 'README.md'),
    path.join(repoRoot, '.claude', 'SETUP.md'),
  ];

  for (const world of validatedWorlds) {
    if (typeof world.instructionsPath === 'string') targets.push(world.instructionsPath);
    for (const localDir of [
      path.join(world.worldRoot, '.agents', 'skills'),
      path.join(world.worldRoot, '.claude', 'skills'),
      path.join(world.worldRoot, '.codex', 'agents'),
    ]) {
      targets.push(...listInstructionTextFiles(localDir));
    }
  }

  return [...new Set(targets.map((file) => path.resolve(file)))]
    .filter((file) => fs.existsSync(file));
}

function scanStaleReferences(repoRoot, options = {}) {
  const errors = [];
  const ignoredBasenames = new Set([
    'stale-reference-rules.cjs',
    'tooling-architecture-tests.cjs',
  ]);

  for (const file of staleReferenceTargets(repoRoot, options)) {
    if (ignoredBasenames.has(path.basename(file))) continue;
    const relative = path.relative(repoRoot, file) || path.basename(file);
    const text = fs.readFileSync(file, 'utf8');
    for (const rule of STALE_REFERENCE_RULES) {
      if (rule.test(text, relative)) {
        errors.push(`${relative}: ${rule.message}`);
      }
    }
  }

  return errors;
}

module.exports = {
  STALE_REFERENCE_RULES,
  listInstructionTextFiles,
  scanStaleReferences,
  staleReferenceTargets,
};
