'use strict';

/*
 * Tab <-> merged-config helpers shared by pull/push/hook.
 * mergeTabs mirrors build.js exactly (including the worldBackground hoist)
 * but returns the object instead of writing config.json.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { PROJECT_ROOT, canonicalJson, sha256 } = require('./shared');

const TABS_DIR = path.join(PROJECT_ROOT, 'tabs');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'config-backups');
const SPLIT_SCRIPT = path.join(__dirname, '..', 'split.js');

function listTabFiles() {
  try {
    return fs.readdirSync(TABS_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
}

function mergeTabs() {
  const result = {};
  for (const file of listTabFiles()) {
    const data = JSON.parse(fs.readFileSync(path.join(TABS_DIR, file), 'utf8'));
    const worldBackground = data.worldBackground;
    delete data.worldBackground;
    Object.assign(result, data);
    if (worldBackground !== undefined) {
      result.storySettings = result.storySettings || {};
      result.storySettings.worldBackground = worldBackground;
    }
  }
  return result;
}

function tabsAreEmpty() {
  return listTabFiles().length === 0;
}

function mergedHash() {
  return sha256(canonicalJson(mergeTabs()));
}

function backupMergedTabs(label) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `${label}-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(mergeTabs(), null, 2));
  return backupPath;
}

/**
 * Split a merged config into tabs atomically: split into a temp dir first,
 * then swap it in, so a failure can never leave tabs half-overwritten.
 */
function splitIntoTabs(config) {
  const stamp = `${Date.now()}-${process.pid}`;
  // Hidden dotfile in .claude, deleted in the finally: the same pattern the
  // edit hook uses for its validator output scratch file.
  const tempInput = path.join(PROJECT_ROOT, '.claude', `.pulled-world-${stamp}.json`);
  const tempDir = path.join(PROJECT_ROOT, `.tabs-incoming-${stamp}`);
  const oldDir = path.join(PROJECT_ROOT, `.tabs-old-${stamp}`);
  fs.writeFileSync(tempInput, JSON.stringify(config, null, 2));
  try {
    execFileSync('node', [SPLIT_SCRIPT, tempInput, tempDir], { stdio: ['ignore', 'pipe', 'pipe'] });
    const hadTabs = fs.existsSync(TABS_DIR);
    if (hadTabs) fs.renameSync(TABS_DIR, oldDir);
    fs.renameSync(tempDir, TABS_DIR);
    if (hadTabs) fs.rmSync(oldDir, { recursive: true, force: true });
  } finally {
    fs.rmSync(tempInput, { force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { BACKUP_DIR, TABS_DIR, backupMergedTabs, mergeTabs, mergedHash, splitIntoTabs, tabsAreEmpty };
