#!/usr/bin/env node

/**
 * Voyage World Config Pretty Print Tool
 *
 * Formats all JSON files in a resolved world's tabs directory with consistent
 * 2-space indentation.
 *
 * Usage:
 *   node pretty-print.js [tabs-directory]
 *   node pretty-print.js --world <world-root>
 */

const fs = require('fs');
const path = require('path');
const {
  listTabJsonFiles,
  pathKey,
  resolveWorld,
  runTransactionalFileMutation,
} = require('./world-puppeteer-lib.cjs');
const { parseStrictArgs } = require('./cli-utils.cjs');

function usage() {
  return 'Usage: node .claude/scripts/pretty-print.js [tabs-directory | --world <world-root>]';
}

function resolvePrettyPrintTarget(options = {}) {
  const {
    cwd = process.cwd(),
    fsImpl = fs,
    resolveWorldImpl = resolveWorld,
    cliOptions = {},
    positionals = [],
  } = options;

  if (cliOptions.worldRoot && positionals.length > 0) {
    throw new Error('--world cannot be combined with a positional input path');
  }

  if (cliOptions.worldRoot) {
    const resolved = resolveWorldImpl({
      worldRoot: cliOptions.worldRoot,
      cwd,
      preferNearest: false,
    });
    return {
      inputLabel: cliOptions.worldRoot,
      tabsPath: resolved.tabsPath,
    };
  }

  if (positionals.length > 0) {
    const inputLabel = positionals[0];
    const candidatePath = path.resolve(cwd, inputLabel);
    if (!fsImpl.existsSync(candidatePath)) {
      throw new Error(`Directory not found: ${inputLabel}`);
    }

    if (fsImpl.existsSync(path.join(candidatePath, '.world-puppeteer.json'))) {
      const resolved = resolveWorldImpl({
        worldRoot: candidatePath,
        cwd: candidatePath,
        preferNearest: false,
      });
      return {
        inputLabel,
        tabsPath: resolved.tabsPath,
      };
    }

    const resolved = resolveWorldImpl({
      cwd: candidatePath,
      preferNearest: true,
    });
    if (pathKey(candidatePath) !== pathKey(resolved.tabsPath)) {
      throw new Error(
        `Positional path must resolve to a world tabs directory: ${inputLabel}`
      );
    }

    return {
      inputLabel,
      tabsPath: resolved.tabsPath,
    };
  }

  const resolved = resolveWorldImpl({ cwd, preferNearest: true });
  return {
    inputLabel: resolved.tabsPath,
    tabsPath: resolved.tabsPath,
  };
}

function planPrettyPrint(tabsPath, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const jsonFiles = listTabJsonFiles(tabsPath);
  if (jsonFiles.length === 0) {
    throw new Error(`No JSON files found in ${tabsPath}`);
  }

  const formattedWrites = [];
  const formattedFiles = [];
  const unchangedFiles = [];
  const errors = [];

  for (const file of jsonFiles) {
    const filePath = path.join(tabsPath, file);
    try {
      const content = fsImpl.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      const pretty = JSON.stringify(parsed, null, 2) + '\n';

      if (content === pretty) {
        unchangedFiles.push(file);
        continue;
      }

      formattedFiles.push(file);
      formattedWrites.push({ path: filePath, content: pretty });
    } catch (error) {
      errors.push(`error: ${file} - ${error.message}`);
    }
  }

  return {
    tabsPath,
    jsonFiles,
    formattedWrites,
    formattedFiles,
    unchangedFiles,
    errors,
  };
}

function formatPrettyPrintTarget(target, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const plan = planPrettyPrint(target.tabsPath, { fsImpl });

  if (plan.errors.length > 0) {
    return {
      status: 1,
      formattedFiles: [],
      unchangedFiles: plan.unchangedFiles,
      errors: plan.errors,
    };
  }

  runTransactionalFileMutation(plan.formattedWrites, () => undefined, {
    fs: fsImpl,
  });

  return {
    status: 0,
    formattedFiles: plan.formattedFiles,
    unchangedFiles: plan.unchangedFiles,
    errors: [],
  };
}

function printPrettyPrintResult(result) {
  for (const error of result.errors) {
    console.error(error);
  }

  for (const file of result.formattedFiles) {
    console.log(`formatted: ${file}`);
  }

  console.log(
    `\n${result.formattedFiles.length} formatted, ` +
      `${result.unchangedFiles.length} unchanged, ` +
      `${result.errors.length} errors`
  );
}

function main(argv = process.argv.slice(2), options = {}) {
  const { options: cliOptions, positionals } = parseStrictArgs(argv, {
    options: {
      '--world': { key: 'worldRoot', takesValue: true },
      '--help': { key: 'help', aliases: ['-h'] },
    },
    maxPositionals: 1,
  });

  if (cliOptions.help) {
    console.log(usage());
    return 0;
  }

  const target = resolvePrettyPrintTarget({
    cwd: options.cwd || process.cwd(),
    fsImpl: options.fsImpl || fs,
    resolveWorldImpl: options.resolveWorldImpl || resolveWorld,
    cliOptions,
    positionals,
  });
  const result = formatPrettyPrintTarget(target, {
    fsImpl: options.fsImpl || fs,
  });
  printPrettyPrintResult(result);
  return result.status;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  formatPrettyPrintTarget,
  main,
  planPrettyPrint,
  resolvePrettyPrintTarget,
};
