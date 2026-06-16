#!/usr/bin/env node

const {
  runNameFilterCli,
} = require('../../../../.claude/scripts/name-filter-tool.cjs');

const INVOCATION_PATH =
  '.agents/skills/name-filter-settings/scripts/name-filter.js';

if (require.main === module) {
  runNameFilterCli({
    argv: process.argv.slice(2),
    invocationPath: INVOCATION_PATH,
  });
}

module.exports = {
  INVOCATION_PATH,
  runNameFilterCli,
};
