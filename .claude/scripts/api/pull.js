#!/usr/bin/env node
'use strict';

/*
 * Pull the pinned world's live draft into tabs/.
 *
 * Usage:
 *   node .claude/scripts/api/pull.js [shortId-or-world-link] [--repin]
 *
 * Accepts a full world link (https://voyage.io/world/<shortId>/<slug>) or a
 * bare shortId; the first pull pins the world in .creator-api.json.
 *
 * Behavior (never blocks):
 * - Fresh checkout (no tab files): pulls straight through, no backup.
 * - Tabs hold a world: the merged tabs are backed up to config-backups/ first,
 *   then overwritten; the backup path is printed loudly.
 * - Local already matches remote: reports "in sync" and changes nothing.
 * - A shortId different from the pinned one requires --repin.
 * - Tab writes are atomic (temp dir + swap).
 */

const { execFileSync } = require('child_process');
const path = require('path');
const { apiRequest, canonicalJson, loadState, saveState, sha256, PROJECT_ROOT } = require('./shared');
const { backupMergedTabs, mergeTabs, splitIntoTabs, tabsAreEmpty } = require('./tabs');

// Accepts a bare shortId or a pasted world/studio link and returns the shortId.
function resolveShortId(arg) {
  if (!arg) return arg;
  if (!/^https?:\/\//.test(arg)) return arg;
  try {
    const segments = new URL(arg).pathname.split('/').filter(Boolean);
    const anchor = segments.findIndex((s) => s === 'world' || s === 'studio');
    const candidate = anchor >= 0 ? segments[anchor + 1] : segments[segments.length - 1];
    if (candidate) return candidate;
  } catch { /* fall through */ }
  console.error(`Could not extract a world shortId from: ${arg}`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const repin = args.includes('--repin');
  const argShortId = resolveShortId(args.find((a) => !a.startsWith('--')));
  const state = loadState();
  const shortId = argShortId || state.shortId;

  if (!shortId) {
    console.error('No world pinned. Usage: node .claude/scripts/api/pull.js <shortId-or-world-link>');
    process.exit(1);
  }
  if (state.shortId && argShortId && argShortId !== state.shortId && !repin) {
    console.error(`Refusing: this checkout is pinned to ${state.shortId} but you asked for ${argShortId}.`);
    console.error('Pass --repin to deliberately switch this checkout to a different world.');
    process.exit(1);
  }

  const response = await apiRequest({ method: 'GET', path: `/worlds/${encodeURIComponent(shortId)}` });
  const world = response.json?.data?.world ?? response.json?.data;
  if (!world || typeof world.initialGameState !== 'object') {
    console.error('Unexpected world response shape; aborting without touching tabs.');
    process.exit(1);
  }

  const remoteState = world.initialGameState;
  const remoteHash = sha256(canonicalJson(remoteState));
  const localIsEmpty = tabsAreEmpty();
  const localHash = localIsEmpty ? null : sha256(canonicalJson(mergeTabs()));

  if (localHash === remoteHash) {
    saveState({ shortId, lastSyncedAt: new Date().toISOString(), lastSyncedHash: remoteHash });
    console.log(`In sync with ${shortId} ("${world.title}"). Nothing changed.`);
    return;
  }

  if (!localIsEmpty) {
    const backupPath = backupMergedTabs('pre-pull');
    console.log(`NOTE: tabs held a world; merged copy backed up to ${path.relative(PROJECT_ROOT, backupPath)} before overwriting.`);
  }

  splitIntoTabs(remoteState);
  execFileSync('node', [path.join(__dirname, '..', 'build.js')], { cwd: PROJECT_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  saveState({ shortId, lastSyncedAt: new Date().toISOString(), lastSyncedHash: remoteHash });
  console.log(`Pulled ${shortId} ("${world.title}") into tabs/ and rebuilt config.json.`);
}

main().catch((err) => {
  console.error(`pull failed: ${err.message}`);
  process.exit(1);
});
