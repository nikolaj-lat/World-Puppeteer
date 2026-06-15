'use strict';

function parseStrictArgs(argv, spec = {}) {
  const definitions = spec.options || {};
  const byFlag = new Map();

  for (const [flag, definition] of Object.entries(definitions)) {
    if (!flag.startsWith('-')) {
      throw new Error(`Invalid CLI option definition: ${flag}`);
    }
    const normalized = {
      key: definition.key,
      takesValue: definition.takesValue === true,
      aliases: definition.aliases || [],
    };
    if (!normalized.key) {
      throw new Error(`CLI option ${flag} is missing a key`);
    }

    for (const candidate of [flag, ...normalized.aliases]) {
      if (byFlag.has(candidate)) {
        throw new Error(`Duplicate CLI option definition: ${candidate}`);
      }
      byFlag.set(candidate, { canonical: flag, ...normalized });
    }
  }

  const options = {};
  const positionals = [];
  const seen = new Set();
  let positionalOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!positionalOnly && argument === '--') {
      positionalOnly = true;
      continue;
    }

    if (!positionalOnly && argument.startsWith('-')) {
      const definition = byFlag.get(argument);
      if (!definition) throw new Error(`Unknown option: ${argument}`);
      if (seen.has(definition.canonical)) {
        throw new Error(`${definition.canonical} may be provided only once`);
      }
      seen.add(definition.canonical);

      if (definition.takesValue) {
        const value = argv[++index];
        if (!value || value.startsWith('-')) {
          throw new Error(`${definition.canonical} requires a value`);
        }
        options[definition.key] = value;
      } else {
        options[definition.key] = true;
      }
      continue;
    }

    positionals.push(argument);
    const maxPositionals = spec.maxPositionals ?? 0;
    if (positionals.length > maxPositionals) {
      throw new Error(`Unexpected positional argument: ${argument}`);
    }
  }

  return { options, positionals };
}

module.exports = { parseStrictArgs };
