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
 *
 * Mod checkouts (kind 'mod'): the report also shows the mod's current patch
 * scope (GET /mods/{id}/changes) and WARNS (never blocks) about edits or
 * deletions of content outside that scope - default template content that
 * would change or vanish in every host world - and about any edit to an
 * aiInstructions.<task>.custom key. After a confirmed push it prints the new
 * scope and what entered it.
 */

const path = require('path');
const { execFileSync } = require('child_process');
const { apiRequest, canonicalJson, fetchModScope, formatScopeEntry, loadState, saveState, sha256, PROJECT_ROOT } = require('./shared');
const { CREATOR_ROOTS, classifyModChanges, diffPaths, mergeTabs, projectToCreatorSurface, stripEngineMaintained } = require('./tabs');

const MAX_LISTED = 40;
const showPath = (change) => change.segments.join(' > ');

function listCapped(lines) {
  const shown = lines.slice(0, MAX_LISTED).map((l) => `  ${l}`);
  if (lines.length > MAX_LISTED) shown.push(`  ... and ${lines.length - MAX_LISTED} more`);
  return shown.join('\n');
}

// Dry-run section for a mod: current scope, then scope warnings.
function reportModScope(scope, remoteCreator, candidate) {
  console.log('\nMod scope (server, current patch against the blank template):');
  if (!scope.available) console.log(`  unknown: ${scope.reason}. Every edit or deletion of existing content is listed below.`);
  else console.log(scope.entries.length ? listCapped(scope.entries.map(formatScopeEntry)) : '  (empty: the mod changes nothing yet)');

  const sorted = classifyModChanges(remoteCreator, candidate, scope.available ? scope.entries : null);
  if (sorted.additions.length) console.log(`\nNew content (${sorted.additions.length}):\n${listCapped(sorted.additions.map(showPath))}`);
  if (sorted.inScope.length) console.log(`\nEdits within the mod's scope (${sorted.inScope.length}):\n${listCapped(sorted.inScope.map((c) => `${showPath(c)} (${c.kind})`))}`);
  if (sorted.outOfScopeDeletes.length) {
    console.log(`\nWARNING - deletes content outside the mod's scope (${sorted.outOfScopeDeletes.length}). This is likely default template content; the mod would DELETE it from every host world:`);
    console.log(listCapped(sorted.outOfScopeDeletes.map(showPath)));
  }
  if (sorted.outOfScopeEdits.length) {
    console.log(`\nWARNING - edits content outside the mod's scope (${sorted.outOfScopeEdits.length}). This is likely default template content; the mod would override it in every host world:`);
    console.log(listCapped(sorted.outOfScopeEdits.map(showPath)));
  }
  if (sorted.customEdits.length) {
    console.log(`\nWARNING - edits aiInstructions custom keys (${sorted.customEdits.length}). These almost always conflict with the host world's own custom instructions when the mod is applied:`);
    console.log(listCapped(sorted.customEdits.map(showPath)));
  }
  if (sorted.outOfScopeDeletes.length || sorted.outOfScopeEdits.length || sorted.customEdits.length) {
    console.log('Confirm each warning above is intended before pushing.');
  }
}

// After a confirmed mod push: new scope and what entered it.
async function reportScopeAfterPush(shortId, before) {
  let after;
  try { after = await fetchModScope(shortId); } catch (err) {
    console.log(`Could not read the new mod scope: ${err.message}`);
    return;
  }
  if (!after.available) return;
  const key = (e) => `${JSON.stringify(e.segments)}|${e.removed}`;
  const known = new Set(before?.available ? before.entries.map(key) : []);
  console.log(`\nMod scope after push:\n${after.entries.length ? listCapped(after.entries.map(formatScopeEntry)) : '  (empty)'}`);
  if (before?.available) {
    const entered = after.entries.filter((e) => !known.has(key(e)));
    console.log(entered.length ? `Newly in scope:\n${listCapped(entered.map(formatScopeEntry))}` : 'No new scope entries.');
  }
}

function runJson(script, args) {
  try {
    const out = execFileSync('node', [script, ...args], { cwd: PROJECT_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
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
    console.error('Nothing pinned; run pull first (it writes .creator-api.json).');
    process.exit(1);
  }

  // Tabs should only hold the creator surface; project anyway so leftovers
  // from an old faithful pull (runtime roots, derived triggers) never ship.
  const { projected: candidate, droppedRoots, strippedTriggers } = projectToCreatorSurface(mergeTabs());
  if (droppedRoots.length > 0 || strippedTriggers > 0) {
    console.log(`NOTE: ignoring non-creator content found in tabs (${[...droppedRoots, strippedTriggers > 0 ? `${strippedTriggers} engine-derived trigger(s)` : ''].filter(Boolean).join(', ')}). Re-pull to clean tabs up.`);
  }
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

  // 3. Fetch remote for etag + drift report. All comparisons run on the
  //    creator surface: runtime roots change every play session and must not
  //    read as drift.
  const response = await apiRequest({ method: 'GET', path: `/worlds/${encodeURIComponent(state.shortId)}` });
  const world = response.json?.data?.world ?? response.json?.data;
  const etag = response.headers.get('etag');
  const remoteCreator = projectToCreatorSurface(world.initialGameState).projected;
  const remoteHash = sha256(canonicalJson(remoteCreator));

  if (remoteHash === candidateHash) {
    saveState({ lastSyncedAt: new Date().toISOString(), lastSyncedHash: candidateHash });
    console.log('Remote already matches local tabs. Nothing to push.');
    return;
  }

  const isMod = state.kind === 'mod' || world.isMod === true;
  const modScope = isMod
    ? await fetchModScope(state.shortId).catch((err) => ({ available: false, reason: err.message }))
    : null;

  const baseKnown = Boolean(state.lastSyncedHash);
  const remoteDrifted = baseKnown && remoteHash !== state.lastSyncedHash;
  console.log(`${isMod ? 'Mod' : 'World'}: ${state.shortId} ("${world.title}")`);
  console.log(`Local changes vs remote (section level):`);
  const changes = sectionDiffSummary('remote', remoteCreator, 'local', candidate);
  console.log(changes.length ? changes.join('\n') : '  (none at section level)');
  if (remoteDrifted) {
    console.log('\nWARNING: the remote has drifted since the last sync (edits made outside WP).');
    console.log('Pushing will overwrite that drift. Server revision history retains it.');
  } else if (!baseKnown) {
    console.log('\nNOTE: no last-synced baseline recorded; treat the diff above as the full picture.');
  }
  if (isMod) reportModScope(modScope, remoteCreator, candidate);

  if (!confirm) {
    console.log('\nDry run. Relay this report for a human go-ahead, then re-run with --confirm.');
    process.exit(2);
  }

  // 4. Full replace: world metadata preserved, runtime/system roots preserved
  //    from the fresh remote document, creator roots replaced by the tabs
  //    (tabs are canonical, so a creator root absent from tabs is removed).
  const nextInitialGameState = { ...world.initialGameState };
  for (const root of CREATOR_ROOTS) delete nextInitialGameState[root];
  Object.assign(nextInitialGameState, candidate);
  await apiRequest({
    method: 'PUT',
    path: `/worlds/${encodeURIComponent(state.shortId)}`,
    body: { world: { ...world, initialGameState: nextInitialGameState } },
    etag,
  });

  // 5. Verify by re-reading (creator surface only; the save funnel is allowed
  //    to touch runtime roots and to re-derive quest progress triggers).
  const verify = await apiRequest({ method: 'GET', path: `/worlds/${encodeURIComponent(state.shortId)}` });
  const verifiedWorld = verify.json?.data?.world ?? verify.json?.data;
  const verifiedCreator = projectToCreatorSurface(verifiedWorld.initialGameState).projected;
  const verifiedHash = sha256(canonicalJson(verifiedCreator));
  if (verifiedHash !== candidateHash) {
    // The save funnel stamps engine bookkeeping (embedding ids, quest and narrative
    // event runtime fields, lore ticks) onto authored records. Compare without
    // those so only authored differences are reported, by path.
    const authoredDiff = diffPaths(stripEngineMaintained(candidate), stripEngineMaintained(verifiedCreator));
    if (authoredDiff.length === 0) {
      saveState({ lastSyncedAt: new Date().toISOString(), lastSyncedHash: candidateHash });
      console.log('Pushed and verified. The stored copy differs only in engine bookkeeping fields; run pull to bring those into tabs.');
      if (isMod) await reportScopeAfterPush(state.shortId, modScope);
      return;
    }
    console.error('Push completed but the stored creator content differs from what was sent at these authored paths:');
    for (const line of authoredDiff) console.error(`  ${line}`);
    console.error('Some of this can be legitimate (the save funnel fills in defaults); run pull to reconcile tabs with the stored result.');
    process.exitCode = 1;
    if (isMod) await reportScopeAfterPush(state.shortId, modScope);
    return;
  }
  saveState({ lastSyncedAt: new Date().toISOString(), lastSyncedHash: candidateHash });
  console.log('Pushed and verified.');
  if (isMod) await reportScopeAfterPush(state.shortId, modScope);
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
