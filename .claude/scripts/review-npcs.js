#!/usr/bin/env node

/**
 * NPC Review Extraction Script
 *
 * Strips NPC data to narrative-only plain text for LLM review.
 * Removes abilities, mechanical fields, and JSON overhead.
 * Includes world-background and entity name lists for context.
 *
 * Usage:
 *   node review-npcs.js              # defaults to tabs/
 *   node review-npcs.js ./tabs/      # explicit path
 */

const fs = require('fs');
const path = require('path');

const tabsDir = process.argv[2] || path.join(__dirname, '../../tabs');

function loadJson(filename) {
  const filePath = path.join(tabsDir, filename);
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Load data
const npcsData = loadJson('npcs.json');
const npcs = npcsData.npcs || {};
const worldBg = loadJson('world-background.json');

// Load entity name lists
const factions = Object.keys((loadJson('factions.json')).factions || {});
const npcTypes = Object.keys((loadJson('npc-types.json')).npcTypes || {});
const npcNames = Object.keys(npcs);

const lines = [];

// World background
lines.push('# World Background');
if (worldBg.storySettings?.worldBackground) {
  lines.push(worldBg.storySettings.worldBackground);
} else if (typeof worldBg.worldBackground === 'string') {
  lines.push(worldBg.worldBackground);
} else {
  for (const val of Object.values(worldBg)) {
    if (typeof val === 'string' && val.length > 100) {
      lines.push(val);
      break;
    }
    if (val?.worldBackground) {
      lines.push(val.worldBackground);
      break;
    }
  }
}
lines.push('');

// NPCs
lines.push('# NPC Narrative Data');
lines.push(`# ${npcNames.length} NPCs — abilities and mechanical fields stripped`);
lines.push('');

for (const [key, npc] of Object.entries(npcs)) {
  lines.push(`## ${npc.name}`);

  const meta = [];
  if (npc.type) meta.push(`type: ${npc.type}`);
  if (npc.faction) meta.push(`faction: ${npc.faction}`);
  if (npc.gender) meta.push(`gender: ${npc.gender}`);
  if (meta.length > 0) lines.push(meta.join(' | '));

  if (npc.basicInfo) {
    lines.push(`basicInfo: ${npc.basicInfo}`);
  }

  if (npc.personality && npc.personality.length > 0) {
    lines.push(`personality: ${npc.personality.join(' | ')}`);
  }

  if (npc.hiddenInfo) {
    lines.push(`hiddenInfo: ${npc.hiddenInfo}`);
  }

  lines.push('');
}

// Entity lists
lines.push('---');
lines.push('# Entity Lists');
lines.push(`NPC names: ${npcNames.join(', ')}`);
lines.push(`Factions: ${factions.join(', ')}`);
lines.push(`NPC Types: ${npcTypes.join(', ')}`);

console.log(lines.join('\n'));
