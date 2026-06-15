#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  collisionKeys,
  getByPath,
  isSafeRelativePath,
  readJsonResult,
  validateAgainstSchemaFile,
} = require('./mod-architecture.cjs');

const SUPPORTED_MOD_APPLICATION_PROFILES = new Set([
  'reference-only',
  'additive',
  'structured-merge',
  'template-copy',
  'manual',
]);
const SUPPORTED_MOD_MODES = new Set(['reference', 'apply']);
const SUPPORTED_CONFLICT_POLICIES = new Set(['stop']);
const NON_PAYLOAD_MOD_FILES = new Set(['mod.json', 'README.md']);

function normalizeRelative(value) {
  return value.replace(/\\/g, '/');
}

function isInside(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function listFilesRecursive(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFilesRecursive(full, out);
    else out.push(full);
  }
  return out;
}

function listModPayloadFiles(modDir) {
  return listFilesRecursive(modDir)
    .map((file) => normalizeRelative(path.relative(modDir, file)))
    .filter((relative) => !NON_PAYLOAD_MOD_FILES.has(relative))
    .sort();
}

function validateApplicationContract(manifest, manifestPath) {
  const errors = [];
  if (!SUPPORTED_MOD_APPLICATION_PROFILES.has(manifest.applicationProfile)) {
    errors.push(`${manifestPath}: unsupported applicationProfile ${manifest.applicationProfile}`);
  }
  if (!SUPPORTED_CONFLICT_POLICIES.has(manifest.conflictPolicy)) {
    errors.push(`${manifestPath}: unsupported conflictPolicy ${manifest.conflictPolicy}`);
  }
  if (manifest.applicationProfile === 'reference-only') {
    if (manifest.defaultMode !== 'reference') errors.push(`${manifestPath}: reference-only mods must default to reference mode`);
    if ((manifest.supportedModes || []).some((mode) => mode !== 'reference')) {
      errors.push(`${manifestPath}: reference-only mods may support only reference mode`);
    }
  } else if (!(manifest.supportedModes || []).includes('apply')) {
    errors.push(`${manifestPath}: ${manifest.applicationProfile} mods must support apply mode`);
  }
  return errors;
}

function validateModManifest(modDir, repoRoot) {
  const errors = [];
  const warnings = [];
  const manifestPath = path.join(modDir, 'mod.json');
  if (!fs.existsSync(manifestPath)) return { manifest: null, errors: [`${modDir}: missing mod.json`], warnings };

  const loaded = readJsonResult(manifestPath);
  if (loaded.error) return { manifest: null, errors: [loaded.error], warnings };
  const manifest = loaded.value;
  const schemaPath = path.join(repoRoot, '.world-puppeteer', 'schemas', 'mod.schema.json');
  errors.push(...validateAgainstSchemaFile(manifest, schemaPath).map((message) => `${manifestPath}: ${message}`));
  errors.push(...validateApplicationContract(manifest, manifestPath));

  const actualPayloads = listModPayloadFiles(modDir);
  const listedPayloads = new Set();
  for (const [index, file] of (manifest.files || []).entries()) {
    if (!isSafeRelativePath(file)) {
      errors.push(`${manifestPath}: files[${index}] must be relative and traversal-safe`);
      continue;
    }
    const normalized = normalizeRelative(file);
    if (listedPayloads.has(normalized)) errors.push(`${manifestPath}: duplicate files entry ${normalized}`);
    listedPayloads.add(normalized);
    const resolved = path.resolve(modDir, normalized);
    if (!isInside(resolved, modDir)) errors.push(`${manifestPath}: payload escapes mod directory: ${normalized}`);
    else if (!fs.existsSync(resolved)) errors.push(`${manifestPath}: listed payload missing: ${normalized}`);
  }
  for (const actual of actualPayloads) {
    if (!listedPayloads.has(actual)) errors.push(`${manifestPath}: payload file not listed in files: ${actual}`);
  }
  for (const listed of listedPayloads) {
    if (!actualPayloads.includes(listed)) errors.push(`${manifestPath}: files entry is not a payload file: ${listed}`);
  }

  const seenMappings = new Set();
  for (const [index, mapping] of (manifest.payloadMappings || []).entries()) {
    const mappingKey = `${mapping.file}|${mapping.sourcePath}|${mapping.targetPath}|${mapping.preferredTargetFile}`;
    if (seenMappings.has(mappingKey)) errors.push(`${manifestPath}: duplicate payload mapping ${mappingKey}`);
    seenMappings.add(mappingKey);
    if (!listedPayloads.has(normalizeRelative(mapping.file || ''))) {
      errors.push(`${manifestPath}: payloadMappings[${index}].file is not listed in files: ${mapping.file}`);
      continue;
    }
    if (!isSafeRelativePath(mapping.preferredTargetFile) || !mapping.preferredTargetFile.endsWith('.json')) {
      errors.push(`${manifestPath}: payloadMappings[${index}].preferredTargetFile must be a safe JSON path`);
    }
    if (!manifest.domains?.includes(mapping.domain)) {
      errors.push(`${manifestPath}: payloadMappings[${index}].domain is not declared: ${mapping.domain}`);
    }
    const payloadPath = path.join(modDir, mapping.file);
    const payload = readJsonResult(payloadPath);
    if (payload.error) errors.push(payload.error);
    else if (getByPath(payload.value, mapping.sourcePath) === undefined) {
      errors.push(`${manifestPath}: payloadMappings[${index}].sourcePath not found in ${mapping.file}: ${mapping.sourcePath}`);
    }
  }
  for (const file of listedPayloads) {
    if (!(manifest.payloadMappings || []).some((mapping) => normalizeRelative(mapping.file) === file)) {
      errors.push(`${manifestPath}: payload has no target mappings: ${file}`);
    }
  }

  return { manifest, errors, warnings, modDir, manifestPath };
}

function detectDependencyCycle(modsById) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  function visit(id) {
    if (visiting.has(id)) return stack.slice(stack.indexOf(id)).concat(id);
    if (visited.has(id)) return null;
    visiting.add(id);
    stack.push(id);
    for (const dependency of modsById.get(id)?.manifest?.dependencies || []) {
      if (!modsById.has(dependency)) continue;
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  }
  for (const id of modsById.keys()) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

function validateModRegistry(repoRoot) {
  const modsRoot = path.join(repoRoot, '.world-puppeteer', 'mods');
  const errors = [];
  const warnings = [];
  const modsById = new Map();
  if (!fs.existsSync(modsRoot)) return { errors: [`${modsRoot}: missing mods root`], warnings, modsById, modsRoot };

  for (const entry of fs.readdirSync(modsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const modDir = path.join(modsRoot, entry.name);
    const result = validateModManifest(modDir, repoRoot);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (!fs.existsSync(path.join(modDir, 'README.md'))) errors.push(`${entry.name}: missing README.md`);
    if (!result.manifest) continue;
    if (modsById.has(result.manifest.id)) errors.push(`${modDir}: duplicate mod id ${result.manifest.id}`);
    else modsById.set(result.manifest.id, { ...result, dirName: entry.name });
  }

  const indexPath = path.join(modsRoot, 'index.json');
  const indexLoaded = readJsonResult(indexPath);
  if (indexLoaded.error) errors.push(indexLoaded.error);
  else {
    const index = indexLoaded.value;
    if (index.schemaVersion !== 1) errors.push(`${indexPath}: schemaVersion must be 1`);
    if (!Array.isArray(index.mods)) errors.push(`${indexPath}: mods must be an array`);
    else {
      const seen = new Set();
      for (const id of index.mods) {
        if (seen.has(id)) errors.push(`${indexPath}: duplicate registry entry ${id}`);
        seen.add(id);
        if (!modsById.has(id)) errors.push(`${indexPath}: unknown mod id ${id}`);
      }
      for (const [id, entry] of modsById) {
        if (!seen.has(id)) errors.push(`${indexPath}: mod directory not represented in registry: ${entry.dirName}`);
      }
    }
  }

  for (const [id, entry] of modsById) {
    if ((entry.manifest.dependencies || []).includes(id)) errors.push(`${id}: mod cannot depend on itself`);
    for (const dependency of entry.manifest.dependencies || []) {
      if (!modsById.has(dependency)) errors.push(`${id}: required dependency not found: ${dependency}`);
    }
    for (const dependency of entry.manifest.optionalDependencies || []) {
      if (!modsById.has(dependency)) warnings.push(`${id}: optional dependency not found: ${dependency}`);
    }
  }
  const cycle = detectDependencyCycle(modsById);
  if (cycle) errors.push(`required dependency cycle: ${cycle.join(' -> ')}`);
  return { errors, warnings, modsById, modsRoot };
}

function validateAppliedMods(marker, registry, markerPath) {
  const errors = [];
  const seen = new Set();
  for (const [index, record] of (marker.appliedMods || []).entries()) {
    const prefix = `${markerPath}: appliedMods[${index}]`;
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (seen.has(record.modId)) errors.push(`${prefix}: duplicate applied mod ${record.modId}`);
    seen.add(record.modId);
    if (record.mode !== 'apply') errors.push(`${prefix}.mode must be apply; reference use is not application provenance`);
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(record.appliedAt || '')) {
      errors.push(`${prefix}.appliedAt must be an ISO date or UTC timestamp`);
    }
    const mod = registry.modsById.get(record.modId);
    if (!mod) {
      errors.push(`${prefix}: unknown mod id ${record.modId}`);
      continue;
    }
    if (record.version !== mod.manifest.version) errors.push(`${prefix}: version ${record.version} does not match registered ${mod.manifest.version}`);
    const allowedFiles = new Set(mod.manifest.files.map(normalizeRelative));
    for (const sourceFile of record.sourceFiles || []) {
      if (!isSafeRelativePath(sourceFile)) errors.push(`${prefix}: unsafe source file ${sourceFile}`);
      else if (!allowedFiles.has(normalizeRelative(sourceFile))) errors.push(`${prefix}: source file is not in manifest: ${sourceFile}`);
    }
    if (!Array.isArray(record.operations) || record.operations.length === 0) errors.push(`${prefix}.operations must be non-empty`);
    for (const operation of record.operations || []) {
      if (!['add', 'adapt'].includes(operation)) errors.push(`${prefix}: unsupported applied operation ${operation}`);
    }
  }
  return errors;
}

function findExistingTargetFiles(world, targetPath) {
  if (!fs.existsSync(world.tabsPath)) return [];
  const found = [];
  for (const file of fs.readdirSync(world.tabsPath).filter((name) => name.endsWith('.json')).sort()) {
    const fullPath = path.join(world.tabsPath, file);
    const loaded = readJsonResult(fullPath);
    if (!loaded.error && getByPath(loaded.value, targetPath) !== undefined) found.push({ file, value: loaded.value });
  }
  return found;
}

function operationForMapping(manifest, mode, hasCollision) {
  if (mode === 'reference') return 'reference';
  switch (manifest.applicationProfile) {
    case 'reference-only': return null;
    case 'additive': return hasCollision ? null : 'add';
    case 'structured-merge': return hasCollision ? 'adapt' : 'add';
    case 'template-copy': return hasCollision ? null : 'adapt';
    case 'manual': return 'adapt';
    default: return null;
  }
}

function createDryRunPlan({ repoRoot, world, modId, mode }) {
  const registry = validateModRegistry(repoRoot);
  if (registry.errors.length > 0) throw new Error(`Mod registry is invalid:\n${registry.errors.join('\n')}`);
  const mod = registry.modsById.get(modId);
  if (!mod) throw new Error(`Unknown mod id: ${modId}`);
  const manifest = mod.manifest;
  const selectedMode = mode || manifest.defaultMode;
  if (!SUPPORTED_MOD_MODES.has(selectedMode) || !manifest.supportedModes.includes(selectedMode)) {
    throw new Error(`Mod ${modId} does not support mode ${selectedMode}`);
  }
  if (selectedMode === 'apply' && manifest.applicationProfile === 'reference-only') {
    throw new Error(`Mod ${modId} is reference-only and cannot be applied`);
  }
  if (!manifest.compatibleFormats.includes(world.marker.format)) {
    throw new Error(`Mod ${modId} is not compatible with world format ${world.marker.format}`);
  }
  if ((world.marker.appliedMods || []).some((record) => record.modId === modId)) {
    throw new Error(`Mod ${modId} already appears in appliedMods for ${world.marker.id}; do not reapply or update silently.`);
  }

  const payloadCache = new Map();
  const sourcePayloads = manifest.files.map((file) => {
    const loaded = readJsonResult(path.join(mod.modDir, file));
    if (loaded.error) throw new Error(loaded.error);
    payloadCache.set(file, loaded.value);
    return {
      path: file,
      kind: file.endsWith('.json') ? 'json' : 'file',
      topLevelKeys: loaded.value && typeof loaded.value === 'object' && !Array.isArray(loaded.value)
        ? Object.keys(loaded.value).sort()
        : [],
      targets: [],
    };
  });
  const payloadByPath = new Map(sourcePayloads.map((payload) => [payload.path, payload]));
  const proposedOperations = [];
  const conflicts = [];
  const warnings = [...registry.warnings, 'Creative adaptation requires explicit approval and human or specialist-agent judgment.'];

  for (const mapping of manifest.payloadMappings) {
    const payload = payloadCache.get(mapping.file);
    const sourceValue = getByPath(payload, mapping.sourcePath);
    const existing = findExistingTargetFiles(world, mapping.targetPath);
    if (existing.length > 1) {
      conflicts.push({
        source: mapping.file,
        sourcePath: mapping.sourcePath,
        targetFile: existing.map((item) => item.file).join(', '),
        targetPath: mapping.targetPath,
        keys: [mapping.targetPath],
        policy: manifest.conflictPolicy,
        reason: 'The target path already exists in multiple tab files.',
      });
      continue;
    }
    const targetFile = existing[0]?.file || mapping.preferredTargetFile;
    const preferredPath = path.join(world.tabsPath, targetFile);
    const preferredDocument = existing[0]?.value || (fs.existsSync(preferredPath) ? readJsonResult(preferredPath).value || {} : {});
    const targetValue = getByPath(preferredDocument, mapping.targetPath);
    const keys = collisionKeys(sourceValue, targetValue, mapping.targetPath);
    const hasCollision = keys.length > 0;
    if (hasCollision) {
      conflicts.push({
        source: mapping.file,
        sourcePath: mapping.sourcePath,
        targetFile,
        targetPath: mapping.targetPath,
        keys,
        policy: manifest.conflictPolicy,
        reason: 'Existing target content overlaps this payload section.',
      });
    }
    const operationType = operationForMapping(manifest, selectedMode, hasCollision);
    if (operationType) {
      proposedOperations.push({
        type: operationType,
        source: mapping.file,
        sourcePath: mapping.sourcePath,
        targetFile,
        targetPath: mapping.targetPath,
        domain: mapping.domain,
        requiresApproval: true,
        reason: operationType === 'reference'
          ? 'Use as reference only; no target-world write is proposed.'
          : operationType === 'add'
            ? 'No overlapping target content was detected; additive use still requires approval.'
            : 'Manual adaptation is required; no blind copy or replacement is permitted.',
      });
    }
    payloadByPath.get(mapping.file).targets.push({
      sourcePath: mapping.sourcePath,
      targetPath: mapping.targetPath,
      preferredTargetFile: mapping.preferredTargetFile,
      domain: mapping.domain,
      resolvedTargetFile: targetFile,
      collisionKeys: keys,
    });
  }

  const blocked = selectedMode === 'apply' && manifest.conflictPolicy === 'stop' && conflicts.length > 0;
  if (blocked) warnings.push('Apply mode is blocked because conflictPolicy=stop and one or more conflicts were found.');
  const plan = {
    schemaVersion: 1,
    modId: manifest.id,
    modVersion: manifest.version,
    targetWorldId: world.marker.id,
    mode: selectedMode,
    applicationProfile: manifest.applicationProfile,
    conflictPolicy: manifest.conflictPolicy,
    affectedDomains: [...manifest.domains].sort(),
    sourcePayloads,
    proposedOperations,
    conflicts,
    warnings,
    approvalRequired: true,
    blocked,
  };
  const planSchema = path.join(repoRoot, '.world-puppeteer', 'schemas', 'mod-integration-plan.schema.json');
  const planErrors = validateAgainstSchemaFile(plan, planSchema);
  if (planErrors.length > 0) throw new Error(`Dry-run plan failed JSON Schema validation:\n${planErrors.join('\n')}`);
  return { plan, registry, mod };
}

module.exports = {
  createDryRunPlan,
  detectDependencyCycle,
  listModPayloadFiles,
  validateAppliedMods,
  validateModManifest,
  validateModRegistry,
};
