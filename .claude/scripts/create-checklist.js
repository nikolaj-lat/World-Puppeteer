#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectDir = path.join(__dirname, '../..');
const stuffDir = path.join(projectDir, 'stuff');
const checklistPath = path.join(stuffDir, 'checklist.md');
const tabsDir = path.join(projectDir, 'tabs');

if (fs.existsSync(checklistPath)) {
  process.exit(0);
}

if (!fs.existsSync(stuffDir)) {
  fs.mkdirSync(stuffDir);
}

// Build sections from tabs/ files
const sections = [];
if (fs.existsSync(tabsDir)) {
  for (const file of fs.readdirSync(tabsDir).sort()) {
    if (file.endsWith('.json') && file !== 'meta.json') {
      const acronyms = ['ai', 'npc', 'npcs'];
      const name = file.replace('.json', '')
        .split('-').map(w => acronyms.includes(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      sections.push(`### ${name}\n- [ ] Initial pass`);
    }
  }
}

const content = `# World Checklist

## Done

## Active

## Up Next

${sections.join('\n\n')}
`;

fs.writeFileSync(checklistPath, content);
console.log('Created stuff/checklist.md');
