#!/usr/bin/env node
'use strict';

/*
 * Report-only pre-publish moderation preflight. WP has NO publish capability
 * by design; once this is clean, publishing happens in Voyage Studio.
 *
 * Usage:
 *   node .claude/scripts/api/moderation.js         # read current moderation state
 *   node .claude/scripts/api/moderation.js --run   # trigger a fresh moderation pass
 *
 * --run uses the costly rate bucket (20/min account-wide).
 */

const { apiRequest, loadState } = require('./shared');

async function main() {
  const run = process.argv.includes('--run');
  const state = loadState();
  if (!state.shortId) {
    console.error('No world pinned; run pull first.');
    process.exit(1);
  }
  const basePath = `/worlds/${encodeURIComponent(state.shortId)}/moderation`;
  const response = run
    ? await apiRequest({ method: 'POST', path: basePath, body: {}, timeoutMs: 120_000 })
    : await apiRequest({ method: 'GET', path: basePath });
  console.log(`Moderation ${run ? 'run result' : 'state'} for ${state.shortId}:`);
  console.log(JSON.stringify(response.json?.data ?? response.json, null, 2));
  console.log('\nReminder: World Puppeteer cannot publish. When this is clean, publish in Voyage Studio.');
}

main().catch((err) => {
  console.error(`moderation failed: ${err.message}`);
  process.exit(1);
});
