#!/usr/bin/env node
// generate-comfy.mjs — SERVER-BASED ALTERNATIVE generator.
//
// The default generator is now ../cli.exe, which talks DIRECTLY to a running
// ComfyUI instance (127.0.0.1:8188) and needs no persistent server. Use this
// script only when the comfyui-api FastAPI server is already running. See
// SKILL.md ("Server-based alternative") for when to prefer which.
//
// text-to-image (and img2img) via the local comfyui-api FastAPI server (see
// the comfyui-api project README).
//
// Server: http://127.0.0.1:5000  (async: submit job -> poll -> download PNG)
// Images are kept IN MEMORY by the server and are only collected when the job
// is submitted with allow_preview=true, so this script always sends it.
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name:     { type: "string",  short: "n" },
    workflow: { type: "string",  short: "w", default: "base_workflow.json" },
    host:     { type: "string", default: "127.0.0.1:5000" }, // which comfyui-api to hit
    negative: { type: "string" },
    width:    { type: "string" },
    height:   { type: "string" },
    batch:    { type: "string", short: "b" },
    index:    { type: "string", default: "-1" },
    input:    { type: "string", short: "i" },      // img2img source image
    "no-preview": { type: "boolean", default: false },
  },
});

// Accept "host:port" or a full URL; default scheme is http://
const API = /^https?:\/\//.test(values.host) ? values.host.replace(/\/$/, "") : `http://${values.host}`;

const prompt = positionals.join(" ");
const name = values.name;

// Painterly-leaning default negative (matches the world's semi-realistic style).
const DEFAULT_NEGATIVE =
  "flat colors, cel shading, clean lineart, anime screencap, bright flat anime, " +
  "lowres, watermark, text, signature, blurry, extra limbs, deformed, 3d render, photograph";

if (!prompt || !name) {
  console.error("Usage: node generate-comfy.mjs -n <name> [options] <prompt>");
  console.error("");
  console.error("Options:");
  console.error("  -n, --name       Output name (required, e.g. 'leo'). Auto-increments.");
  console.error("  -w, --workflow   Workflow file (default: base_workflow.json). Prompt format depends on the workflow.");
  console.error("      --host       comfyui-api host:port or URL (default: 127.0.0.1:5000)");
  console.error("      --negative   Negative prompt (default: painterly-leaning quality negative)");
  console.error("      --width      Width override (default: workflow's own / 832)");
  console.error("      --height     Height override (default: workflow's own / 1216)");
  console.error("  -b, --batch      batch_size (default: workflow's own)");
  console.error("      --index      Which image to fetch, execution order. -1 = final (default)");
  console.error("  -i, --input      Source image for img2img (uses /generate/img2img)");
  console.error("      --no-preview Do not request preview frames (NOT recommended; images may be uncollectable)");
  process.exit(1);
}

const isImg2img = !!values.input;
const allowPreview = !values["no-preview"];

// ---- directories + atomic filename claim ----
const imagesDir = path.join(process.cwd(), "images", "generated");
const jsonDir = path.join(imagesDir, "json");
fs.mkdirSync(jsonDir, { recursive: true });

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

const fail = (msg) => {
  try { fs.unlinkSync(outputPath); } catch {}
  console.error(msg);
  process.exit(1);
};

// ---- submit ----
let jobId;
try {
  let res;
  if (isImg2img) {
    const inputPath = path.resolve(values.input);
    const buf = fs.readFileSync(inputPath);
    const form = new FormData();
    form.set("image", new Blob([buf], { type: "image/png" }), path.basename(inputPath));
    form.set("prompt", prompt);
    form.set("negative_prompt", values.negative ?? DEFAULT_NEGATIVE);
    form.set("workflow", values.workflow);
    if (values.width) form.set("width", values.width);
    if (values.height) form.set("height", values.height);
    if (values.batch) form.set("batch_size", values.batch);
    form.set("allow_preview", String(allowPreview));
    res = await fetch(`${API}/generate/img2img`, { method: "POST", body: form });
  } else {
    const body = {
      workflow: values.workflow,
      prompt,
      negative_prompt: values.negative ?? DEFAULT_NEGATIVE,
      allow_preview: allowPreview,
    };
    if (values.width) body.width = Number(values.width);
    if (values.height) body.height = Number(values.height);
    if (values.batch) body.batch_size = Number(values.batch);
    res = await fetch(`${API}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  if (!res.ok) fail(`Submit failed: ${res.status} ${res.statusText} — ${await res.text()}`);
  const data = await res.json();
  jobId = data.job_id;
  if (!jobId) fail(`Submit returned no job_id: ${JSON.stringify(data)}`);
} catch (e) {
  fail(`Could not reach comfyui-api at ${API} — is the server running? (${e.message})`);
}

console.error(`job ${jobId} submitted (workflow=${values.workflow}, preview=${allowPreview})`);

// ---- poll ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastLine = "";
const POLL_MS = 3000;
const TIMEOUT_MS = 10 * 60 * 1000; // 10 min cap (first run loads the model, can be slow)
const start = Date.now();

while (true) {
  if (Date.now() - start > TIMEOUT_MS) fail(`Timed out after ${TIMEOUT_MS / 1000}s waiting for job ${jobId}`);
  let job;
  try {
    const r = await fetch(`${API}/jobs/${jobId}`);
    if (!r.ok) fail(`Status check failed: ${r.status} ${r.statusText}`);
    job = await r.json();
  } catch (e) {
    fail(`Lost connection to comfyui-api while polling (${e.message})`);
  }
  const p = job.progress || {};
  const line =
    p.phase === "sampling"
      ? `sampling ${p.step ?? "?"}/${p.max ?? "?"}`
      : p.phase === "nodes"
      ? `nodes ${p.done ?? "?"}/${p.total ?? "?"}`
      : (p.phase || job.status || "...");
  if (line !== lastLine) { console.error(`  ${line}`); lastLine = line; }

  if (job.status === "done") break;
  if (job.status === "error" || job.status === "failed") {
    fail(`Job ${jobId} ${job.status}: ${job.error || "(no error message)"}`);
  }
  await sleep(POLL_MS);
}

// ---- download ----
try {
  const r = await fetch(`${API}/jobs/${jobId}/image?index=${encodeURIComponent(values.index)}`);
  if (!r.ok) {
    fail(`Job finished but no image at index=${values.index} (${r.status}). ` +
         `If you used --no-preview, retry without it: the server only keeps images in memory when allow_preview is set.`);
  }
  const ab = await r.arrayBuffer();
  const buf = Buffer.from(ab);
  // Guard against a JSON error body sneaking in with a 200.
  if (buf.length < 100 || !(buf[0] === 0x89 && buf[1] === 0x50)) {
    fail(`Downloaded data is not a PNG (got ${buf.length} bytes: ${buf.toString("utf8").slice(0, 120)})`);
  }
  fs.writeFileSync(outputPath, buf);
  console.log(outputPath);
} catch (e) {
  fail(`Failed to download image for job ${jobId}: ${e.message}`);
}

// ---- metadata ----
const metadata = {
  prompt,
  workflow: values.workflow,
  negative_prompt: values.negative ?? DEFAULT_NEGATIVE,
  ...(isImg2img && { input: values.input }),
  ...(values.width && { width: values.width }),
  ...(values.height && { height: values.height }),
  ...(values.batch && { batch_size: values.batch }),
  index: values.index,
  allow_preview: allowPreview,
  job_id: jobId,
  date: new Date().toISOString(),
};
fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2) + "\n");
