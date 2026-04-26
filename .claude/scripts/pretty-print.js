#!/usr/bin/env node

/**
 * Voyage World Config Pretty Print Tool
 *
 * Formats all JSON files in tabs/ with consistent 2-space indentation.
 *
 * Usage:
 *   node pretty-print.js [directory]
 *   node pretty-print.js          # defaults to tabs/
 *   node pretty-print.js ./tabs/
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const inputDir = args.find((a) => !a.startsWith('-')) || path.join(__dirname, '../../tabs');

const fullPath = path.resolve(inputDir);

if (!fs.existsSync(fullPath)) {
    console.error(`Error: Directory not found: ${inputDir}`);
    process.exit(1);
}

const stats = fs.statSync(fullPath);
if (!stats.isDirectory()) {
    console.error(`Error: Not a directory: ${inputDir}`);
    process.exit(1);
}

const jsonFiles = fs.readdirSync(fullPath)
    .filter(f => f.endsWith('.json'))
    .sort();

if (jsonFiles.length === 0) {
    console.error(`Error: No JSON files found in ${inputDir}`);
    process.exit(1);
}

let formatted = 0;
let unchanged = 0;
let errors = 0;

for (const file of jsonFiles) {
    const filePath = path.join(fullPath, file);
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const pretty = JSON.stringify(parsed, null, 2) + '\n';

        if (content !== pretty) {
            fs.writeFileSync(filePath, pretty);
            console.log(`formatted: ${file}`);
            formatted++;
        } else {
            unchanged++;
        }
    } catch (err) {
        console.error(`error: ${file} - ${err.message}`);
        errors++;
    }
}

console.log(`\n${formatted} formatted, ${unchanged} unchanged, ${errors} errors`);
process.exit(errors > 0 ? 1 : 0);
