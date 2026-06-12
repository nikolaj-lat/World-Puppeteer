#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";

// Source API key from shell profile if not already set
if (!process.env.GEMINI_API_KEY) {
  try {
    if (process.platform === "win32") {
      const key = execSync("powershell -Command \"[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')\"", { encoding: "utf8" }).trim();
      if (key) process.env.GEMINI_API_KEY = key;
    } else {
      const key = execSync("grep '^export GEMINI_API_KEY=' ~/.zshrc", { encoding: "utf8" })
        .match(/GEMINI_API_KEY="?([^"'\n]+)"?/)?.[1];
      if (key) process.env.GEMINI_API_KEY = key;
    }
  } catch {}
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: "string", short: "m", default: "gemini-3.1-flash-image-preview" },
    ratio: { type: "string", short: "r" },
    size:  { type: "string", short: "s" },
    name:  { type: "string", short: "n" },
    input: { type: "string", short: "i", multiple: true },
  },
});

const prompt = positionals.join(" ");
const name = values.name;

if (!prompt || !name) {
  console.error("Usage: node generate-image.mjs -n <name> [options] <prompt>");
  console.error("");
  console.error("Options:");
  console.error("  -n, --name    Output name (required, e.g. 'onmyoji')");
  console.error("  -m, --model   Model ID (default: gemini-3.1-flash-image-preview)");
  console.error("  -r, --ratio   Aspect ratio: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3");
  console.error("  -s, --size    Resolution: 512, 1K, 2K, 4K");
  process.exit(1);
}

// Set up directories
const imagesDir = path.join(process.cwd(), "images", "generated");
const jsonDir = path.join(imagesDir, "json");
fs.mkdirSync(jsonDir, { recursive: true });

// Atomically claim the next available filename (safe for concurrent runs)
let i = 0;
let fd;
while (true) {
  const candidate = path.join(imagesDir, name + "-" + String(i).padStart(3, "0") + ".png");
  try {
    fd = fs.openSync(candidate, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
    break;
  } catch (e) {
    if (e.code === "EEXIST") { i++; continue; }
    throw e;
  }
}
const filename = name + "-" + String(i).padStart(3, "0");
fs.closeSync(fd);

const outputPath = path.join(imagesDir, filename + ".png");
const jsonPath = path.join(jsonDir, filename + ".json");

// Build config
const imageConfig = {};
if (values.ratio) imageConfig.aspectRatio = values.ratio;
if (values.size) imageConfig.imageSize = values.size;

// Build contents (text-only or text+image(s) for editing)
let contents;
const inputs = values.input || [];
if (inputs.length > 0) {
  contents = [{ text: prompt }];
  for (const inp of inputs) {
    const inputPath = path.resolve(inp);
    const imageData = fs.readFileSync(inputPath).toString("base64");
    const ext = path.extname(inputPath).toLowerCase();
    const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
    contents.push({ inlineData: { mimeType, data: imageData } });
  }
} else {
  contents = prompt;
}

// Generate (remove placeholder on failure so it doesn't block future increments)
const ai = new GoogleGenAI({});
let response;
try {
  response = await ai.models.generateContent({
    model: values.model,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      ...(Object.keys(imageConfig).length && { imageConfig }),
    },
  });
} catch (e) {
  fs.unlinkSync(outputPath);
  throw e;
}

let modelText = "";
for (const part of response.candidates[0].content.parts) {
  if (part.inlineData) {
    fs.writeFileSync(outputPath, Buffer.from(part.inlineData.data, "base64"));
    console.log(outputPath);
  } else if (part.text) {
    modelText += part.text;
    console.error(part.text);
  }
}

// Save metadata
const metadata = {
  prompt,
  model: values.model,
  ...(inputs.length > 0 && { input: inputs }),
  ...(values.ratio && { ratio: values.ratio }),
  ...(values.size && { size: values.size }),
  ...(modelText && { modelText }),
  date: new Date().toISOString(),
};
fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2) + "\n");
