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

const {
  REQUIRED_TOP_LEVEL,
  OPTIONAL_TOP_LEVEL,
  RESERVED_QUEST_PROGRESS_TRIGGER_PREFIX,
} = require('../validate.js');

// The creator-writable surface. A stored draft fetched from the API is a
// COMPLETE GameState carrying runtime roots too (gameConfig, engineState,
// embeddings, chatLog, ...); those never belong in tabs. Push preserves them
// by overlaying the projected tabs onto the freshly fetched remote document.
const CREATOR_ROOTS = new Set([...REQUIRED_TOP_LEVEL, ...OPTIONAL_TOP_LEVEL, 'unassignedAreas']);

/**
 * Reduce a full GameState to the creator surface: keep creator roots only and
 * drop engine-derived quest progress triggers (the engine regenerates those
 * from each quest's completionCondition on save).
 * Returns { projected, droppedRoots, strippedTriggers }.
 */
function projectToCreatorSurface(initialGameState) {
  const projected = {};
  const droppedRoots = [];
  for (const [key, value] of Object.entries(initialGameState ?? {})) {
    if (CREATOR_ROOTS.has(key)) projected[key] = value;
    else droppedRoots.push(key);
  }
  // An empty draft holding pen is engine bookkeeping, not authored content; drafts
  // with entries stay visible so the validator can say what still needs a location.
  if (projected.unassignedAreas && typeof projected.unassignedAreas === 'object'
      && !Array.isArray(projected.unassignedAreas)
      && Object.keys(projected.unassignedAreas).length === 0) {
    delete projected.unassignedAreas;
  }
  let strippedTriggers = 0;
  for (const section of ['triggers', 'questTriggers']) {
    const root = projected[section];
    if (!root || typeof root !== 'object' || Array.isArray(root)) continue;
    const kept = {};
    for (const [id, trigger] of Object.entries(root)) {
      const name = typeof trigger?.name === 'string' ? trigger.name : String(id);
      if (String(id).startsWith(RESERVED_QUEST_PROGRESS_TRIGGER_PREFIX)
          || name.startsWith(RESERVED_QUEST_PROGRESS_TRIGGER_PREFIX)) {
        strippedTriggers++;
        continue;
      }
      kept[id] = trigger;
    }
    projected[section] = kept;
  }
  // Runtime fields the engine materializes on authored records never reach the
  // tabs: the engine strips them from creator input and re-stamps them on save,
  // so keeping them only invites agents to copy them into new records.
  return { projected: stripEngineMaintained(projected), droppedRoots, strippedTriggers };
}

// Nested fields the engine writes itself on every save. They are not authored
// content, so a push verification compares the creator surface without them.
// Embedding identity is server-owned at every depth; the per-section lists are
// the runtime-only record fields the engine materializes on authored records.
const ENGINE_MAINTAINED_NESTED = {
  '*': ['embedding', 'embeddingId', 'embeddingModel', 'embeddingDimension'],
  worldLore: ['type', 'gameTick', 'lastUsedTick'],
  narrativeEvents: ['id', 'status', 'turnsActive', 'completedTick', 'startingLocation'],
  quests: [
    'id', 'definitionKey', 'creationTick', 'contentOrigin', 'questType', 'questGiverNPC', 'questGiverNPCKey',
    'detectionTick', 'acceptedTick', 'expiryTick', 'startingArea', 'completedTick', 'abandonedTick',
    'rejectedTick', 'connectingAreaName', 'questAreas', 'questStepPhase', 'hasVisitedLocation',
    'hasVisitedStartingArea', 'objectiveCompleted', 'offeredAtLocation', 'arcId',
    'arcEscalationAtCreation', 'arcQuestOrdinal',
  ],
  npcs: [
    'status', 'lastSeenTick', 'aliases', 'lastSeenLocation', 'lastSeenArea', 'playerNotes',
    'needsDetailGeneration', 'deathXPAwarded', 'deathDamageContributors', 'activeBuffs',
    'incapacitatedTurns', 'currentCoordinates', 'visualTags', 'portraitUrlSource',
    'questOriginArcId', 'questOriginQuestId',
  ],
  locations: ['visited', 'lastVisitedTick', 'visitedAreas', 'questOriginArcId', 'questOriginQuestId'],
  arcs: ['escalationLevel', 'creationTick', 'lastUpdateTick', 'surfacingStartTick', 'surfacedTick', 'resolvedTick'],
};

/**
 * Copy of a creator surface with engine-maintained fields removed, for
 * comparing what was sent against what the server stored.
 */
function stripEngineMaintained(projected) {
  const global = new Set(ENGINE_MAINTAINED_NESTED['*']);
  const stripDeep = (value, sectionFields, atRecordLevel) => {
    if (Array.isArray(value)) return value.map((item) => stripDeep(item, sectionFields, false));
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (global.has(key)) continue;
      if (atRecordLevel && sectionFields.has(key)) continue;
      out[key] = stripDeep(child, sectionFields, false);
    }
    return out;
  };
  const result = {};
  for (const [root, value] of Object.entries(projected ?? {})) {
    const sectionFields = new Set(ENGINE_MAINTAINED_NESTED[root] ?? []);
    if (value && typeof value === 'object' && !Array.isArray(value) && sectionFields.size > 0) {
      result[root] = Object.fromEntries(
        Object.entries(value).map(([id, record]) => [id, stripDeep(record, sectionFields, true)]),
      );
    } else {
      result[root] = stripDeep(value, sectionFields, false);
    }
  }
  return result;
}

/** Paths (dot-joined) where two values differ, depth-first, capped at `limit`. */
function diffPaths(a, b, limit = 40) {
  const out = [];
  const walk = (left, right, path) => {
    if (out.length >= limit) return;
    if (canonicalJson(left) === canonicalJson(right)) return;
    const bothObjects = left && right && typeof left === 'object' && typeof right === 'object'
      && !Array.isArray(left) && !Array.isArray(right);
    if (!bothObjects) {
      out.push(`${path || '(root)'}: ${left === undefined ? 'absent' : 'sent'} -> ${right === undefined ? 'absent' : 'stored'}`);
      return;
    }
    for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
      walk(left[key], right[key], path ? `${path}.${key}` : key);
    }
  };
  walk(a, b, '');
  return out;
}

/**
 * Every differing path between two creator surfaces, as
 * { segments, kind: 'add' | 'change' | 'delete' }. Objects recurse; arrays and
 * primitives are leaves. A whole-record add/delete is reported once, at the
 * record, not per field.
 */
function changedPaths(remote, local) {
  const out = [];
  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const walk = (left, right, segments) => {
    if (canonicalJson(left) === canonicalJson(right)) return;
    if (left === undefined) return out.push({ segments, kind: 'add' });
    if (right === undefined) return out.push({ segments, kind: 'delete' });
    if (!isObject(left) || !isObject(right)) return out.push({ segments, kind: 'change' });
    for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
      walk(left[key], right[key], [...segments, key]);
    }
  };
  walk(remote ?? {}, local ?? {}, []);
  return out;
}

const startsWith = (segments, prefix) => prefix.length <= segments.length && prefix.every((seg, i) => segments[i] === seg);

// aiInstructions.<task>.custom: editing it in a mod almost always conflicts with
// the host world's own custom text when the mod is applied.
const isCustomAiInstruction = (segments) => segments.length >= 3 && segments[0] === 'aiInstructions' && segments[2] === 'custom';

/**
 * Sort local-vs-remote differences of a mod checkout against the mod's patch
 * scope (fetchModScope entries; null when the host cannot report scope).
 * - additions: new content; normal mod work, never flagged
 * - inScope: edits/deletes under something the patch already covers
 * - outOfScopeEdits / outOfScopeDeletes: touch content the patch does not cover,
 *   i.e. default template content that would change/vanish in every host world.
 *   With unknown scope every edit/delete of existing content lands here.
 * - customEdits: any aiInstructions.<task>.custom change, in scope or not.
 * Nothing here blocks a push; push relays it as warnings.
 */
function classifyModChanges(remoteCreator, candidate, scopeEntries) {
  const result = { additions: [], inScope: [], outOfScopeEdits: [], outOfScopeDeletes: [], customEdits: [] };
  for (const change of changedPaths(remoteCreator, candidate)) {
    if (isCustomAiInstruction(change.segments)) result.customEdits.push(change);
    if (change.kind === 'add') {
      result.additions.push(change);
      continue;
    }
    const covered = Array.isArray(scopeEntries) && scopeEntries.some((entry) => startsWith(change.segments, entry.segments));
    if (covered) result.inScope.push(change);
    else if (change.kind === 'delete') result.outOfScopeDeletes.push(change);
    else result.outOfScopeEdits.push(change);
  }
  return result;
}

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

module.exports = { BACKUP_DIR, CREATOR_ROOTS, TABS_DIR, backupMergedTabs, changedPaths, classifyModChanges, diffPaths, mergeTabs, mergedHash, projectToCreatorSurface, splitIntoTabs, stripEngineMaintained, tabsAreEmpty };
