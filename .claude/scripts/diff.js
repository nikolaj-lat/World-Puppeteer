#!/usr/bin/env node

/**
 * Diff two world config JSON files, ignoring engine-published metadata noise.
 *
 * Usage:
 *   node .claude/scripts/diff.js <a.json> <b.json>
 *
 * Strips `embeddingId` fields recursively before comparing so published configs
 * (which carry per-entry vector-search IDs) diff cleanly against locally-built ones.
 *
 * Output is grouped by top-level section, listing added / removed / changed entries.
 * For each changed entry, the differing fields are shown with truncated before/after.
 */

const fs = require('fs');
const path = require('path');

const NOISE_FIELDS = new Set(['embeddingId']);
const TRUNCATE_LEN = 120;
// Field names whose array contents are conjunctive sets — order has no semantic meaning.
const UNORDERED_ARRAY_FIELDS = new Set(['conditions', 'effects']);

function stripNoise(value, parentKey = null) {
  if (Array.isArray(value)) {
    const stripped = value.map(v => stripNoise(v));
    // Sort unordered arrays by their stringified content so equivalent sets compare equal.
    if (UNORDERED_ARRAY_FIELDS.has(parentKey)) {
      return [...stripped].sort((x, y) => {
        const sx = JSON.stringify(x);
        const sy = JSON.stringify(y);
        return sx < sy ? -1 : sx > sy ? 1 : 0;
      });
    }
    return stripped;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (NOISE_FIELDS.has(k)) continue;
      out[k] = stripNoise(v, k);
    }
    return out;
  }
  return value;
}

function truncate(s) {
  if (s === undefined) return '<missing>';
  return s.length > TRUNCATE_LEN ? s.slice(0, TRUNCATE_LEN) + '…' : s;
}

// Stable stringify: sorts object keys recursively so key reorderings compare equal.
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

function jsonEq(a, b) {
  return stableStringify(a) === stableStringify(b);
}

/**
 * Return field-level diffs between two entity objects.
 * Each diff: { field, before, after } with stringified values.
 */
function fieldDiffs(before, after) {
  const out = [];
  const keys = new Set([
    ...(before && typeof before === 'object' ? Object.keys(before) : []),
    ...(after && typeof after === 'object' ? Object.keys(after) : []),
  ]);
  for (const k of keys) {
    const bef = before?.[k];
    const aft = after?.[k];
    if (!jsonEq(bef, aft)) {
      out.push({
        field: k,
        before: bef === undefined ? undefined : JSON.stringify(bef),
        after: aft === undefined ? undefined : JSON.stringify(aft),
      });
    }
  }
  return out;
}

/**
 * Diff two top-level collection objects (e.g. config.npcs vs config.npcs).
 * Returns { added: [name], removed: [name], changed: [{name, fieldDiffs}] }.
 */
function collectionDiff(oldColl, newColl) {
  const result = { added: [], removed: [], changed: [] };
  const oldKeys = oldColl && typeof oldColl === 'object' ? Object.keys(oldColl) : [];
  const newKeys = newColl && typeof newColl === 'object' ? Object.keys(newColl) : [];
  for (const k of newKeys) {
    if (!(k in (oldColl || {}))) {
      result.added.push(k);
    } else if (!jsonEq(oldColl[k], newColl[k])) {
      result.changed.push({ name: k, fieldDiffs: fieldDiffs(oldColl[k], newColl[k]) });
    }
  }
  for (const k of oldKeys) {
    if (!(k in (newColl || {}))) result.removed.push(k);
  }
  return result;
}

/**
 * Recursively diff a non-collection value (scalar, array, or settings-style object)
 * and return a list of { path, before, after }.
 */
function deepDiff(oldVal, newVal, prefix = '') {
  if (jsonEq(oldVal, newVal)) return [];
  const oldIsObj = oldVal && typeof oldVal === 'object' && !Array.isArray(oldVal);
  const newIsObj = newVal && typeof newVal === 'object' && !Array.isArray(newVal);
  if (!oldIsObj || !newIsObj) {
    return [{ path: prefix, before: JSON.stringify(oldVal), after: JSON.stringify(newVal) }];
  }
  const out = [];
  const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
  for (const k of keys) {
    const subPath = prefix ? `${prefix}.${k}` : k;
    out.push(...deepDiff(oldVal[k], newVal[k], subPath));
  }
  return out;
}

/**
 * A "collection" section is one whose top-level value is an object whose
 * own values look like entities (have a `name` field, or look like records).
 * Heuristic: object whose first value is itself an object.
 *
 * Arrays (e.g. premadeCharacters) are also handled as collections, keyed by
 * `name` if present, otherwise by index.
 */
function isCollectionSection(value) {
  if (Array.isArray(value)) return value.length === 0 || (value[0] && typeof value[0] === 'object');
  if (!value || typeof value !== 'object') return false;
  const firstKey = Object.keys(value)[0];
  if (firstKey === undefined) return false;
  return value[firstKey] && typeof value[firstKey] === 'object' && !Array.isArray(value[firstKey]);
}

function arrayToKeyedCollection(arr) {
  const out = {};
  arr.forEach((item, i) => {
    const key = (item && typeof item === 'object' && item.name) || `[${i}]`;
    out[key] = item;
  });
  return out;
}

function normalizeCollection(value) {
  return Array.isArray(value) ? arrayToKeyedCollection(value) : value;
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: file not found: ${filePath}`);
    process.exit(1);
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error parsing ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

function printChangedEntry({ name, fieldDiffs }) {
  console.log(`    ~ ${name}`);
  for (const { field, before, after } of fieldDiffs) {
    console.log(`        ${field}:`);
    console.log(`          before: ${truncate(before)}`);
    console.log(`          after : ${truncate(after)}`);
  }
}

function reportSection(section, oldVal, newVal) {
  if (jsonEq(oldVal, newVal)) return false;

  const isCollection = isCollectionSection(oldVal) || isCollectionSection(newVal);

  if (isCollection) {
    const oldColl = normalizeCollection(oldVal);
    const newColl = normalizeCollection(newVal);
    const { added, removed, changed } = collectionDiff(oldColl, newColl);
    if (added.length === 0 && removed.length === 0 && changed.length === 0) return false;
    const total = added.length + removed.length + changed.length;
    console.log(`\n=== ${section} === (${total} differ)`);
    if (added.length) {
      console.log(`  + added (${added.length}):`);
      for (const name of added) console.log(`      ${name}`);
    }
    if (removed.length) {
      console.log(`  - removed (${removed.length}):`);
      for (const name of removed) console.log(`      ${name}`);
    }
    if (changed.length) {
      console.log(`  ~ changed (${changed.length}):`);
      for (const entry of changed) printChangedEntry(entry);
    }
    return true;
  }

  // Non-collection (settings-style) section: walk recursively
  const diffs = deepDiff(oldVal, newVal, section);
  if (diffs.length === 0) return false;
  console.log(`\n=== ${section} === (${diffs.length} field${diffs.length > 1 ? 's' : ''} differ)`);
  for (const { path: p, before, after } of diffs) {
    console.log(`    ${p}:`);
    console.log(`      before: ${truncate(before)}`);
    console.log(`      after : ${truncate(after)}`);
  }
  return true;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error('Usage: node .claude/scripts/diff.js <a.json> <b.json>');
    console.error('  a = baseline (e.g. published-3.json)');
    console.error('  b = new (e.g. config.json)');
    process.exit(1);
  }
  const [aPath, bPath] = args;
  const a = stripNoise(loadJson(path.resolve(aPath)));
  const b = stripNoise(loadJson(path.resolve(bPath)));

  const sections = new Set([...Object.keys(a), ...Object.keys(b)]);
  let anyDiff = false;
  for (const section of sections) {
    const printed = reportSection(section, a[section], b[section]);
    if (printed) anyDiff = true;
  }
  if (!anyDiff) {
    console.log('No differences (after stripping engine metadata).');
  }
}

main();
