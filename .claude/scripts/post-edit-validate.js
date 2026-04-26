#!/usr/bin/env node

/**
 * PostToolUse hook: Validate after Edit/Write to tabs/
 *
 * If validation fails, outputs JSON with decision: "block" and reason
 * so the agent sees the errors and can fix them.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.join(__dirname, '../..');
const tabsDir = path.join(projectDir, 'tabs');

// Read stdin to get file_path
let input = '';
try {
  input = fs.readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let filePath = '';
try {
  const data = JSON.parse(input);
  filePath = data.tool_input?.file_path || '';
} catch {
  process.exit(0);
}

// Only validate if edit was to tabs/
const normalizedPath = path.resolve(filePath);
const normalizedTabsDir = path.resolve(tabsDir);

if (!normalizedPath.startsWith(normalizedTabsDir)) {
  process.exit(0);
}

// Run pretty-print first
let prettyPrintErrors = null;
try {
  execSync('node .claude/scripts/pretty-print.js', {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
} catch (err) {
  // Capture pretty-print errors (usually malformed JSON)
  prettyPrintErrors = err.stdout || err.stderr || err.message;
}

// If pretty-print failed, block and prompt Claude to fix
if (prettyPrintErrors) {
  const output = {
    decision: 'block',
    reason: `JSON PARSE ERROR - fix the malformed JSON before continuing:\n${prettyPrintErrors}\n\nCheck for missing commas, brackets, or quotes.`
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

// Run validation - write to temp file to avoid buffer truncation
let validation = { errors: [], warnings: [] };
const tempFile = path.join(projectDir, '.claude', '.validate-output.json');
try {
  execSync(`node .claude/scripts/validate.js --json > "${tempFile}"`, {
    cwd: projectDir,
    encoding: 'utf8',
    shell: true,
  });
} catch {
  // Validate exits with code 1 on errors, but still writes output
}
if (fs.existsSync(tempFile)) {
  try {
    const content = fs.readFileSync(tempFile, 'utf8');
    validation = JSON.parse(content);
    fs.unlinkSync(tempFile);
  } catch {
    // Ignore parse errors
  }
}

if (validation.errors.length === 0) {
  // No errors - run build
  try {
    execSync('node .claude/scripts/build.js', {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    // Ignore build errors
  }
  process.exit(0);
}

// Errors found - analyze and suggest fixes
const errorDetails = validation.errors.map(e => {
  let msg = `${e.path || 'unknown'}: ${e.message}`;
  if (e.expected) msg += ` (valid: ${e.expected})`;
  if (e.actual) msg += ` (got: ${e.actual})`;
  return { msg, error: e };
});

// Detect what kind of fixes are needed
const needsSettings = errorDetails.some(d =>
  d.error.message?.includes('Invalid item category') ||
  d.error.message?.includes('Invalid item slot') ||
  d.error.message?.includes('Invalid damage type') ||
  d.error.message?.includes('Invalid skill type')
);

const needsLocations = errorDetails.some(d =>
  d.error.message?.includes('non-existent location') ||
  d.error.message?.includes('non-existent area')
);

const needsNpcs = errorDetails.some(d =>
  d.error.message?.includes('non-existent npc')
);

const needsNpcTypes = errorDetails.some(d =>
  d.error.message?.includes('non-existent npcType')
);

const needsItems = errorDetails.some(d =>
  d.error.message?.includes('non-existent item')
);

const needsFactions = errorDetails.some(d =>
  d.error.message?.includes('non-existent faction')
);

const needsRegions = errorDetails.some(d =>
  d.error.message?.includes('non-existent region')
);

const needsRealms = errorDetails.some(d =>
  d.error.message?.includes('non-existent realm')
);

const needsAbilities = errorDetails.some(d =>
  d.error.message?.includes('non-existent ability')
);

const needsSkills = errorDetails.some(d =>
  d.error.message?.includes('non-existent skill')
);

const needsTraits = errorDetails.some(d =>
  d.error.message?.includes('non-existent trait')
);

const needsResources = errorDetails.some(d =>
  d.error.message?.includes('non-existent resource')
);

const needsAttributes = errorDetails.some(d =>
  d.error.message?.includes('non-existent attribute')
);

// Build suggestion message
let suggestions = '\n\nTo fix, either:\n1. Change the invalid values to valid ones listed above';

const hasSkillSuggestions = needsSettings || needsLocations || needsNpcs || needsNpcTypes ||
  needsItems || needsFactions || needsRegions || needsRealms || needsAbilities || needsSkills ||
  needsTraits || needsResources || needsAttributes;

if (hasSkillSuggestions) {
  suggestions += `\n2. Use the Skill tool to load the relevant skill and create the missing thing:`;
  if (needsSettings) suggestions += `\n   - Skill tool with skill: "settings" to add missing categories/slots/damage types`;
  if (needsLocations) suggestions += `\n   - Skill tool with skill: "locations" to create the missing location or area`;
  if (needsNpcs) suggestions += `\n   - Skill tool with skill: "npcs" to create the missing NPC`;
  if (needsNpcTypes) suggestions += `\n   - Skill tool with skill: "npc-types" to create the missing NPC type`;
  if (needsItems) suggestions += `\n   - Skill tool with skill: "items" to create the missing item`;
  if (needsFactions) suggestions += `\n   - Skill tool with skill: "factions" to create the missing faction`;
  if (needsRegions) suggestions += `\n   - Skill tool with skill: "regions" to create the missing region`;
  if (needsRealms) suggestions += `\n   - Skill tool with skill: "realms" to create the missing realm`;
  if (needsAbilities) suggestions += `\n   - Skill tool with skill: "abilities" to create the missing ability`;
  if (needsSkills) suggestions += `\n   - Skill tool with skill: "skills" to create the missing skill`;
  if (needsTraits) suggestions += `\n   - Skill tool with skill: "traits" to create the missing trait`;
  if (needsResources) suggestions += `\n   - Skill tool with skill: "settings" to add the missing resource in resourceSettings`;
  if (needsAttributes) suggestions += `\n   - Skill tool with skill: "settings" to add the missing attribute in attributeSettings`;
}

const errorMessages = errorDetails.map(d => d.msg).join('\n');

const output = {
  decision: 'block',
  reason: `VALIDATION ERRORS:\n${errorMessages}${suggestions}`
};

console.log(JSON.stringify(output));
process.exit(0);
