#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  readJsonResult,
  validateAgainstSchemaFile,
} = require('./schema-utils.cjs');
const {
  assertNoSymlinkComponents,
  findRepoRoot,
  isInside,
  isSafeRelativePath,
  resolveContainedPath,
} = require('./world-puppeteer-lib.cjs');
const { parseStrictArgs } = require('./cli-utils.cjs');

const NON_PAYLOAD_FILES = new Set(['pack.json', 'README.md']);
const REPORT_ROOT = path.join('.world-puppeteer', 'reports', 'reference-packs');

function normalizeRelative(value) {
  return value.replace(/\\/g, '/');
}

function getByPath(value, dottedPath) {
  if (!dottedPath) return value;
  return dottedPath.split('.').reduce((current, segment) => {
    if (current === undefined || current === null) return undefined;
    return current[segment];
  }, value);
}

function assertSafeDirectory(dirPath, label) {
  const stat = fs.lstatSync(dirPath);
  if (!stat.isDirectory()) throw new Error(`${label}: not a directory`);
  if (stat.isSymbolicLink()) throw new Error(`${label}: symlinked directories are not allowed`);
}

function validatePayloadPath(packDir, relativePath) {
  try {
    resolveContainedPath({
      rootPath: packDir,
      relativePath,
      field: `payload path ${relativePath}`,
      kind: 'input',
      expectedType: 'file',
    });
  } catch (error) {
    return error.message;
  }
  return null;
}

function validateContainedRegularFile(rootDir, filePath, label) {
  try {
    resolveContainedPath({
      rootPath: rootDir,
      relativePath: path.relative(rootDir, filePath),
      field: label,
      kind: 'input',
      expectedType: 'file',
    });
  } catch (error) {
    return error.message;
  }
  return null;
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

function listReferencePackPayloadFiles(packDir) {
  return listFilesRecursive(packDir)
    .map((file) => normalizeRelative(path.relative(packDir, file)))
    .filter((relative) => !NON_PAYLOAD_FILES.has(relative))
    .sort();
}

function validateReferencePackManifest(packDir, repoRoot) {
  const errors = [];
  const warnings = [];
  const packsRoot = path.join(repoRoot, '.world-puppeteer', 'reference-packs');

  try {
    assertSafeDirectory(packsRoot, packsRoot);
    assertSafeDirectory(packDir, packDir);
    const lexicalPack = path.resolve(packDir);
    if (!isInside(lexicalPack, packsRoot)) {
      throw new Error(`${packDir}: pack directory escapes reference-packs root`);
    }
    const realPacksRoot = fs.realpathSync(packsRoot);
    const realPack = fs.realpathSync(packDir);
    if (!isInside(realPack, realPacksRoot)) {
      throw new Error(`${packDir}: pack directory realpath escapes reference-packs root`);
    }
  } catch (error) {
    return { manifest: null, errors: [error.message], warnings };
  }

  const manifestPath = path.join(packDir, 'pack.json');
  const readmePath = path.join(packDir, 'README.md');
  const manifestFileError = validateContainedRegularFile(packDir, manifestPath, manifestPath);
  const readmeFileError = validateContainedRegularFile(packDir, readmePath, readmePath);
  if (manifestFileError) errors.push(manifestFileError);
  if (readmeFileError) errors.push(readmeFileError);
  if (manifestFileError) return { manifest: null, errors, warnings, packDir, manifestPath };

  const loaded = readJsonResult(manifestPath);
  if (loaded.error) return { manifest: null, errors: [...errors, loaded.error], warnings, packDir, manifestPath };
  const manifest = loaded.value;
  errors.push(...validateAgainstSchemaFile(
    manifest,
    path.join(repoRoot, '.world-puppeteer', 'schemas', 'reference-pack.schema.json')
  ));

  const actualPayloads = listReferencePackPayloadFiles(packDir);
  const listedPayloads = new Set();
  const safePayloads = new Set();

  for (const [index, file] of (manifest.files || []).entries()) {
    const normalized = normalizeRelative(file);
    if (listedPayloads.has(normalized)) {
      errors.push(`${manifestPath}: duplicate files entry ${normalized}`);
    }
    listedPayloads.add(normalized);

    const pathError = validatePayloadPath(packDir, normalized);
    if (pathError) {
      errors.push(`${manifestPath}: files[${index}]: ${pathError}`);
    } else {
      safePayloads.add(normalized);
    }
  }

  for (const actual of actualPayloads) {
    if (!listedPayloads.has(actual)) {
      const pathError = validatePayloadPath(packDir, actual);
      if (pathError) errors.push(`${manifestPath}: unlisted payload: ${pathError}`);
      errors.push(`${manifestPath}: payload file not listed in files: ${actual}`);
    }
  }

  for (const listed of listedPayloads) {
    if (!actualPayloads.includes(listed)) {
      errors.push(`${manifestPath}: files entry is not a payload file: ${listed}`);
    }
  }

  for (const [index, section] of (manifest.sourceSections || []).entries()) {
    const normalizedFile = normalizeRelative(section.file || '');
    if (!listedPayloads.has(normalizedFile)) {
      errors.push(`${manifestPath}: sourceSections[${index}].file is not listed in files: ${section.file}`);
      continue;
    }
    if (!safePayloads.has(normalizedFile)) {
      errors.push(`${manifestPath}: sourceSections[${index}].file is not a validated safe payload: ${section.file}`);
      continue;
    }
    if (section.domain && !(manifest.domains || []).includes(section.domain)) {
      errors.push(`${manifestPath}: sourceSections[${index}].domain is not declared: ${section.domain}`);
    }
    const payload = readJsonResult(path.join(packDir, normalizedFile));
    if (payload.error) {
      errors.push(payload.error);
    } else if (getByPath(payload.value, section.sourcePath) === undefined) {
      errors.push(`${manifestPath}: sourceSections[${index}].sourcePath not found in ${section.file}: ${section.sourcePath}`);
    }
  }

  return { manifest, errors, warnings, packDir, manifestPath };
}

function validateReferencePackRegistry(repoRoot) {
  const packsRoot = path.join(repoRoot, '.world-puppeteer', 'reference-packs');
  const errors = [];
  const warnings = [];
  const packsById = new Map();
  if (!fs.existsSync(packsRoot)) {
    return { errors: [`${packsRoot}: missing reference-packs root`], warnings, packsById, packsRoot };
  }

  try {
    assertSafeDirectory(packsRoot, packsRoot);
    const realRepoRoot = fs.realpathSync(repoRoot);
    const realPacksRoot = fs.realpathSync(packsRoot);
    if (!isInside(realPacksRoot, realRepoRoot)) {
      throw new Error(`${packsRoot}: realpath escapes repository root`);
    }
  } catch (error) {
    errors.push(error.message);
    return { errors, warnings, packsById, packsRoot };
  }

  for (const entry of fs.readdirSync(packsRoot, { withFileTypes: true })) {
    if (entry.name === 'index.json') continue;
    const entryPath = path.join(packsRoot, entry.name);

    if (entry.isSymbolicLink()) {
      errors.push(`${entryPath}: symlinked reference-pack entries are not allowed`);
      continue;
    }
    if (!entry.isDirectory()) {
      errors.push(`${entryPath}: unexpected non-directory entry in reference-packs root`);
      continue;
    }

    const result = validateReferencePackManifest(entryPath, repoRoot);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (!result.manifest) continue;
    if (packsById.has(result.manifest.id)) {
      errors.push(`${entryPath}: duplicate reference pack id ${result.manifest.id}`);
    } else {
      packsById.set(result.manifest.id, { ...result, dirName: entry.name });
    }
  }

  const indexPath = path.join(packsRoot, 'index.json');
  const indexFileError = validateContainedRegularFile(packsRoot, indexPath, indexPath);
  if (indexFileError) {
    errors.push(indexFileError);
  } else {
    const indexLoaded = readJsonResult(indexPath);
    if (indexLoaded.error) {
      errors.push(indexLoaded.error);
    } else {
      const index = indexLoaded.value;
      errors.push(...validateAgainstSchemaFile(
        index,
        path.join(repoRoot, '.world-puppeteer', 'schemas', 'reference-pack-index.schema.json')
      ));
      const seen = new Set();
      for (const id of index.packs || []) {
        if (seen.has(id)) errors.push(`${indexPath}: duplicate registry entry ${id}`);
        seen.add(id);
        if (!packsById.has(id)) errors.push(`${indexPath}: unknown reference pack id ${id}`);
      }
      for (const [id, entry] of packsById) {
        if (!seen.has(id)) {
          errors.push(`${indexPath}: reference pack directory not represented in registry: ${entry.dirName}`);
        }
      }
    }
  }

  return { errors, warnings, packsById, packsRoot };
}

function safeReportPath(repoRoot, outputPath) {
  const lexicalRepoRoot = path.resolve(repoRoot);
  const reportRoot = path.resolve(lexicalRepoRoot, REPORT_ROOT);
  const requested = path.isAbsolute(outputPath)
    ? path.resolve(outputPath)
    : path.resolve(lexicalRepoRoot, outputPath);

  if (!isInside(reportRoot, lexicalRepoRoot)) {
    throw new Error(`configured report root escapes repository: ${REPORT_ROOT}`);
  }
  if (!isInside(requested, reportRoot)) {
    throw new Error(`report output must stay under ${REPORT_ROOT}: ${outputPath}`);
  }

  const forbidden = ['tabs', '.agents', '.claude', 'schemas'];
  for (const segment of forbidden) {
    if (requested.split(path.sep).includes(segment)) {
      throw new Error(`report output may not target protected world/tooling content: ${outputPath}`);
    }
  }

  const parent = path.dirname(requested);
  assertNoSymlinkComponents(lexicalRepoRoot, parent, 'report output', {
    requireDirectoryComponent: true,
  });
  fs.mkdirSync(parent, { recursive: true });
  assertNoSymlinkComponents(lexicalRepoRoot, parent, 'report output', {
    requireDirectoryComponent: true,
  });

  const realRepoRoot = fs.realpathSync(lexicalRepoRoot);
  const realReportRoot = fs.realpathSync(reportRoot);
  const realParent = fs.realpathSync(parent);

  if (!isInside(realReportRoot, realRepoRoot)) {
    throw new Error(`report root realpath escapes repository: ${REPORT_ROOT}`);
  }
  if (!isInside(realParent, realReportRoot)) {
    throw new Error(`report output realpath escapes ${REPORT_ROOT}: ${outputPath}`);
  }

  if (fs.existsSync(requested)) {
    const stat = fs.lstatSync(requested);
    if (stat.isSymbolicLink()) {
      throw new Error(`report output may not replace a symlink: ${outputPath}`);
    }
    if (!stat.isFile()) {
      throw new Error(`report output must be a regular file: ${outputPath}`);
    }
    const realRequested = fs.realpathSync(requested);
    if (!isInside(realRequested, realReportRoot)) {
      throw new Error(`existing report output realpath escapes ${REPORT_ROOT}: ${outputPath}`);
    }
  }

  return requested;
}

function inspectReferencePack({ repoRoot = findRepoRoot(process.cwd()), packId, outputPath = null } = {}) {
  const registry = validateReferencePackRegistry(repoRoot);
  if (registry.errors.length > 0) throw new Error(`Reference-pack registry is invalid:\n${registry.errors.join('\n')}`);
  const pack = registry.packsById.get(packId);
  if (!pack) throw new Error(`Unknown reference pack id: ${packId}`);
  const report = {
    schemaVersion: 1,
    packId: pack.manifest.id,
    name: pack.manifest.name,
    domains: [...pack.manifest.domains].sort(),
    files: [...pack.manifest.files].sort(),
    sourceSections: pack.manifest.sourceSections || [],
    warnings: registry.warnings,
    readOnly: true,
    recommendation: 'Use the relevant domain specialist for any later approved manual adaptation.',
  };
  if (outputPath) {
    const safePath = safeReportPath(repoRoot, outputPath);
    fs.writeFileSync(safePath, JSON.stringify(report, null, 2) + '\n');
    report.outputPath = safePath;
  }
  return { report, registry, pack };
}

module.exports = {
  REPORT_ROOT,
  inspectReferencePack,
  isSafeRelativePath,
  listReferencePackPayloadFiles,
  safeReportPath,
  validateReferencePackManifest,
  validateReferencePackRegistry,
};

function runCli(argv = process.argv.slice(2)) {
  const { options, positionals } = parseStrictArgs(
    argv,
    {
      options: {
        '--pack': { key: 'packId', takesValue: true },
        '--output': { key: 'outputPath', takesValue: true },
        '--json': { key: 'json' },
        '--help': { key: 'help', aliases: ['-h'] },
      },
      maxPositionals: 1,
    }
  );

  const command = positionals[0] || 'validate';

  if (options.help) {
    console.log(
      'Usage:\n' +
      '  node .claude/scripts/reference-pack-architecture.cjs validate [--json]\n' +
      '  node .claude/scripts/reference-pack-architecture.cjs inspect ' +
      '--pack <pack-id> [--output <report-path>] [--json]'
    );
    return 0;
  }

  const repoRoot = findRepoRoot(process.cwd());

  if (command === 'validate') {
    if (options.packId || options.outputPath) {
      throw new Error('validate does not accept --pack or --output');
    }
    const result = validateReferencePackRegistry(repoRoot);
    if (options.json) {
      console.log(JSON.stringify({
        errors: result.errors,
        warnings: result.warnings,
        packs: Array.from(result.packsById.keys()).sort(),
      }, null, 2));
    } else {
      for (const warning of result.warnings) {
        console.warn(`warning: ${warning}`);
      }
      for (const error of result.errors) {
        console.error(`error: ${error}`);
      }
      if (result.errors.length === 0) {
        console.log(`Reference packs: ${result.packsById.size}`);
      }
    }
    return result.errors.length > 0 ? 1 : 0;
  }

  if (command === 'inspect') {
    if (!options.packId) throw new Error('inspect requires --pack <pack-id>');
    const { report } = inspectReferencePack({
      repoRoot,
      packId: options.packId,
      outputPath: options.outputPath || null,
    });
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Reference pack: ${report.name} (${report.packId})`);
      console.log(`Domains: ${report.domains.join(', ')}`);
      console.log(`Payload files: ${report.files.length}`);
      if (report.outputPath) console.log(`Report: ${report.outputPath}`);
    }
    return 0;
  }

  throw new Error(`Unknown command: ${command}`);
}

if (require.main === module) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}
