#!/usr/bin/env node
'use strict';

/*
 * Paid AI image generation through the Creator API (spends the Voyage plan's
 * Studio usage). Always runs a usage pre-flight first.
 *
 * Usage:
 *   node .claude/scripts/api/generate-image.js --type <area|location|npc|region-map> --payload <request.json> [--force]
 *
 * The payload file is the request body for the endpoint (see the API's
 * openapi.json for per-type fields; npc requires npcName and npcType).
 * Pre-flight: GET /usage is printed before spending. If .creator-api.json
 * sets "usageGuard": 20, generation refuses when the plan's remaining Studio AI
 * usage (data.status.remainingPercent, 0-100) is below that, unless --force is
 * passed. The long form { "path": "data...", "min": N } guards any other field.
 * Local Gemini generation (skills/image-gen) remains available and free;
 * this endpoint exists for engine-native, usage-billed generation.
 */

const fs = require('fs');
const { apiRequest, loadState } = require('./shared');

const TYPES = ['area', 'location', 'npc', 'region-map'];

function readPath(obj, dotted) {
  return dotted.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

async function main() {
  const args = process.argv.slice(2);
  const type = args[args.indexOf('--type') + 1];
  const payloadPath = args[args.indexOf('--payload') + 1];
  const force = args.includes('--force');

  if (!TYPES.includes(type) || !payloadPath) {
    console.error(`Usage: node .claude/scripts/api/generate-image.js --type <${TYPES.join('|')}> --payload <request.json> [--force]`);
    process.exit(1);
  }
  const state = loadState();
  if (!state.shortId) {
    console.error('No world pinned; run pull first.');
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

  // Usage pre-flight (always printed before spending).
  const usage = await apiRequest({ method: 'GET', path: '/usage' });
  console.log('Current Studio AI usage:');
  console.log(JSON.stringify(usage.json?.data ?? usage.json, null, 2));
  // usageGuard: a number guards data.status.remainingPercent (0-100);
  // the long form { path, min } guards any field in the usage response.
  const guard = typeof state.usageGuard === 'number'
    ? { path: 'data.status.remainingPercent', min: state.usageGuard }
    : state.usageGuard;
  if (guard?.path && typeof guard.min === 'number') {
    const remaining = readPath(usage.json, guard.path);
    if (typeof remaining === 'number' && remaining < guard.min) {
      if (!force) {
        console.error(`Refusing: ${guard.path} is ${remaining}, below the configured minimum ${guard.min}. Pass --force to override.`);
        process.exit(1);
      }
      console.log(`Proceeding despite low usage (${remaining} < ${guard.min}) because --force was passed.`);
    }
  }

  const response = await apiRequest({
    method: 'POST',
    path: `/worlds/${encodeURIComponent(state.shortId)}/images/${type}`,
    body: payload,
    timeoutMs: 180_000,
  });
  const data = response.json?.data ?? response.json;
  console.log('\nGeneration result:');
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  if (err.code === 'paid_plan_required') {
    console.error('AI media generation requires a paid Voyage plan on this account.');
  } else {
    console.error(`generate failed: ${err.message}`);
  }
  process.exit(1);
});
