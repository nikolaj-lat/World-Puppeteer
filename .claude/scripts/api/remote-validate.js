#!/usr/bin/env node
'use strict';

/*
 * Remote engine validation of a merged world config via POST /validate.
 *
 * Usage:
 *   node .claude/scripts/api/remote-validate.js [config.json] [--stage draft|publish] [--json]
 *
 * With no file argument the current tabs are merged in memory.
 * Exit codes: 0 = ran (regardless of findings; check the JSON), 3 = remote
 * unavailable (off toggle, missing key, network, rate limit) - callers fall
 * back to local-only validation.
 * JSON shape: { available, stage, valid, errors: [{code,message,path}], warnings: [...] }
 */

const fs = require('fs');
const { apiRequest, isConfigured, loadState } = require('./shared');
const { mergeTabs } = require('./tabs');

function isDisabled() {
  if ((process.env.WP_REMOTE_VALIDATE || '').toLowerCase() === 'off') return 'WP_REMOTE_VALIDATE=off';
  if (loadState().remoteValidation === 'off') return 'state remoteValidation off';
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json');
  const stageIdx = args.indexOf('--stage');
  const stage = stageIdx >= 0 ? args[stageIdx + 1] : 'draft';
  const fileArg = args.find((a) => !a.startsWith('--') && a !== stage);

  const emit = (result, exitCode) => {
    // configured = a key exists in secrets.env; callers use it to decide whether
    // a non-running remote is worth mentioning at all
    result.configured = isConfigured();
    if (jsonOut) console.log(JSON.stringify(result));
    else {
      if (!result.available) console.log(`remote validation unavailable: ${result.reason}`);
      else {
        console.log(`remote ${result.stage} validation: ${result.valid ? 'VALID' : `${result.errors.length} error(s)`}, ${result.warnings.length} warning(s)`);
        for (const issue of result.errors) console.log(`  ERROR ${issue.code} ${issue.path}: ${issue.message}`);
        for (const issue of result.warnings) console.log(`  warn  ${issue.code} ${issue.path}: ${issue.message}`);
      }
    }
    process.exit(exitCode);
  };

  const disabled = isDisabled();
  if (disabled) emit({ available: false, reason: disabled }, 3);
  if (!isConfigured()) emit({ available: false, reason: 'no API key configured (see SETUP.md)' }, 3);

  let initialGameState;
  try {
    initialGameState = fileArg ? JSON.parse(fs.readFileSync(fileArg, 'utf8')) : mergeTabs();
  } catch (err) {
    emit({ available: false, reason: `could not read config: ${err.message}` }, 3);
  }

  try {
    const response = await apiRequest({
      method: 'POST',
      path: '/validate',
      body: { stage, world: { initialGameState } },
      idempotent: false,
      timeoutMs: 30_000,
    });
    const data = response.json?.data ?? {};
    emit({
      available: true,
      stage: data.stage ?? stage,
      valid: Boolean(data.valid),
      errors: data.errors ?? [],
      warnings: data.warnings ?? [],
    }, 0);
  } catch (err) {
    emit({ available: false, reason: err.message }, 3);
  }
}

main();
