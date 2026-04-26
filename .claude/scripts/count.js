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

// Section character limits (from validation.md)
const SECTION_LIMITS = {
  worldLore: 500_000,
  npcs: 1_000_000,
  locations: 1_000_000,
  npcTypes: 500_000,
  items: 100_000,
  factions: 100_000,
  regions: 100_000,
  traitCategories: 100_000,
  itemSettings: 5_000,
};

// Total config limit
const TOTAL_CONFIG_LIMIT = 10_000_000;

// Field character limits
const FIELD_LIMITS = {
  'storySettings.worldBackground': 5_000,
  'storySettings.questGenerationGuidance': 5_000,
  narratorStyle: 2_000,
  'death.instructions': 4_000,
};

// Individual entry limits
const ENTRY_LIMITS = {
  worldLore: { text: 4_000 },
  storyStarts: { combined: 4_000 },
  items: { description: 4_000 },
  factions: { basicInfo: 4_000, hiddenInfo: 4_000 },
  npcTypes: { description: 8_000 },
  npcs: { combined: 8_000 },
  regions: { basicInfo: 4_000, hiddenInfo: 4_000 },
  locations: { basicInfo: 4_000, hiddenInfo: 4_000 },
  traits: { description: 4_000 },
  abilities: { description: 2_000 },
  realms: { basicInfo: 100_000 },
};

// Count limits
const COUNT_LIMITS = {
  storyStarts: 100,
  semanticTriggers: 200, // triggers with story/action conditions
  mechanicalTriggers: 500, // triggers without story/action conditions
  abilities: 1_000,
  triggerConditions: 5, // per trigger
  triggerEffects: 5, // per trigger
  triggerSize: 10_000, // per trigger
  abilityRequirements: 10, // per ability
};

// AI instruction limits
const AI_INSTRUCTION_INDIVIDUAL_LIMIT = 5_000;
const AI_INSTRUCTION_COMBINED_LIMIT = 20_000;

// Trigger field limits
const TRIGGER_FIELD_LIMITS = {
  conditionQuery: 1_000,
  conditionValue: 100,
  effectInstruction: 1_000,
  effectValue: 100,
};

// Area description limit
const AREA_DESCRIPTION_LIMIT = 4_000;

function getJsonLength(obj) {
  // Use pretty-printing (2-space indent) to match how world configs are stored
  return JSON.stringify(obj, null, 2).length;
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
      combinedTotal: 0,
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
    const hasSemantic = (trigger) =>
      trigger.conditions && trigger.conditions.some((c) => c.type === 'story' || c.type === 'action');
    let semanticCount = 0;
    let mechanicalCount = 0;
    for (const trigger of triggerValues) {
      if (hasSemantic(trigger)) semanticCount++;
      else mechanicalCount++;
    }
    result.counts.semanticTriggers = { used: semanticCount, limit: COUNT_LIMITS.semanticTriggers };
    result.counts.mechanicalTriggers = { used: mechanicalCount, limit: COUNT_LIMITS.mechanicalTriggers };
  }

  if (config.abilities) {
    const count = Object.keys(config.abilities).length;
    result.counts.abilities = { used: count, limit: COUNT_LIMITS.abilities };
  }

  // Entry-level analysis
  const analyzeEntries = (section, entries, limits) => {
    if (!entries) return;
    const items = Array.isArray(entries) ? entries : Object.entries(entries);

    for (const item of items) {
      const [id, entry] = Array.isArray(entries) ? [items.indexOf(item), item] : item;

      if (!entry || typeof entry !== 'object') continue;

      // Check combined length for NPCs
      if (section === 'npcs' && limits.combined) {
        const combined = getJsonLength(entry);
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

  // AI Instructions analysis
  if (config.aiInstructions) {
    let combinedTotal = 0;
    for (const [taskId, taskInstructions] of Object.entries(config.aiInstructions)) {
      if (Array.isArray(taskInstructions)) {
        for (let i = 0; i < taskInstructions.length; i++) {
          const instr = taskInstructions[i];
          if (typeof instr === 'string') {
            const len = instr.length;
            combinedTotal += len;
            if (len > AI_INSTRUCTION_INDIVIDUAL_LIMIT) {
              result.aiInstructions.individual.push({
                path: `aiInstructions.${taskId}[${i}]`,
                used: len,
                limit: AI_INSTRUCTION_INDIVIDUAL_LIMIT,
              });
            }
          } else if (instr && typeof instr === 'object' && instr.instruction) {
            const len = instr.instruction.length;
            combinedTotal += len;
            if (len > AI_INSTRUCTION_INDIVIDUAL_LIMIT) {
              result.aiInstructions.individual.push({
                path: `aiInstructions.${taskId}[${i}].instruction`,
                used: len,
                limit: AI_INSTRUCTION_INDIVIDUAL_LIMIT,
              });
            }
          }
        }
      }
    }
    result.aiInstructions.combinedTotal = combinedTotal;
    result.aiInstructions.combinedLimit = AI_INSTRUCTION_COMBINED_LIMIT;
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
  if (result.aiInstructions.combinedTotal > 0) {
    console.log('\n🤖 AI INSTRUCTIONS');
    console.log('─'.repeat(50));
    const status = getStatus(result.aiInstructions.combinedTotal, result.aiInstructions.combinedLimit);
    console.log(`  Combined total: ${formatNumber(result.aiInstructions.combinedTotal)} / ${formatNumber(result.aiInstructions.combinedLimit)}  ${status}`);
    if (result.aiInstructions.individual.length > 0) {
      console.log('\n  Individual instructions over limit:');
      for (const item of result.aiInstructions.individual) {
        console.log(`    🔴 ${item.path}: ${formatNumber(item.used)} / ${formatNumber(item.limit)}`);
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
    result.areas.oversized.length > 0;

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
    (result.aiInstructions.combinedTotal > result.aiInstructions.combinedLimit ? 1 : 0) +
    result.aiInstructions.individual.length;

  if (totalIssues === 0) {
    console.log('  ✅ All counts within limits');
  } else {
    console.log(`  ❌ ${totalIssues} limit violation${totalIssues > 1 ? 's' : ''} found`);
  }
  console.log('═'.repeat(70));
}

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const inputPath = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '../../tabs');

  const fullPath = path.resolve(inputPath);

  if (!fs.existsSync(fullPath)) {
    console.error(`Error: Path not found: ${inputPath}`);
    process.exit(1);
  }

  // Check if input is a directory
  const stats = fs.statSync(fullPath);
  let config;
  let displayPath = inputPath;

  if (stats.isDirectory()) {
    // Merge all JSON files in directory
    const jsonFiles = fs.readdirSync(fullPath)
      .filter(f => f.endsWith('.json'))
      .sort()
      .map(f => path.join(fullPath, f));

    if (jsonFiles.length === 0) {
      console.error(`Error: No JSON files found in ${inputPath}`);
      process.exit(1);
    }

    config = {};
    for (const file of jsonFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(content);
        Object.assign(config, parsed);
      } catch (err) {
        console.error(`Error reading ${path.basename(file)}: ${err.message}`);
        process.exit(1);
      }
    }
    displayPath = `${inputPath} (${jsonFiles.length} files)`;
  } else {
    // Single file
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      config = JSON.parse(content);
    } catch (err) {
      console.error(`Error reading ${inputPath}: ${err.message}`);
      process.exit(1);
    }
  }

  const result = analyzeConfig(config);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printReport(result, displayPath);
  }

  // Exit with error code if over limits
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
    result.aiInstructions.combinedTotal > result.aiInstructions.combinedLimit ||
    result.aiInstructions.individual.length > 0;

  process.exit(hasViolations ? 1 : 0);
}

main();
