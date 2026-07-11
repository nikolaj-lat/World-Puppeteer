#!/usr/bin/env node
// Upload an image to a self-hosted Trinetra (Trinetra) instance and print its
// public URL. The instance requires an API key; this script provisions one with
// no browser involved, exactly like the documented register -> key flow:
//
//   1) POST /auth/register  (username supplied by the operator, password generated
//      here, accept_terms:true) -> sets an authenticated session cookie
//   2) POST /api/keys        (reusing that cookie) -> returns the plaintext key once
//   3) POST /api/images      (multipart field "file", Authorization: Bearer <key>)
//
// The username, generated password, and minted key are persisted to a credentials
// file (default: trinetra.credentials in the project root) so later runs skip
// straight to step 3. Nothing here ever visits the website.
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: "string", short: "n" },
    // Purpose label written to the uploaded image's server-side name (the
    // `original_name` field), so /i/<url> is identifiable in the gallery/API.
    // e.g. "portrait_leo", "app-background". Set it to what the image is FOR.
    label: { type: "string", short: "l" },
    // Trinetra registration username (only used the first time, to provision an
    // account + key). Falls back to $TRINETRA_USERNAME.
    username: { type: "string", short: "U" },
    // Override the credentials file location. Falls back to $TRINETRA_CREDENTIALS.
    credentials: { type: "string", short: "c" },
  },
});

// Hardcoded default instance (test target). Override with $TRINETRA_BASE_URL.
const BASE_URL = (process.env.TRINETRA_BASE_URL || "https://trinetra.mahesvara.cloud").replace(/\/+$/, "");
const CREDENTIALS_PATH = values.credentials || process.env.TRINETRA_CREDENTIALS || "trinetra.credentials";

const filePath = positionals[0];

if (!filePath || !fs.existsSync(filePath)) {
  console.error("Usage: node upload-image.mjs -n <name> -U <username> <path/to/image.png>");
  console.error("  -U/--username is only needed on first run (to register + mint an API key).");
  process.exit(1);
}

// --- credentials store -------------------------------------------------------

function readCredentials() {
  try {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  } catch {
    return null; // missing or unreadable -> provision fresh
  }
}

function writeCredentials(creds) {
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2) + "\n", { mode: 0o600 });
  console.error(`Saved Trinetra credentials to ${CREDENTIALS_PATH}`);
}

// Generate a password that satisfies Trinetra's policy: >= 10 chars, at least one
// letter AND one digit, and at least two special (non-alphanumeric) characters.
function generatePassword() {
  const bytes = crypto.randomBytes(18).toString("base64url"); // letters+digits, URL-safe
  return `Aa1${bytes}!#`; // guarantees a letter, a digit, and >= 2 specials
}

// --- provisioning (register -> key), only when there is no cached key --------

async function provision(username) {
  if (!username) {
    console.error(
      "No API key cached and no username given. Pass -U <username> (or set " +
        "$TRINETRA_USERNAME) so the script can register an account and mint a key."
    );
    process.exit(1);
  }

  const password = generatePassword();

  // 1) Register. accept_terms:true is required; email is omitted (optional). A
  //    201 sets the session cookie we reuse to mint the key.
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password, accept_terms: true }),
  });
  if (!regRes.ok) {
    const body = await regRes.text().catch(() => "");
    console.error(`Registration failed: ${regRes.status} ${regRes.statusText} ${body}`);
    if (regRes.status === 409) {
      console.error(
        "That username is already taken. Either the credentials file was lost, or pick " +
          "a different -U <username>."
      );
    }
    process.exit(1);
  }
  // Grab the session cookie (connect.sid) set on the register response.
  const cookie = (regRes.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie) {
    console.error("Registration succeeded but no session cookie was returned; cannot mint a key.");
    process.exit(1);
  }

  // 2) Mint an API key using the fresh session. Plaintext key is returned once.
  const keyRes = await fetch(`${BASE_URL}/api/keys`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ label: "image-gen upload script" }),
  });
  if (!keyRes.ok) {
    const body = await keyRes.text().catch(() => "");
    console.error(`Key creation failed: ${keyRes.status} ${keyRes.statusText} ${body}`);
    process.exit(1);
  }
  const { key } = await keyRes.json();
  if (!key) {
    console.error("Key endpoint returned no key.");
    process.exit(1);
  }

  const creds = { base_url: BASE_URL, username, password, api_key: key, created_at: new Date().toISOString() };
  writeCredentials(creds);
  console.error(`Registered '${username}' and minted an API key on ${BASE_URL}.`);
  return creds;
}

// --- resolve an API key ------------------------------------------------------

// Prefer an explicit env key, then the credentials file (matched to this base
// URL), otherwise register + mint and persist.
async function getApiKey() {
  if (process.env.TRINETRA_API_KEY) return process.env.TRINETRA_API_KEY;

  const cached = readCredentials();
  if (cached && cached.api_key && cached.base_url === BASE_URL) {
    return cached.api_key;
  }
  if (cached && cached.api_key && cached.base_url !== BASE_URL) {
    console.error(
      `Cached credentials target ${cached.base_url}, but this run targets ${BASE_URL}; ` +
        "provisioning a new account/key for this instance."
    );
  }

  const username = values.username || process.env.TRINETRA_USERNAME || (cached && cached.username);
  const creds = await provision(username);
  return creds.api_key;
}

// --- upload ------------------------------------------------------------------

const apiKey = await getApiKey();

const file = new Blob([fs.readFileSync(filePath)]);
const form = new FormData();
form.set("file", file, path.basename(filePath)); // Trinetra's multipart field is "file"

const res = await fetch(`${BASE_URL}/api/images`, {
  method: "POST",
  headers: { authorization: `Bearer ${apiKey}` },
  body: form,
});

if (!res.ok) {
  const body = await res.text().catch(() => "");
  console.error(`Upload failed: ${res.status} ${res.statusText} ${body}`);
  process.exit(1);
}

const payload = await res.json();
const url = payload.url;
if (!url) {
  console.error(`Upload succeeded but response had no url: ${JSON.stringify(payload)}`);
  process.exit(1);
}
console.log(url);

// Name the image on the server so /i/<url> is identifiable later. Trinetra's
// PATCH /api/images/:id sets the cosmetic `original_name` (URL/id unchanged).
// Best-effort: the image is already hosted, so a rename hiccup must not fail here.
if (values.label && payload.id) {
  const name = String(values.label).trim().slice(0, 255);
  const patchRes = await fetch(`${BASE_URL}/api/images/${payload.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ name }),
  });
  if (patchRes.ok) {
    console.error(`Named image '${name}' (${payload.id})`);
  } else {
    const body = await patchRes.text().catch(() => "");
    console.error(`Warning: rename to '${name}' failed: ${patchRes.status} ${patchRes.statusText} ${body}`);
  }
}

// Move image and json to images/uploaded/
if (values.name) {
  const hash = url.split("/").pop().replace(/\.[a-z0-9]+$/i, "");
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
