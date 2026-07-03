#!/usr/bin/env node

/**
 * Voyage World Config Character Counter
 *
 * Analyzes a world config JSON and reports character counts per section,
 * comparing against documented limits.
 *
 * Usage:
 *   node count.js <world.json> [--json]
 *   node count.js my-world.json
 *   node count.js my-world.json --json > report.json
 *
 * Reports:
 *   - Total config size
 *   - Section-level character counts vs limits
 *   - Individual field counts for fields with limits
 *   - Count limits (story starts, triggers, abilities, etc.)
 */

const fs = require('fs');
const path = require('path');
const { loadAndMergeTabs, resolveWorld, tryResolveExplicitWorldRoot } = require('./world-puppeteer-lib.cjs');
const { parseStrictArgs } = require('./cli-utils.cjs');
const {
  AI_INSTRUCTION_TASK_LIMIT,
  measureAiInstructions,
} = require('./ai-instruction-limits.cjs');
const {
  VOYAGE_LIMITS,
  classifyTriggers,
} = require('./voyage-platform-rules.cjs');

const SECTION_LIMITS = VOYAGE_LIMITS.sections;
const TOTAL_CONFIG_LIMIT = VOYAGE_LIMITS.total;

// Field character limits
const FIELD_LIMITS = {
  'storySettings.worldBackground': VOYAGE_LIMITS.fields.worldBackground,
  'storySettings.questGenerationGuidance': VOYAGE_LIMITS.fields.questGenerationGuidance,
  narratorStyle: VOYAGE_LIMITS.fields.narratorStyle,
  'death.instructions': VOYAGE_LIMITS.fields.deathInstructions,
  'itemSettings.currencyName': VOYAGE_LIMITS.fields.currencyName,
};

// Individual entry limits
const ENTRY_LIMITS = {
  worldLore: { text: VOYAGE_LIMITS.fields.worldLoreEntry },
  storyStarts: { combined: VOYAGE_LIMITS.fields.storyStartEntry },
  items: { description: VOYAGE_LIMITS.fields.itemDescription },
  factions: { basicInfo: VOYAGE_LIMITS.fields.factionBasicInfo, hiddenInfo: VOYAGE_LIMITS.fields.factionHiddenInfo },
  npcTypes: { description: VOYAGE_LIMITS.fields.npcTypeDescription },
  npcs: { combined: VOYAGE_LIMITS.fields.npcCombined },
  regions: { basicInfo: VOYAGE_LIMITS.fields.regionBasicInfo, hiddenInfo: VOYAGE_LIMITS.fields.regionHiddenInfo },
  locations: { basicInfo: VOYAGE_LIMITS.fields.locationBasicInfo, hiddenInfo: VOYAGE_LIMITS.fields.locationHiddenInfo },
  traits: { description: VOYAGE_LIMITS.fields.traitDescription },
  abilities: { description: VOYAGE_LIMITS.fields.abilityDescription },
  realms: { basicInfo: VOYAGE_LIMITS.fields.realmBasicInfo },
};

// Count limits
const COUNT_LIMITS = VOYAGE_LIMITS.counts;

// Settings list entry limits: per-element character limits for settings arrays
const SETTINGS_ENTRY_LIMITS = VOYAGE_LIMITS.settingsEntries;


// Game mode field limits (per mode)
const GAME_MODE_FIELD_LIMITS = {
  name: VOYAGE_LIMITS.fields.gameModeName,
  description: VOYAGE_LIMITS.fields.gameModeDescription,
  instructions: VOYAGE_LIMITS.fields.gameModeInstructions,
  askTheNarratorPrompt: VOYAGE_LIMITS.fields.gameModeAskTheNarratorPrompt,
};

const IMAGE_PROMPT_INSTRUCTION_LIMIT = VOYAGE_LIMITS.fields.imagePromptInstruction;
const IMAGE_PROMPT_TOTAL_LIMIT = VOYAGE_LIMITS.fields.imagePromptTotal;

// Trigger field limits
const TRIGGER_FIELD_LIMITS = {
  conditionQuery: VOYAGE_LIMITS.fields.triggerConditionQuery,
  conditionValue: VOYAGE_LIMITS.fields.triggerConditionValue,
  effectInstruction: VOYAGE_LIMITS.fields.triggerEffectInstruction,
  effectValue: VOYAGE_LIMITS.fields.triggerEffectValue,
};

const AREA_DESCRIPTION_LIMIT = VOYAGE_LIMITS.fields.areaDescription;

function getJsonLength(obj) {
  // Use pretty-printing (2-space indent) to match how world configs are stored
  return JSON.stringify(obj, null, 2).length;
}

function getCompactJsonLength(obj) {
  return JSON.stringify(obj).length;
}

function formatNumber(n) {
  return n.toLocaleString();
}

function formatPercent(used, limit) {
  const pct = ((used / limit) * 100).toFixed(1);
  return `${pct}%`;
}

function getStatus(used, limit) {
  const pct = used / limit;
  if (pct >= 1) return '🔴 OVER';
  if (pct >= 0.9) return '🟠 90%+';
  if (pct >= 0.75) return '🟡 75%+';
  return '🟢 OK';
}

function analyzeConfig(config) {
  const result = {
    total: {
      used: getJsonLength(config),
      limit: TOTAL_CONFIG_LIMIT,
    },
    sections: {},
    fields: {},
    entries: {
      oversized: [],
      warnings: [],
    },
    counts: {},
    aiInstructions: {
      individual: [],
      tasks: [],
      taskLimit: AI_INSTRUCTION_TASK_LIMIT,
    },
    triggers: {
      oversizedConditions: [],
      oversizedEffects: [],
      tooManyConditions: [],
      tooManyEffects: [],
      oversizedTriggers: [],
    },
    slides: {
      oversized: [],
    },
    areas: {
      oversized: [],
    },
    gameModes: {
      oversizedFields: [],
    },
    imagePrompts: {
      oversized: [],
      total: null,
    },
    settingsEntries: {
      oversized: [],
    },
  };

  // Section limits
  for (const [section, limit] of Object.entries(SECTION_LIMITS)) {
    if (config[section] !== undefined) {
      result.sections[section] = {
        used: getJsonLength(config[section]),
        limit,
      };
    }
  }

  // Realm basicInfo limits (special handling)
  if (config.realms) {
    for (const [realmId, realm] of Object.entries(config.realms)) {
      if (realm.basicInfo) {
        const len = realm.basicInfo.length;
        if (len > ENTRY_LIMITS.realms.basicInfo) {
          result.entries.oversized.push({
            path: `realms.${realmId}.basicInfo`,
            used: len,
            limit: ENTRY_LIMITS.realms.basicInfo,
          });
        }
      }
    }
  }

  // Field limits
  if (config.storySettings?.worldBackground) {
    const len = config.storySettings.worldBackground.length;
    result.fields['storySettings.worldBackground'] = {
      used: len,
      limit: FIELD_LIMITS['storySettings.worldBackground'],
    };
  }

  if (config.storySettings?.questGenerationGuidance) {
    const len = config.storySettings.questGenerationGuidance.length;
    result.fields['storySettings.questGenerationGuidance'] = {
      used: len,
      limit: FIELD_LIMITS['storySettings.questGenerationGuidance'],
    };
  }

  if (config.narratorStyle) {
    const len = config.narratorStyle.length;
    result.fields['narratorStyle'] = {
      used: len,
      limit: FIELD_LIMITS['narratorStyle'],
    };
  }

  if (config.death?.instructions) {
    const len = config.death.instructions.length;
    result.fields['death.instructions'] = {
      used: len,
      limit: FIELD_LIMITS['death.instructions'],
    };
  }

  // Count limits
  if (config.storyStarts) {
    const count = Array.isArray(config.storyStarts)
      ? config.storyStarts.length
      : Object.keys(config.storyStarts).length;
    result.counts.storyStarts = { used: count, limit: COUNT_LIMITS.storyStarts };
  }

  if (config.triggers) {
    const triggerValues = Array.isArray(config.triggers) ? config.triggers : Object.values(config.triggers);
    const { semantic: semanticCount, mechanical: mechanicalCount } = classifyTriggers(triggerValues);
    result.counts.semanticTriggers = { used: semanticCount, limit: COUNT_LIMITS.semanticTriggers };
    result.counts.mechanicalTriggers = { used: mechanicalCount, limit: COUNT_LIMITS.mechanicalTriggers };
  }

  if (config.abilities) {
    const count = Object.keys(config.abilities).length;
    result.counts.abilities = { used: count, limit: COUNT_LIMITS.abilities };
  }

  // itemSettings.currencyName field limit
  if (config.itemSettings && typeof config.itemSettings.currencyName === 'string') {
    result.fields['itemSettings.currencyName'] = {
      used: config.itemSettings.currencyName.length,
      limit: FIELD_LIMITS['itemSettings.currencyName'],
    };
  }

  // Settings array count limits
  if (Array.isArray(config.premadeCharacters)) {
    result.counts.premadeCharacters = { used: config.premadeCharacters.length, limit: COUNT_LIMITS.premadeCharacters };
  }
  if (Array.isArray(config.itemSettings?.itemCategories)) {
    result.counts.itemCategories = { used: config.itemSettings.itemCategories.length, limit: COUNT_LIMITS.itemCategories };
  }
  if (Array.isArray(config.itemSettings?.itemSlots)) {
    result.counts.itemSlots = { used: config.itemSettings.itemSlots.length, limit: COUNT_LIMITS.itemSlots };
  }
  if (Array.isArray(config.combatSettings?.damageTypes)) {
    result.counts.damageTypes = { used: config.combatSettings.damageTypes.length, limit: COUNT_LIMITS.damageTypes };
  }
  if (Array.isArray(config.attributeSettings?.attributeNames)) {
    result.counts.attributeNames = { used: config.attributeSettings.attributeNames.length, limit: COUNT_LIMITS.attributeNames };
  }

  // Settings list per-entry character limits
  const pushSettingsEntry = (path, used, limit) => {
    if (used > limit) result.settingsEntries.oversized.push({ path, used, limit });
  };
  (config.itemSettings?.itemCategories ?? []).forEach((cat, i) => {
    if (typeof cat === 'string') pushSettingsEntry(`itemSettings.itemCategories[${i}]`, cat.length, SETTINGS_ENTRY_LIMITS.itemCategory);
  });
  (config.itemSettings?.itemSlots ?? []).forEach((slot, i) => {
    if (slot && typeof slot.slot === 'string') pushSettingsEntry(`itemSettings.itemSlots[${i}].slot`, slot.slot.length, SETTINGS_ENTRY_LIMITS.itemSlotName);
    if (slot && typeof slot.category === 'string') pushSettingsEntry(`itemSettings.itemSlots[${i}].category`, slot.category.length, SETTINGS_ENTRY_LIMITS.itemSlotCategory);
  });
  (config.combatSettings?.damageTypes ?? []).forEach((dt, i) => {
    if (typeof dt === 'string') pushSettingsEntry(`combatSettings.damageTypes[${i}]`, dt.length, SETTINGS_ENTRY_LIMITS.damageType);
  });
  (config.attributeSettings?.attributeNames ?? []).forEach((an, i) => {
    if (typeof an === 'string') pushSettingsEntry(`attributeSettings.attributeNames[${i}]`, an.length, SETTINGS_ENTRY_LIMITS.attributeName);
  });
  if (config.nameFilterSettings && typeof config.nameFilterSettings === 'object') {
    for (const [key, entry] of Object.entries(config.nameFilterSettings)) {
      const replacements = entry?.replacements;
      if (Array.isArray(replacements)) {
        replacements.forEach((rep, i) => {
          if (typeof rep === 'string') pushSettingsEntry(`nameFilterSettings.${key}.replacements[${i}]`, rep.length, SETTINGS_ENTRY_LIMITS.nameFilterReplacement);
        });
      }
    }
  }
  (config.premadeCharacters ?? []).forEach((pc, i) => {
    pushSettingsEntry(`premadeCharacters[${i}]`, getCompactJsonLength(pc), SETTINGS_ENTRY_LIMITS.premadeCharacter);
  });

  // Entry-level analysis
  const analyzeEntries = (section, entries, limits) => {
    if (!entries) return;
    const items = Array.isArray(entries) ? entries : Object.entries(entries);

    for (const item of items) {
      const [id, entry] = Array.isArray(entries) ? [items.indexOf(item), item] : item;

      if (!entry || typeof entry !== 'object') continue;

      // Check combined length for NPCs
      if (section === 'npcs' && limits.combined) {
        const combined = getCompactJsonLength(entry);
        if (combined > limits.combined) {
          result.entries.oversized.push({
            path: `${section}.${id}`,
            used: combined,
            limit: limits.combined,
            type: 'combined',
          });
        }
      }

      // Check story starts combined
      if (section === 'storyStarts' && limits.combined) {
        const combined = getJsonLength(entry);
        if (combined > limits.combined) {
          result.entries.oversized.push({
            path: `${section}[${id}]`,
            used: combined,
            limit: limits.combined,
            type: 'combined',
          });
        }
      }

      // Check individual fields
      for (const [field, limit] of Object.entries(limits)) {
        if (field === 'combined') continue;
        if (entry[field] && typeof entry[field] === 'string') {
          const len = entry[field].length;
          if (len > limit) {
            result.entries.oversized.push({
              path: `${section}.${id}.${field}`,
              used: len,
              limit,
            });
          } else if (len > limit * 0.9) {
            result.entries.warnings.push({
              path: `${section}.${id}.${field}`,
              used: len,
              limit,
            });
          }
        }
      }
    }
  };

  for (const [section, limits] of Object.entries(ENTRY_LIMITS)) {
    if (section !== 'realms') {
      // realms handled separately above
      analyzeEntries(section, config[section], limits);
    }
  }

  const aiMeasurement = measureAiInstructions(config.aiInstructions);
  result.aiInstructions.tasks = aiMeasurement.tasks;
  result.aiInstructions.individual = aiMeasurement.leaves.filter(
    (entry) => entry.used > entry.limit
  );

  // Game mode field analysis
  if (config.gameModes && typeof config.gameModes === 'object') {
    for (const [modeKey, mode] of Object.entries(config.gameModes)) {
      if (!mode || typeof mode !== 'object') continue;
      for (const [field, limit] of Object.entries(GAME_MODE_FIELD_LIMITS)) {
        const value = mode[field];
        if (typeof value === 'string' && value.length > limit) {
          result.gameModes.oversizedFields.push({
            path: `gameModes.${modeKey}.${field}`,
            used: value.length,
            limit,
          });
        }
      }
    }
  }

  // Image prompt configuration analysis
  if (config.imagePromptConfiguration && typeof config.imagePromptConfiguration === 'object') {
    let imagePromptTotal = 0;
    for (const entityType of ['npcs', 'locations', 'regions']) {
      const prompt = config.imagePromptConfiguration[entityType];
      if (typeof prompt !== 'string') continue;
      imagePromptTotal += prompt.length;
      if (prompt.length > IMAGE_PROMPT_INSTRUCTION_LIMIT) {
        result.imagePrompts.oversized.push({
          path: `imagePromptConfiguration.${entityType}`,
          used: prompt.length,
          limit: IMAGE_PROMPT_INSTRUCTION_LIMIT,
        });
      }
    }
    result.imagePrompts.total = { used: imagePromptTotal, limit: IMAGE_PROMPT_TOTAL_LIMIT };
  }

  // Trigger analysis
  if (config.triggers) {
    const triggers = Array.isArray(config.triggers)
      ? config.triggers
      : Object.values(config.triggers);

    for (let i = 0; i < triggers.length; i++) {
      const trigger = triggers[i];
      const triggerPath = Array.isArray(config.triggers) ? `triggers[${i}]` : `triggers.${i}`;

      // Check trigger total size
      const triggerSize = JSON.stringify(trigger).length;
      if (triggerSize > COUNT_LIMITS.triggerSize) {
        result.triggers.oversizedTriggers.push({
          path: triggerPath,
          used: triggerSize,
          limit: COUNT_LIMITS.triggerSize,
        });
      }

      // Check condition count
      if (trigger.conditions && trigger.conditions.length > COUNT_LIMITS.triggerConditions) {
        result.triggers.tooManyConditions.push({
          path: triggerPath,
          used: trigger.conditions.length,
          limit: COUNT_LIMITS.triggerConditions,
        });
      }

      // Check effect count
      if (trigger.effects && trigger.effects.length > COUNT_LIMITS.triggerEffects) {
        result.triggers.tooManyEffects.push({
          path: triggerPath,
          used: trigger.effects.length,
          limit: COUNT_LIMITS.triggerEffects,
        });
      }

      // Check condition field lengths
      if (trigger.conditions) {
        for (let j = 0; j < trigger.conditions.length; j++) {
          const cond = trigger.conditions[j];
          if (cond.query && cond.query.length > TRIGGER_FIELD_LIMITS.conditionQuery) {
            result.triggers.oversizedConditions.push({
              path: `${triggerPath}.conditions[${j}].query`,
              used: cond.query.length,
              limit: TRIGGER_FIELD_LIMITS.conditionQuery,
            });
          }
          if (
            cond.value &&
            typeof cond.value === 'string' &&
            cond.value.length > TRIGGER_FIELD_LIMITS.conditionValue
          ) {
            result.triggers.oversizedConditions.push({
              path: `${triggerPath}.conditions[${j}].value`,
              used: cond.value.length,
              limit: TRIGGER_FIELD_LIMITS.conditionValue,
            });
          }
        }
      }

      // Check effect field lengths
      if (trigger.effects) {
        for (let j = 0; j < trigger.effects.length; j++) {
          const effect = trigger.effects[j];
          if (
            effect.instruction &&
            effect.instruction.length > TRIGGER_FIELD_LIMITS.effectInstruction
          ) {
            result.triggers.oversizedEffects.push({
              path: `${triggerPath}.effects[${j}].instruction`,
              used: effect.instruction.length,
              limit: TRIGGER_FIELD_LIMITS.effectInstruction,
            });
          }
          if (
            effect.value &&
            typeof effect.value === 'string' &&
            effect.value.length > TRIGGER_FIELD_LIMITS.effectValue
          ) {
            result.triggers.oversizedEffects.push({
              path: `${triggerPath}.effects[${j}].value`,
              used: effect.value.length,
              limit: TRIGGER_FIELD_LIMITS.effectValue,
            });
          }
        }
      }
    }
  }

  // Location area descriptions
  if (config.locations) {
    for (const [locId, location] of Object.entries(config.locations)) {
      if (location.areas) {
        for (const [areaId, area] of Object.entries(location.areas)) {
          if (area.description && area.description.length > AREA_DESCRIPTION_LIMIT) {
            result.areas.oversized.push({
              path: `locations.${locId}.areas.${areaId}.description`,
              used: area.description.length,
              limit: AREA_DESCRIPTION_LIMIT,
            });
          }
        }
      }
    }
  }

  // Ability requirements count
  if (config.abilities) {
    for (const [abilityId, ability] of Object.entries(config.abilities)) {
      if (ability.requirements && ability.requirements.length > COUNT_LIMITS.abilityRequirements) {
        result.entries.oversized.push({
          path: `abilities.${abilityId}.requirements`,
          used: ability.requirements.length,
          limit: COUNT_LIMITS.abilityRequirements,
          type: 'count',
        });
      }
    }
  }

  return result;
}

function printReport(result, inputPath) {
  console.log('═'.repeat(70));
  console.log('  VOYAGE WORLD CONFIG CHARACTER COUNT REPORT');
  console.log(`  File: ${path.basename(inputPath)}`);
  console.log('═'.repeat(70));

  // Total
  console.log('\n📊 TOTAL CONFIG SIZE');
  console.log('─'.repeat(50));
  const totalStatus = getStatus(result.total.used, result.total.limit);
  console.log(
    `  ${formatNumber(result.total.used)} / ${formatNumber(result.total.limit)} characters  ${formatPercent(result.total.used, result.total.limit)}  ${totalStatus}`
  );

  // Sections
  console.log('\n📦 SECTION SIZES');
  console.log('─'.repeat(50));

  const sortedSections = Object.entries(result.sections).sort((a, b) => b[1].used - a[1].used);

  for (const [section, data] of sortedSections) {
    const status = getStatus(data.used, data.limit);
    const pct = formatPercent(data.used, data.limit);
    console.log(`  ${section.padEnd(20)} ${formatNumber(data.used).padStart(10)} / ${formatNumber(data.limit).padStart(10)}  ${pct.padStart(7)}  ${status}`);
  }

  // Fields
  if (Object.keys(result.fields).length > 0) {
    console.log('\n📝 FIELD SIZES');
    console.log('─'.repeat(50));
    for (const [field, data] of Object.entries(result.fields)) {
      const status = getStatus(data.used, data.limit);
      const pct = formatPercent(data.used, data.limit);
      console.log(`  ${field.padEnd(35)} ${formatNumber(data.used).padStart(7)} / ${formatNumber(data.limit).padStart(7)}  ${pct.padStart(7)}  ${status}`);
    }
  }

  // Counts
  if (Object.keys(result.counts).length > 0) {
    console.log('\n🔢 ELEMENT COUNTS');
    console.log('─'.repeat(50));
    for (const [element, data] of Object.entries(result.counts)) {
      const status = getStatus(data.used, data.limit);
      const pct = formatPercent(data.used, data.limit);
      console.log(`  ${element.padEnd(20)} ${String(data.used).padStart(5)} / ${String(data.limit).padStart(5)}  ${pct.padStart(7)}  ${status}`);
    }
  }

  // AI Instructions
  if (result.aiInstructions.tasks.length > 0) {
    console.log('\n🤖 AI INSTRUCTIONS');
    console.log('─'.repeat(50));

    for (const task of result.aiInstructions.tasks) {
      const status = getStatus(task.used, task.limit);
      console.log(
        `  ${task.path}: ${formatNumber(task.used)} / ` +
        `${formatNumber(task.limit)}  ${status}`
      );
    }

    if (result.aiInstructions.individual.length > 0) {
      console.log('\n  String leaves over limit:');
      for (const item of result.aiInstructions.individual) {
        console.log(
          `    🔴 ${item.path}: ${formatNumber(item.used)} / ` +
          `${formatNumber(item.limit)}`
        );
      }
    }
  }

  // Oversized entries
  const hasOversized =
    result.entries.oversized.length > 0 ||
    result.triggers.oversizedConditions.length > 0 ||
    result.triggers.oversizedEffects.length > 0 ||
    result.triggers.tooManyConditions.length > 0 ||
    result.triggers.tooManyEffects.length > 0 ||
    result.triggers.oversizedTriggers.length > 0 ||
    result.slides.oversized.length > 0 ||
    result.areas.oversized.length > 0 ||
    result.gameModes.oversizedFields.length > 0 ||
    result.imagePrompts.oversized.length > 0 ||
    (result.imagePrompts.total !== null && result.imagePrompts.total.used > result.imagePrompts.total.limit) ||
    result.settingsEntries.oversized.length > 0;

  if (hasOversized) {
    console.log('\n⚠️  LIMIT VIOLATIONS');
    console.log('─'.repeat(50));

    for (const item of result.entries.oversized) {
      console.log(`  🔴 ${item.path}`);
      console.log(`     ${formatNumber(item.used)} / ${formatNumber(item.limit)} ${item.type === 'count' ? 'items' : 'chars'}`);
    }

    for (const item of result.triggers.oversizedTriggers) {
      console.log(`  🔴 ${item.path}: trigger too large`);
      console.log(`     ${formatNumber(item.used)} / ${formatNumber(item.limit)} chars`);
    }

    for (const item of result.triggers.oversizedConditions) {
      console.log(`  🔴 ${item.path}`);
      console.log(`     ${formatNumber(item.used)} / ${formatNumber(item.limit)} chars`);
    }

    for (const item of result.triggers.oversizedEffects) {
      console.log(`  🔴 ${item.path}`);
      console.log(`     ${formatNumber(item.used)} / ${formatNumber(item.limit)} chars`);
    }

    for (const item of result.triggers.tooManyConditions) {
      console.log(`  🔴 ${item.path}: too many conditions`);
      console.log(`     ${item.used} / ${item.limit} conditions`);
    }

    for (const item of result.triggers.tooManyEffects) {
      console.log(`  🔴 ${item.path}: too many effects`);
      console.log(`     ${item.used} / ${item.limit} effects`);
    }

    for (const item of result.slides.oversized) {
      console.log(`  🔴 ${item.path}`);
      console.log(`     ${formatNumber(item.used)} / ${formatNumber(item.limit)} chars`);
    }

    for (const item of result.areas.oversized) {
      console.log(`  🔴 ${item.path}`);
      console.log(`     ${formatNumber(item.used)} / ${formatNumber(item.limit)} chars`);
    }

    for (const item of result.gameModes.oversizedFields) {
      console.log(`  🔴 ${item.path}`);
      console.log(`     ${formatNumber(item.used)} / ${formatNumber(item.limit)} chars`);
    }

    for (const item of result.imagePrompts.oversized) {
      console.log(`  🔴 ${item.path}`);
      console.log(`     ${formatNumber(item.used)} / ${formatNumber(item.limit)} chars`);
    }

    if (result.imagePrompts.total !== null && result.imagePrompts.total.used > result.imagePrompts.total.limit) {
      console.log(`  🔴 imagePromptConfiguration: total too large`);
      console.log(`     ${formatNumber(result.imagePrompts.total.used)} / ${formatNumber(result.imagePrompts.total.limit)} chars`);
    }

    for (const item of result.settingsEntries.oversized) {
      console.log(`  🔴 ${item.path}`);
      console.log(`     ${formatNumber(item.used)} / ${formatNumber(item.limit)} chars`);
    }
  }

  // Warnings (90%+ but not over)
  if (result.entries.warnings.length > 0) {
    console.log('\n⚡ APPROACHING LIMITS (90%+)');
    console.log('─'.repeat(50));
    for (const item of result.entries.warnings) {
      console.log(`  🟠 ${item.path}`);
      console.log(`     ${formatNumber(item.used)} / ${formatNumber(item.limit)} chars (${formatPercent(item.used, item.limit)})`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  const totalIssues =
    (result.total.used > result.total.limit ? 1 : 0) +
    Object.values(result.sections).filter((s) => s.used > s.limit).length +
    Object.values(result.fields).filter((f) => f.used > f.limit).length +
    Object.values(result.counts).filter((c) => c.used > c.limit).length +
    result.entries.oversized.length +
    result.triggers.oversizedConditions.length +
    result.triggers.oversizedEffects.length +
    result.triggers.tooManyConditions.length +
    result.triggers.tooManyEffects.length +
    result.triggers.oversizedTriggers.length +
    result.slides.oversized.length +
    result.areas.oversized.length +
    result.gameModes.oversizedFields.length +
    result.imagePrompts.oversized.length +
    (result.imagePrompts.total !== null && result.imagePrompts.total.used > result.imagePrompts.total.limit ? 1 : 0) +
    result.settingsEntries.oversized.length +
    result.aiInstructions.tasks.filter((task) => task.used > task.limit).length +
    result.aiInstructions.individual.length;

  if (totalIssues === 0) {
    console.log('  ✅ All counts within limits');
  } else {
    console.log(`  ❌ ${totalIssues} limit violation${totalIssues > 1 ? 's' : ''} found`);
  }
  console.log('═'.repeat(70));
}

function main() {
  const { options, positionals } = parseStrictArgs(
    process.argv.slice(2),
    {
      options: {
        '--world': { key: 'worldRoot', takesValue: true },
        '--json': { key: 'json' },
        '--help': { key: 'help', aliases: ['-h'] },
      },
      maxPositionals: 1,
    }
  );

  if (options.worldRoot && positionals.length > 0) {
    throw new Error('--world cannot be combined with a positional input path');
  }

  if (options.help) {
    console.log(
      'Usage: node .claude/scripts/count.js ' +
      '[world.json | tabs-directory | --world <world-root>] [--json]'
    );
    return 0;
  }

  let inputPath;
  let fullPath;

  if (options.worldRoot) {
    const resolved = resolveWorld({
      worldRoot: options.worldRoot,
      cwd: process.cwd(),
      preferNearest: false,
    });
    inputPath = options.worldRoot;
    fullPath = resolved.tabsPath;
  } else if (positionals.length > 0) {
    inputPath = positionals[0];
    fullPath = path.resolve(inputPath);
    const resolvedWorld = tryResolveExplicitWorldRoot(fullPath, { cwd: fullPath });
    if (resolvedWorld) fullPath = resolvedWorld.tabsPath;
  } else {
    const resolved = resolveWorld({ cwd: process.cwd() });
    inputPath = resolved.tabsPath;
    fullPath = resolved.tabsPath;
  }

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Path not found: ${inputPath}`);
  }

  const stats = fs.statSync(fullPath);
  let config;
  let displayPath = inputPath;

  if (stats.isDirectory()) {
    const merged = loadAndMergeTabs(fullPath);
    if (merged.files.length === 0) {
      throw new Error(`No JSON files found in ${inputPath}`);
    }
    config = merged.config;
    displayPath = `${inputPath} (${merged.files.length} files)`;
  } else {
    try {
      config = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    } catch (error) {
      throw new Error(`Error reading ${inputPath}: ${error.message}`);
    }
  }

  const result = analyzeConfig(config);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printReport(result, displayPath);
  }

  const hasViolations =
    result.total.used > result.total.limit ||
    Object.values(result.sections).some((s) => s.used > s.limit) ||
    Object.values(result.fields).some((f) => f.used > f.limit) ||
    Object.values(result.counts).some((c) => c.used > c.limit) ||
    result.entries.oversized.length > 0 ||
    result.triggers.oversizedConditions.length > 0 ||
    result.triggers.oversizedEffects.length > 0 ||
    result.triggers.tooManyConditions.length > 0 ||
    result.triggers.tooManyEffects.length > 0 ||
    result.triggers.oversizedTriggers.length > 0 ||
    result.slides.oversized.length > 0 ||
    result.areas.oversized.length > 0 ||
    result.gameModes.oversizedFields.length > 0 ||
    result.imagePrompts.oversized.length > 0 ||
    (
      result.imagePrompts.total !== null &&
      result.imagePrompts.total.used > result.imagePrompts.total.limit
    ) ||
    result.settingsEntries.oversized.length > 0 ||
    result.aiInstructions.tasks.some((task) => task.used > task.limit) ||
    result.aiInstructions.individual.length > 0;

  return hasViolations ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  analyzeConfig,
  main,
  printReport,
};
