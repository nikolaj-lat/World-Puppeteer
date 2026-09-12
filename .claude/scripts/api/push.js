#!/usr/bin/env node
'use strict';

/*
 * Push the merged tabs to the pinned world as a full draft replace.
 *
 * Usage:
 *   node .claude/scripts/api/push.js            # report: validation + diff, no write
 *   node .claude/scripts/api/push.js --confirm  # perform the PUT (only after human go-ahead)
 *
 * Flow: merge tabs -> remote publish-stage validate -> local validate (wp-only
 * errors block; mirror findings defer to remote) -> fetch remote + diff report
 * (local changes since last sync AND remote drift that would be overwritten)
 * -> with --confirm: PUT with If-Match, re-read, verify, update state.
 * A 412 means the remote moved mid-flight: pull, reconcile, push again. Never
 * bypass it.
 */

const path = require('path');
const { execFileSync } = require('child_process');
const { apiRequest, canonicalJson, loadState, saveState, sha256, PROJECT_ROOT } = require('./shared');
const { mergeTabs } = require('./tabs');

function runJson(script, args) {
  try {
    const out = execFileSync('node', [script, ...args], { cwd: PROJECT_ROOT, encoding: 'utf8' });
    return JSON.parse(out);
  } catch (err) {
    if (err.stdout) {
      try { return JSON.parse(err.stdout); } catch { /* fall through */ }
    }
    return null;
  }
}

function sectionDiffSummary(labelA, a, labelB, b) {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  const changed = [];
  for (const key of [...keys].sort()) {
    // canonical (key-sorted) comparison so pure key-order differences never
    // show up as changes
    const left = a?.[key] === undefined ? undefined : canonicalJson(a[key]);
    const right = b?.[key] === undefined ? undefined : canonicalJson(b[key]);
    if (left !== right) {
      changed.push(`  ${key}: ${left === undefined ? 'absent' : `${left.length} chars`} (${labelA}) -> ${right === undefined ? 'absent' : `${right.length} chars`} (${labelB})`);
    }
  }
  return changed;
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const state = loadState();
  if (!state.shortId) {
    console.error('No world pinned; run pull first (it writes .creator-api.json).');
    process.exit(1);
  }

  const candidate = mergeTabs();
  const candidateHash = sha256(canonicalJson(candidate));

  // 1. Remote publish-stage validation (authoritative). No file argument:
  //    remote-validate merges the tabs itself, byte-identical to `candidate`.
  const remote = runJson(path.join(__dirname, 'remote-validate.js'), ['--stage', 'publish', '--json']);
  const remoteAvailable = remote?.available === true;
  if (remoteAvailable && remote.errors.length > 0) {
    console.error(`Remote publish-stage validation failed with ${remote.errors.length} error(s):`);
    for (const issue of remote.errors) console.error(`  ${issue.code} ${issue.path}: ${issue.message}`);
    process.exit(1);
  }
  if (!remoteAvailable) console.log(`NOTE: remote validation unavailable (${remote?.reason ?? 'unknown'}); relying on local validation only.`);

  // 2. Local validation. When remote is reachable and clean, mirror-category
  //    findings defer to it; wp-only findings always block.
  // No file argument: validate.js merges the tabs directory itself.
  const local = runJson(path.join(__dirname, '..', 'validate.js'), ['--json']);
  if (!local) {
    console.error('Local validator produced no parseable output; fix that before pushing.');
    process.exit(1);
  }
  const blockingLocal = (local.errors ?? []).filter((e) => !remoteAvailable || e.category !== 'mirror');
  if (blockingLocal.length > 0) {
    console.error(`Local validation failed with ${blockingLocal.length} blocking error(s):`);
    for (const issue of blockingLocal.slice(0, 40)) console.error(`  ${issue.path}: ${issue.message}`);
    process.exit(1);
  }

  // 3. Fetch remote for etag + drift report.
  const response = await apiRequest({ method: 'GET', path: `/worlds/${encodeURIComponent(state.shortId)}` });
  const world = response.json?.data?.world ?? response.json?.data;
  const etag = response.headers.get('etag');
  const remoteHash = sha256(canonicalJson(world.initialGameState));

  if (remoteHash === candidateHash) {
    saveState({ lastSyncedAt: new Date().toISOString(), lastSyncedHash: candidateHash });
    console.log('Remote already matches local tabs. Nothing to push.');
    return;
  }

  const baseKnown = Boolean(state.lastSyncedHash);
  const remoteDrifted = baseKnown && remoteHash !== state.lastSyncedHash;
  console.log(`World: ${state.shortId} ("${world.title}")`);
  console.log(`Local changes vs remote (section level):`);
  const changes = sectionDiffSummary('remote', world.initialGameState, 'local', candidate);
  console.log(changes.length ? changes.join('\n') : '  (none at section level)');
  if (remoteDrifted) {
    console.log('\nWARNING: the remote has drifted since the last sync (edits made outside WP).');
    console.log('Pushing will overwrite that drift. Server revision history retains it.');
  } else if (!baseKnown) {
    console.log('\nNOTE: no last-synced baseline recorded; treat the diff above as the full picture.');
  }

  if (!confirm) {
    console.log('\nDry run. Relay this report for a human go-ahead, then re-run with --confirm.');
    process.exit(2);
  }

  // 4. Full replace, metadata preserved, only initialGameState swapped.
  await apiRequest({
    method: 'PUT',
    path: `/worlds/${encodeURIComponent(state.shortId)}`,
    body: { world: { ...world, initialGameState: candidate } },
    etag,
  });

  // 5. Verify by re-reading.
  const verify = await apiRequest({ method: 'GET', path: `/worlds/${encodeURIComponent(state.shortId)}` });
  const verifiedWorld = verify.json?.data?.world ?? verify.json?.data;
  const verifiedHash = sha256(canonicalJson(verifiedWorld.initialGameState));
  if (verifiedHash !== candidateHash) {
    console.error('Push completed but the re-read does not match what was sent. Investigate before editing further.');
    process.exit(1);
  }
  saveState({ lastSyncedAt: new Date().toISOString(), lastSyncedHash: candidateHash });
  console.log('Pushed and verified.');
}

main().catch((err) => {
  if (err.status === 412) {
    console.error('Push rejected: the remote changed under you (412 revision_conflict).');
    console.error('Run pull, reconcile the drift, then push again. Never retry blindly.');
  } else {
    console.error(`push failed: ${err.message}`);
  }
  process.exit(1);
});
