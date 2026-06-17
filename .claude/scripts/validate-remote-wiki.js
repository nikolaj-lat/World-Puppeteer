#!/usr/bin/env node
/*
 * validate-remote-wiki.js — Validate config.json against the unofficial Voyage Wiki schema.
 * EXPERIMENTAL / OPT-IN: hits a third-party endpoint whose behavior and V33 coverage are
 * unverified. Not part of the standard validation flow; treat results as advisory.
 * USAGE:
 *   node .claude/scripts/validate-remote-wiki.js                # validates ./config.json
 *   node .claude/scripts/validate-remote-wiki.js path/to/world.json
 *   node .claude/scripts/validate-remote-wiki.js --json         # raw JSON response
 * Exit: 0 = no errors; 1 = errors found or request failed.
 * API: POST https://voyagewiki.pages.dev/api/validate, Content-Type: application/json,
 *      body = raw world JSON (config.json, no wrapper; max 10 MB).
 *      Response: { counts, errors[], warnings[], recommendations[], validatorVersion };
 *      each issue: { path, title, fix, detail?, value?, message }.
 * NOTE: sends config.json to an external endpoint. Use only with authorization.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ENDPOINT = 'https://voyagewiki.pages.dev/api/validate';
const args = process.argv.slice(2);
const rawJsonOut = args.includes('--json');
const fileArg = args.find((a) => !a.startsWith('--'));
const configPath = path.resolve(fileArg || path.join(__dirname, '..', '..', 'config.json'));

let body;
try { body = fs.readFileSync(configPath, 'utf8'); }
catch (err) { console.error(`Could not read config file: ${configPath}\n  ${err.message}`); process.exit(1); }
try { JSON.parse(body); }
catch (err) { console.error(`Config at ${configPath} is not valid JSON: ${err.message}`); process.exit(1); }
const bytes = Buffer.byteLength(body, 'utf8');
if (bytes > 10 * 1024 * 1024) { console.error(`Config is ${(bytes / 1048576).toFixed(2)} MB; API limit is 10 MB.`); process.exit(1); }

function postWithHttps(url, payload) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const u = new URL(url);
    const req = https.request({
      method: 'POST', hostname: u.hostname, path: u.pathname + u.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'world-puppeteer-validate-remote/1.0',
      },
    }, (res) => {
      let data = ''; res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: data }));
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}
async function post(url, payload) {
  if (typeof fetch === 'function') {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'world-puppeteer-validate-remote/1.0' },
      body: payload,
    });
    const text = await res.text();
    const headers = {}; res.headers.forEach((v, k) => (headers[k] = v));
    return { status: res.status, headers, text };
  }
  return postWithHttps(url, payload);
}
function printIssues(label, list) {
  if (!Array.isArray(list) || list.length === 0) return;
  console.log(`\n${label} (${list.length})`);
  console.log('-'.repeat(60));
  list.forEach((e, i) => {
    const p = e.path || e.pointer || '(root)';
    const msg = e.message || [e.title, e.fix].filter(Boolean).join(' — ') || JSON.stringify(e);
    console.log(`${String(i + 1).padStart(3)}. ${p}`);
    console.log(`     ${msg}`);
    if (e.detail) console.log(`     detail: ${e.detail}`);
    if (e.value !== undefined) console.log(`     value: ${JSON.stringify(e.value)}`);
  });
}
(async () => {
  console.log(`Validating ${configPath} (${(bytes / 1024).toFixed(1)} KB)`);
  console.log(`POST ${ENDPOINT}`);
  let resp;
  try { resp = await post(ENDPOINT, body); }
  catch (err) { console.error(`\nRequest failed: ${err.message}`); process.exit(1); }
  console.log(`HTTP ${resp.status}`);
  if (resp.status === 429) { console.error(`Rate limited. Retry-After: ${resp.headers['retry-after'] || 'unknown'} seconds.`); process.exit(1); }
  let result;
  try { result = JSON.parse(resp.text); }
  catch (err) { console.error(`\nNon-JSON response (HTTP ${resp.status}):`); console.error(resp.text.slice(0, 2000)); process.exit(1); }
  if (rawJsonOut) { console.log(JSON.stringify(result, null, 2)); process.exit(result.counts && result.counts.errors ? 1 : 0); }
  if (resp.status >= 400) { console.error('\nServer returned an error payload:'); console.error(JSON.stringify(result, null, 2)); process.exit(1); }
  const errors = result.errors || [], warnings = result.warnings || [], recommendations = result.recommendations || [];
  const counts = result.counts || { errors: errors.length, warnings: warnings.length, recommendations: recommendations.length };
  printIssues('ERRORS', errors);
  printIssues('WARNINGS', warnings);
  printIssues('RECOMMENDATIONS', recommendations);
  console.log('\n' + '='.repeat(60));
  console.log(`Summary: ${counts.errors || 0} errors, ${counts.warnings || 0} warnings, ${counts.recommendations || 0} recommendations`);
  if (result.validatorVersion) console.log(`Validator version: ${result.validatorVersion}`);
  if ((counts.errors || 0) > 0) { console.log('RESULT: FAIL'); process.exit(1); }
  console.log('RESULT: PASS'); process.exit(0);
})();
