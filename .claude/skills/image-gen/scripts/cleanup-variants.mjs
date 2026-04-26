#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    name: { type: "string", short: "n" },
    keep: { type: "string", short: "k" },
  },
});

if (!values.name || !values.keep) {
  console.error("Usage: node cleanup-variants.mjs -n <name> -k <variant-number>");
  console.error("  Moves all variants of <name> except the kept one to images/generated/unused/");
  console.error("  Example: node cleanup-variants.mjs -n korehira -k 004");
  process.exit(1);
}

const name = values.name;
const keep = values.keep.padStart(3, "0");
const imagesDir = path.join(process.cwd(), "images", "generated");
const jsonDir = path.join(imagesDir, "json");
const unusedDir = path.join(imagesDir, "unused");
const unusedJsonDir = path.join(unusedDir, "json");

fs.mkdirSync(unusedDir, { recursive: true });
fs.mkdirSync(unusedJsonDir, { recursive: true });

const keepFile = `${name}-${keep}.png`;
let moved = 0;

for (const file of fs.readdirSync(imagesDir)) {
  if (!file.startsWith(name + "-") || !file.endsWith(".png") || file === keepFile) continue;
  let destFile = file;
  let destPath = path.join(unusedDir, destFile);
  let suffix = 2;
  while (fs.existsSync(destPath)) {
    destFile = file.replace(".png", `_${suffix}.png`);
    destPath = path.join(unusedDir, destFile);
    suffix++;
  }
  fs.renameSync(path.join(imagesDir, file), destPath);
  moved++;

  const jsonFile = file.replace(".png", ".json");
  const jsonSrc = path.join(jsonDir, jsonFile);
  if (fs.existsSync(jsonSrc)) {
    const destJsonFile = destFile.replace(".png", ".json");
    const destJsonPath = path.join(unusedJsonDir, destJsonFile);
    fs.renameSync(jsonSrc, destJsonPath);
  }
}

console.log(`Kept ${keepFile}, moved ${moved} variant(s) to unused/`);
