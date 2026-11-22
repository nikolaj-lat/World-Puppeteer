#!/usr/bin/env node
'use strict';

/*
 * Pull the pinned world's live draft into tabs/.
 *
 * Usage:
 *   node .claude/scripts/api/pull.js [shortId-or-link] [--repin]
 *
 * Accepts a full world or mod link (https://voyage.io/world/<shortId>/<slug>,
 * https://voyage.io/mod/<shortId>/<slug>) or a bare shortId; the first pull
 * pins it in .creator-api.json together with its kind ('world' or 'mod', taken
 * from the API's isMod flag, never from the link).
 *
 * Mods: the draft is a full world; Voyage applies its diff against the blank
 * template to each host world. Tabs therefore hold all default content too, and
 * pull prints the mod's current patch scope (GET /mods/{id}/changes) when the
 * API host offers it.
 *
 * Behavior (never blocks):
 * - Fresh checkout (no tab files): pulls straight through, no backup.
 * - Tabs hold a world: the merged tabs are backed up to config-backups/ first,
 *   then overwritten; the backup path is printed loudly.
 * - Local already matches remote: reports "in sync" and changes nothing.
 * - A shortId or kind different from the pinned one requires --repin.
 * - Tab writes are atomic (temp dir + swap).
 */

const { execFileSync } = require('child_process');
const path = require('path');
const { apiRequest, canonicalJson, fetchModScope, formatScopeEntry, loadState, saveState, sha256, PROJECT_ROOT } = require('./shared');
const { backupMergedTabs, mergeTabs, projectToCreatorSurface, splitIntoTabs, tabsAreEmpty } = require('./tabs');

// Accepts a bare shortId or a pasted world/mod/studio link and returns the shortId.
function resolveShortId(arg) {
  if (!arg) return arg;
  if (!/^https?:\/\//.test(arg)) return arg;
  try {
    const segments = new URL(arg).pathname.split('/').filter(Boolean);
    const anchor = segments.findIndex((s) => s === 'world' || s === 'mod' || s === 'studio');
    const candidate = anchor >= 0 ? segments[anchor + 1] : segments[segments.length - 1];
    if (candidate) return candidate;
  } catch { /* fall through */ }
  console.error(`Could not extract a world or mod shortId from: ${arg}`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const repin = args.includes('--repin');
  const argShortId = resolveShortId(args.find((a) => !a.startsWith('--')));
  const state = loadState();
  const shortId = argShortId || state.shortId;

  if (!shortId) {
    console.error('Nothing pinned. Usage: node .claude/scripts/api/pull.js <shortId-or-world-or-mod-link>');
    process.exit(1);
  }
  if (state.shortId && argShortId && argShortId !== state.shortId && !repin) {
    console.error(`Refusing: this checkout is pinned to ${state.shortId} but you asked for ${argShortId}.`);
    console.error('Pass --repin to deliberately switch this checkout to a different world or mod.');
    process.exit(1);
  }

  const response = await apiRequest({ method: 'GET', path: `/worlds/${encodeURIComponent(shortId)}` });
  const world = response.json?.data?.world ?? response.json?.data;
  if (!world || typeof world.initialGameState !== 'object') {
    console.error('Unexpected world response shape; aborting without touching tabs.');
    process.exit(1);
  }
  const kind = world.isMod === true ? 'mod' : 'world';
  if (state.kind && state.kind !== kind && !repin) {
    console.error(`Refusing: this checkout is pinned as a ${state.kind}, but ${shortId} is a ${kind}.`);
    console.error(`Pass --repin to deliberately switch this checkout to a ${kind}.`);
    process.exit(1);
  }
  const label = `${kind} ${shortId} ("${world.title}")`;

  // The stored draft is a complete GameState; tabs only ever hold the creator
  // surface. Runtime roots stay on the server (push preserves them), and
  // engine-derived quest progress triggers are dropped (regenerated on save).
  const { projected: remoteState, droppedRoots, strippedTriggers } = projectToCreatorSurface(world.initialGameState);
  const remoteHash = sha256(canonicalJson(remoteState));
  const localIsEmpty = tabsAreEmpty();
  const localHash = localIsEmpty ? null : sha256(canonicalJson(projectToCreatorSurface(mergeTabs()).projected));

  if (localHash === remoteHash) {
    saveState({ shortId, kind, lastSyncedAt: new Date().toISOString(), lastSyncedHash: remoteHash });
    console.log(`In sync with ${label}. Nothing changed.`);
    if (kind === 'mod') await printModScope(shortId);
    return;
  }

  if (!localIsEmpty) {
    const backupPath = backupMergedTabs('pre-pull');
    console.log(`NOTE: tabs held a world; merged copy backed up to ${path.relative(PROJECT_ROOT, backupPath)} before overwriting.`);
  }

  splitIntoTabs(remoteState);
  execFileSync('node', [path.join(__dirname, '..', 'build.js')], { cwd: PROJECT_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  saveState({ shortId, kind, lastSyncedAt: new Date().toISOString(), lastSyncedHash: remoteHash });
  console.log(`Pulled ${label} into tabs/ and rebuilt config.json.`);
  if (droppedRoots.length > 0) {
    console.log(`Left on the server (runtime/system state, preserved by push): ${droppedRoots.join(', ')}`);
  }
  if (strippedTriggers > 0) {
    console.log(`Dropped ${strippedTriggers} engine-derived quest progress trigger(s); the engine regenerates them from each quest's completionCondition on save.`);
  }
  if (kind === 'mod') {
    console.log('MOD checkout: tabs include the blank template\'s default content. Leave it in place; change only what the mod targets.');
    await printModScope(shortId);
  }
}

async function printModScope(shortId) {
  try {
    const scope = await fetchModScope(shortId);
    if (!scope.available) {
      console.log(`Mod scope unknown: ${scope.reason}.`);
      return;
    }
    console.log(scope.entries.length
      ? `This mod currently changes:\n${scope.entries.map((e) => `  ${formatScopeEntry(e)}`).join('\n')}`
      : 'This mod currently changes nothing (its patch against the blank template is empty).');
  } catch (err) {
    console.log(`Mod scope unavailable: ${err.message}`);
  }
}

main().catch((err) => {
  console.error(`pull failed: ${err.message}`);
  process.exit(1);
});
