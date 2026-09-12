#!/usr/bin/env node
// Official Voyage image upload (allowance -> PUT bytes -> moderate -> canonical URL).
// Same contract as the old uploader: prints the URL alone to stdout, and with -n
// moves the image (and its metadata json) to images/uploaded/{name}-{hash}.png.
// Requires the Creator API to be set up (SETUP.md Step 5) and a pinned world.
//
// Usage: node upload-image.mjs -n <name> [-t TARGET] <path/to/image.png>
// Targets: NPC_PORTRAIT (default), AREA_IMAGE, LOCATION_IMAGE, REGION_MAP_IMAGE
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { apiRequest, loadState } = require("../../../scripts/api/shared.js");

const TARGETS = ["NPC_PORTRAIT", "AREA_IMAGE", "LOCATION_IMAGE", "REGION_MAP_IMAGE"];
const MIME_BY_EXT = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: "string", short: "n" },
    target: { type: "string", short: "t", default: "NPC_PORTRAIT" },
    width: { type: "string" },
    height: { type: "string" },
  },
});

const filePath = positionals[0];

if (!filePath || !fs.existsSync(filePath) || !TARGETS.includes(values.target)) {
  console.error("Usage: node upload-image.mjs -n <name> [-t TARGET] <path/to/image.png>");
  console.error(`Targets: ${TARGETS.join(", ")} (default NPC_PORTRAIT)`);
  process.exit(1);
}

const state = loadState();
if (!state.shortId) {
  console.error("No world pinned; pull a world first (creator-api skill).");
  process.exit(1);
}

const mimeType = MIME_BY_EXT[path.extname(filePath).toLowerCase()];
if (!mimeType) {
  console.error("Unsupported image type; use png, jpeg, or webp.");
  process.exit(1);
}
const bytes = fs.readFileSync(filePath);
if (bytes.length > 5 * 1024 * 1024) {
  console.error(`Image is ${(bytes.length / 1024 / 1024).toFixed(1)} MiB; the limit is 5 MiB.`);
  process.exit(1);
}

let width = Number(values.width) || 0;
let height = Number(values.height) || 0;
if (!width || !height) {
  try {
    const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath], { encoding: "utf8" });
    width = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1]) || 0;
    height = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1]) || 0;
  } catch {}
}
if (!width || !height) {
  console.error("Could not read image dimensions; pass --width and --height.");
  process.exit(1);
}
if (width < 600 || height < 600) {
  console.error(`Image is ${width}x${height}; both dimensions must be at least 600.`);
  process.exit(1);
}

const cleanup = async (uploadId) => {
  try {
    await apiRequest({ method: "DELETE", path: `/uploads/${encodeURIComponent(uploadId)}` });
    console.error(`Cleaned up upload ${uploadId}.`);
  } catch (err) {
    console.error(`Cleanup of upload ${uploadId} failed (${err.message}); delete it manually later.`);
  }
};

let url;
try {
  const allowance = await apiRequest({
    method: "POST",
    path: "/uploads",
    body: { target: values.target, mimeType, width, height },
  });
  const { uploadId, directUploadUrl } = allowance.json.data;

  const putResponse = await fetch(directUploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: bytes });
  if (!putResponse.ok) {
    console.error(`Byte upload failed: ${putResponse.status} ${putResponse.statusText}`);
    await cleanup(uploadId);
    process.exit(1);
  }

  try {
    const moderated = await apiRequest({
      method: "POST",
      path: `/worlds/${encodeURIComponent(state.shortId)}/uploads/${encodeURIComponent(uploadId)}/moderate`,
      body: { target: values.target },
      timeoutMs: 120_000,
    });
    url = moderated.json.data.imageUrl;
  } catch (err) {
    if (err.code === "studio_media_failed") {
      console.error(`Moderation rejected the image: ${err.message}`);
      console.error("This is a settled rejection. Correct the image and run again.");
    } else {
      console.error(`Moderation failed: ${err.message}`);
    }
    await cleanup(uploadId);
    process.exit(1);
  }
} catch (err) {
  console.error(`Upload failed: ${err.message}`);
  process.exit(1);
}

console.log(url);

// Move image and json to images/uploaded/
if (values.name) {
  const hash = path.basename(url.split("/").pop(), path.extname(url.split("/").pop()));
  const imagesDir = path.dirname(filePath);
  const uploadedDir = path.join(imagesDir, "..", "uploaded");
  const uploadedJsonDir = path.join(uploadedDir, "json");
  fs.mkdirSync(uploadedJsonDir, { recursive: true });

  const destImg = path.join(uploadedDir, `${values.name}-${hash}${path.extname(filePath)}`);
  fs.renameSync(filePath, destImg);
  console.error(`Moved to ${destImg}`);

  const srcJson = path.join(imagesDir, "json", path.basename(filePath, path.extname(filePath)) + ".json");
  if (fs.existsSync(srcJson)) {
    const destJson = path.join(uploadedJsonDir, `${values.name}-${hash}.json`);
    const meta = JSON.parse(fs.readFileSync(srcJson, "utf8"));
    meta.url = url;
    fs.writeFileSync(srcJson, JSON.stringify(meta, null, 2) + "\n");
    fs.renameSync(srcJson, destJson);
    console.error(`Moved to ${destJson}`);
  }
}
