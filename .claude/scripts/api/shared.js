'use strict';

/*
 * Shared Voyage Creator API client for World Puppeteer.
 *
 * - Reads the API key from .claude/secrets.env (dotenv format, single line:
 *   VOYAGE_CREATOR_API_KEY=...). The key is never exported, logged, or echoed.
 * - Reads/writes .creator-api.json in the project root: machine-written sync
 *   state (shortId, lastSyncedHash, lastSyncedAt) plus optional user settings
 *   (apiBase, remoteValidation, usageGuard), which saveState's merge preserves.
 * - Adds Authorization, a UUID Idempotency-Key on mutating POSTs, honors
 *   Retry-After on 429/503 (studio_unavailable is a clean, safe retry),
 *   and never sends an Origin header.
 * - Errors carry { status, code, message, requestId } with the key redacted.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.join(__dirname, '../../..');
const SECRETS_PATH = path.join(PROJECT_ROOT, '.claude', 'secrets.env');
const STATE_PATH = path.join(PROJECT_ROOT, '.creator-api.json');
const DEFAULT_API_BASE = 'https://api-alpha.aidungeon.com/creator/v1';
const MAX_BODY_BYTES = 64 * 1024 * 1024;
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_RETRIES = 3;

class CreatorApiError extends Error {
  constructor({ status, code, message, requestId, retryAfterSeconds }) {
    super(`${code || `http_${status}`}: ${message || 'request failed'}${requestId ? ` (requestId ${requestId})` : ''}`);
    this.name = 'CreatorApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function loadApiKey() {
  let raw;
  try {
    raw = fs.readFileSync(SECRETS_PATH, 'utf8');
  } catch {
    return null;
  }
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*VOYAGE_CREATOR_API_KEY\s*=\s*"?([^"\s#]+)"?\s*$/);
    if (match) return match[1];
  }
  return null;
}

function isConfigured() {
  return loadApiKey() !== null;
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(patch) {
  const state = { ...loadState(), ...patch };
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
  return state;
}

function getApiBase() {
  return loadState().apiBase || DEFAULT_API_BASE;
}

function redact(text) {
  const key = loadApiKey();
  if (!key || typeof text !== 'string') return text;
  return text.split(key).join('<redacted>');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function compactJson(value) {
  return JSON.stringify(value);
}

// Key-order-independent serialization: remote responses and locally merged tabs
// carry the same data in different key orders, so equality/hash comparisons must
// canonicalize or "in sync" would never be detected.
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sleep(seconds) {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * apiRequest({ method, path, body, etag, idempotent, timeoutMs })
 * - body: JS value serialized as JSON (skip for GET/DELETE)
 * - etag: sets If-Match
 * - idempotent: default true for POST -> sends a fresh Idempotency-Key
 * Returns { status, headers, json } for 2xx; throws CreatorApiError otherwise.
 */
async function apiRequest({ method, path: apiPath, body, etag, idempotent, timeoutMs = 60_000, retriesLeft = MAX_RETRIES }) {
  const key = loadApiKey();
  if (!key) {
    throw new CreatorApiError({
      status: 0,
      code: 'not_configured',
      message: `no API key found; create ${path.relative(PROJECT_ROOT, SECRETS_PATH)} per SETUP.md`,
    });
  }
  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };
  const init = { method, headers };
  if (body !== undefined) {
    const payload = JSON.stringify(body);
    if (Buffer.byteLength(payload) > MAX_BODY_BYTES) {
      throw new CreatorApiError({ status: 0, code: 'payload_too_large', message: 'request body exceeds the 64 MiB API limit' });
    }
    headers['Content-Type'] = 'application/json';
    init.body = payload;
  }
  if (etag) headers['If-Match'] = etag;
  if (method === 'POST' && idempotent !== false) headers['Idempotency-Key'] = crypto.randomUUID();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  init.signal = controller.signal;

  let response;
  try {
    response = await fetch(`${getApiBase()}${apiPath}`, init);
  } catch (err) {
    clearTimeout(timer);
    throw new CreatorApiError({ status: 0, code: 'network_unavailable', message: redact(err.message || String(err)) });
  }
  clearTimeout(timer);

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: redact(text.slice(0, 500)) };
  }

  if (response.ok) {
    return { status: response.status, headers: response.headers, json };
  }

  const retryAfterSeconds = Number(response.headers.get('retry-after')) || 5;
  const error = new CreatorApiError({
    status: response.status,
    code: json?.error?.code,
    message: redact(json?.error?.message || text.slice(0, 300)),
    requestId: json?.requestId,
    retryAfterSeconds,
  });

  // Clean availability/rate failures release the idempotency claim server-side,
  // but an exact retry must reuse the same request; we only auto-retry requests
  // that are safe to re-send verbatim (same body, fresh call).
  if (RETRYABLE_STATUS.has(response.status) && retriesLeft > 0) {
    await sleep(Math.min(retryAfterSeconds, 30));
    return apiRequest({ method, path: apiPath, body, etag, idempotent, timeoutMs, retriesLeft: retriesLeft - 1 });
  }
  throw error;
}

module.exports = {
  CreatorApiError,
  DEFAULT_API_BASE,
  PROJECT_ROOT,
  SECRETS_PATH,
  STATE_PATH,
  apiRequest,
  canonicalJson,
  compactJson,
  getApiBase,
  isConfigured,
  loadState,
  redact,
  saveState,
  sha256,
};
