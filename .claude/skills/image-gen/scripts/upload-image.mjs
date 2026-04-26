#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: "string", short: "n" },
    userhash: { type: "string", short: "u" },
  },
});

const userhash = values.userhash || process.env.CATBOX_USERHASH;

const filePath = positionals[0];

if (!filePath || !fs.existsSync(filePath)) {
  console.error("Usage: node upload-image.mjs -n <name> <path/to/image.png>");
  process.exit(1);
}

const file = new Blob([fs.readFileSync(filePath)]);
const form = new FormData();
form.set("reqtype", "fileupload");
if (userhash) form.set("userhash", userhash);
form.set("fileToUpload", file, path.basename(filePath));

const res = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: form });

if (!res.ok) {
  console.error(`Upload failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const url = (await res.text()).trim();
console.log(url);

// Move image and json to images/uploaded/
if (values.name) {
  const hash = url.split("/").pop().replace(".png", "");
  const imagesDir = path.dirname(filePath);
  const uploadedDir = path.join(imagesDir, "..", "uploaded");
  const uploadedJsonDir = path.join(uploadedDir, "json");
  fs.mkdirSync(uploadedJsonDir, { recursive: true });

  const destImg = path.join(uploadedDir, `${values.name}-${hash}.png`);
  fs.renameSync(filePath, destImg);
  console.error(`Moved to ${destImg}`);

  const srcJson = path.join(imagesDir, "json", path.basename(filePath, ".png") + ".json");
  if (fs.existsSync(srcJson)) {
    const destJson = path.join(uploadedJsonDir, `${values.name}-${hash}.json`);
    const meta = JSON.parse(fs.readFileSync(srcJson, "utf8"));
    meta.url = url;
    fs.writeFileSync(srcJson, JSON.stringify(meta, null, 2) + "\n");
    fs.renameSync(srcJson, destJson);
    console.error(`Moved to ${destJson}`);
  }
}
