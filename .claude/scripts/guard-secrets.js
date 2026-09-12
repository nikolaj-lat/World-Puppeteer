#!/usr/bin/env node
'use strict';

/*
 * PreToolUse hook: hard-deny agent access to .env secrets files.
 *
 * - Any Bash command whose string references a .env file is denied.
 * - Read/Edit/Write/Grep targeting a .env file path is denied.
 *
 * The API client scripts are unaffected: they run as child processes of
 * commands that never mention the file, and parse .claude/secrets.env
 * directly. This is accident prevention, not an OS boundary; the scripts
 * additionally never echo the key and redact it from error output.
 */

const fs = require('fs');

let input = '';
try {
  input = fs.readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let data;
try {
  data = JSON.parse(input);
} catch {
  process.exit(0);
}

const toolName = data.tool_name || '';
const toolInput = data.tool_input || {};

const deny = (reason) => {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
};

// Hard block: any Bash command referencing .env files
if (toolName === 'Bash') {
  const cmd = String(toolInput.command ?? '');
  if (/\.env\b/.test(cmd)) {
    deny('.env contains secrets — access blocked.');
  }
}

// Hard block: never allow file tools on .env paths
if (['Read', 'Edit', 'Write', 'NotebookEdit'].includes(toolName)) {
  const filePath = String(toolInput.file_path ?? toolInput.notebook_path ?? '');
  if (/\.env$/.test(filePath)) {
    deny('.env contains secrets — access blocked.');
  }
}

if (toolName === 'Grep') {
  const target = String(toolInput.path ?? '');
  if (/\.env$/.test(target)) {
    deny('.env contains secrets — access blocked.');
  }
}

process.exit(0);
