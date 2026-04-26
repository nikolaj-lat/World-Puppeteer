#!/usr/bin/env node
/**
 * Portrait picker server.
 * Watches images/generated/ and serves a manifest + static files.
 * Usage: node .claude/scripts/serve-portraits.mjs
 * Opens http://localhost:3456 in the browser.
 */

import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const PORT = 3456;
const ROOT = resolve(process.cwd());
const IMG_DIR = join(ROOT, 'images', 'generated');

let manifest = {};

async function buildManifest() {
  const files = await readdir(IMG_DIR).catch(() => []);
  const groups = {};
  for (const f of files) {
    if (!f.endsWith('.png')) continue;
    const m = f.match(/^(.+)-(\d{3})\.png$/);
    if (!m) continue;
    const [, name, num] = m;
    if (!groups[name]) groups[name] = [];
    groups[name].push({ file: f, num });
  }
  // Sort variants within each group
  for (const name of Object.keys(groups)) {
    groups[name].sort((a, b) => a.num.localeCompare(b.num));
  }
  manifest = groups;
}

// Build initial manifest
await buildManifest();

// Watch for changes
watch(IMG_DIR, { persistent: true }, () => {
  buildManifest();
});

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.css': 'text/css',
};

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Portrait Picker</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #1a1a2e; color: #eee; font-family: 'Segoe UI', system-ui, sans-serif; padding: 2rem 3rem; }
  h1 { text-align: center; color: #f0a040; margin-bottom: 0.5rem; font-size: 2rem; }
  .subtitle { text-align: center; color: #888; margin-bottom: 2rem; font-size: 0.9rem; }

  .npc-row { margin-bottom: 2rem; padding: 1.25rem; background: #16213e; border-radius: 12px; }
  .npc-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
  .npc-header h2 { color: #f0a040; font-size: 1.4rem; }
  .npc-count { color: #888; font-size: 0.85rem; }
  .npc-actions { display: flex; gap: 0.5rem; margin-left: auto; }
  .npc-actions button {
    background: #0f3460; color: #aaa; border: 1px solid #333;
    padding: 0.3rem 0.75rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer;
  }
  .npc-actions button:hover { background: #1a4a80; color: #eee; }

  .variants { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; }
  .variant {
    position: relative; cursor: pointer;
    border: 3px solid transparent; border-radius: 8px; overflow: hidden;
    transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s, opacity 0.3s, max-height 0.4s, margin 0.4s, padding 0.4s;
    aspect-ratio: 1;
  }
  .variant:hover { transform: scale(1.03); z-index: 2; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
  .variant.picked { border-color: #f0a040; box-shadow: 0 0 24px rgba(240,160,64,0.5); }
  .variant.rejected {
    display: none;
  }
  .variant img {
    display: block; width: 100%; height: 100%; object-fit: cover;
    image-rendering: -webkit-optimize-contrast;
  }
  .variant-label {
    position: absolute; bottom: 0; left: 0; right: 0;
    background: rgba(0,0,0,0.65); color: #fff; text-align: center;
    padding: 3px; font-size: 0.75rem; font-weight: bold;
    opacity: 0; transition: opacity 0.2s;
  }
  .variant:hover .variant-label { opacity: 1; }
  .variant.picked .variant-label { opacity: 1; background: rgba(240,160,64,0.8); color: #1a1a2e; }

  .summary {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: #0f3460; padding: 1rem 2rem;
    display: flex; justify-content: space-between; align-items: center;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.5); z-index: 100; gap: 1rem;
  }
  .summary-text { font-size: 0.9rem; flex: 1; }
  .summary-buttons { display: flex; gap: 0.5rem; }
  .summary button {
    background: #f0a040; color: #1a1a2e; border: none;
    padding: 0.5rem 1.2rem; border-radius: 6px;
    font-size: 0.85rem; font-weight: bold; cursor: pointer; white-space: nowrap;
  }
  .summary button:hover { background: #ffb860; }
  .summary button.secondary { background: #334; color: #aaa; }
  .summary button.secondary:hover { background: #445; color: #eee; }
  .summary button.danger { background: #633; color: #e88; }
  .summary button.danger:hover { background: #844; color: #fff; }
  .spacer { height: 5rem; }

  .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.3rem; }
  .status-dot.live { background: #4f4; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

  @media (max-width: 1200px) { .variants { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 700px) { .variants { grid-template-columns: repeat(2, 1fr); } }
</style>
</head>
<body>

<h1>Portrait Picker</h1>
<p class="subtitle"><span class="status-dot live"></span>Live &mdash; Left-click to reject. Right-click to pick. New images appear automatically.</p>

<div id="rows"></div>
<div class="spacer"></div>

<div class="summary">
  <div class="summary-text" id="picks-summary">No picks yet</div>
  <div class="summary-buttons">
    <button onclick="copyPicks()">Copy Picks</button>
    <button class="secondary" onclick="copyRemaining()">Copy Remaining</button>
    <button class="secondary" onclick="sortAll()">Sort</button>
    <button class="danger" onclick="resetAll()">Reset</button>
  </div>
</div>

<script>
const state = loadState();
let manifest = {};

function loadState() {
  try {
    return JSON.parse(localStorage.getItem('portrait-picker') || '{}');
  } catch { return {}; }
}
function saveState() {
  localStorage.setItem('portrait-picker', JSON.stringify(state));
}
function npcState(npc) {
  if (!state[npc]) state[npc] = { pick: null, rejected: [] };
  return state[npc];
}

function render() {
  const container = document.getElementById('rows');
  const npcs = Object.keys(manifest).sort();

  for (const npc of npcs) {
    let row = document.getElementById('row-' + npc);
    if (!row) {
      row = document.createElement('div');
      row.className = 'npc-row';
      row.id = 'row-' + npc;
      row.dataset.npc = npc;
      row.innerHTML = \`
        <div class="npc-header">
          <h2>\${npc}</h2>
          <span class="npc-count" id="count-\${npc}"></span>
          <div class="npc-actions">
            <button onclick="pickRemaining('\${npc}')">Pick remaining</button>
            <button onclick="unrejAll('\${npc}')">Restore all</button>
          </div>
        </div>
        <div class="variants" id="variants-\${npc}"></div>
      \`;
      container.appendChild(row);
    }

    const varContainer = document.getElementById('variants-' + npc);
    const variants = manifest[npc];
    const ns = npcState(npc);

    for (const v of variants) {
      let card = document.getElementById('card-' + npc + '-' + v.num);
      if (!card) {
        card = document.createElement('div');
        card.className = 'variant';
        card.id = 'card-' + npc + '-' + v.num;
        card.dataset.variant = v.num;
        card.onclick = function() { reject(npc, v.num); };
        card.oncontextmenu = function(e) { e.preventDefault(); pick(npc, v.num); };

        const img = document.createElement('img');
        img.src = '/images/generated/' + v.file;
        img.alt = npc + ' ' + v.num;
        img.loading = 'lazy';

        const label = document.createElement('div');
        label.className = 'variant-label';
        label.textContent = v.num;

        card.appendChild(img);
        card.appendChild(label);
        varContainer.appendChild(card);
      }

      // Apply state
      card.classList.toggle('rejected', ns.rejected.includes(v.num));
      card.classList.toggle('picked', ns.pick === v.num);
    }

    updateCount(npc);
  }
  updateSummary();
}

function reject(npc, num) {
  const ns = npcState(npc);
  const idx = ns.rejected.indexOf(num);
  if (idx >= 0) {
    ns.rejected.splice(idx, 1);
  } else {
    ns.rejected.push(num);
    if (ns.pick === num) ns.pick = null;
  }
  saveState();
  const card = document.getElementById('card-' + npc + '-' + num);
  if (card) {
    card.classList.toggle('rejected', ns.rejected.includes(num));
    card.classList.remove('picked');
  }
  updateCount(npc);
  updateSummary();
  sortNpc(npc);
}

function pick(npc, num) {
  const ns = npcState(npc);
  // Unrejct if rejected
  const idx = ns.rejected.indexOf(num);
  if (idx >= 0) ns.rejected.splice(idx, 1);

  // Toggle pick
  const row = document.getElementById('row-' + npc);
  row.querySelectorAll('.variant').forEach(v => v.classList.remove('picked'));

  if (ns.pick === num) {
    ns.pick = null;
  } else {
    ns.pick = num;
    const card = document.getElementById('card-' + npc + '-' + num);
    if (card) {
      card.classList.remove('rejected');
      card.classList.add('picked');
    }
  }
  saveState();
  updateCount(npc);
  updateSummary();
  sortNpc(npc);
}

function pickRemaining(npc) {
  const ns = npcState(npc);
  const variants = manifest[npc] || [];
  // Auto-reject everything not already rejected or picked, except keep non-rejected
  // Actually: pick all non-rejected as candidates — but we can only have one pick.
  // So instead: mark all non-rejected, non-picked as picks? No, one pick per NPC.
  // Intent: "select all that I didn't sort out" — copy remaining to clipboard
  const remaining = variants.filter(v => !ns.rejected.includes(v.num)).map(v => npc + '-' + v.num);
  if (remaining.length === 0) return;
  navigator.clipboard.writeText(remaining.join(', ')).then(() => {
    const btn = event.target;
    btn.textContent = 'Copied ' + remaining.length + '!';
    setTimeout(() => btn.textContent = 'Pick remaining', 1500);
  });
}

function unrejAll(npc) {
  const ns = npcState(npc);
  ns.rejected = [];
  saveState();
  const row = document.getElementById('row-' + npc);
  row.querySelectorAll('.variant').forEach(v => v.classList.remove('rejected'));
  updateCount(npc);
  updateSummary();
}

function updateCount(npc) {
  const ns = npcState(npc);
  const total = (manifest[npc] || []).length;
  const remaining = total - ns.rejected.length;
  const el = document.getElementById('count-' + npc);
  if (el) el.textContent = remaining + '/' + total + ' remaining';
}

function updateSummary() {
  const npcs = Object.keys(manifest).sort();
  const picks = [];
  for (const npc of npcs) {
    const ns = npcState(npc);
    if (ns.pick) picks.push(npc + ': ' + ns.pick);
  }
  const el = document.getElementById('picks-summary');
  if (picks.length === 0) {
    el.textContent = 'No picks yet';
  } else {
    el.textContent = picks.length + '/' + npcs.length + ' picked: ' + picks.join(' | ');
  }
}

function copyPicks() {
  const npcs = Object.keys(manifest).sort();
  const picks = [];
  for (const npc of npcs) {
    const ns = npcState(npc);
    if (ns.pick) picks.push(npc + ' ' + ns.pick);
  }
  if (picks.length === 0) return;
  navigator.clipboard.writeText(picks.join(', ')).then(() => {
    const btn = event.target;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy Picks', 1500);
  });
}

function copyRemaining() {
  const npcs = Object.keys(manifest).sort();
  const remaining = [];
  for (const npc of npcs) {
    const ns = npcState(npc);
    const variants = manifest[npc] || [];
    for (const v of variants) {
      if (!ns.rejected.includes(v.num) && ns.pick !== v.num) {
        remaining.push(npc + ' ' + v.num);
      }
    }
  }
  if (remaining.length === 0) return;
  navigator.clipboard.writeText(remaining.join(', ')).then(() => {
    const btn = event.target;
    btn.textContent = 'Copied ' + remaining.length + '!';
    setTimeout(() => btn.textContent = 'Copy Remaining', 1500);
  });
}

function sortNpc(npc) {
  const container = document.getElementById('variants-' + npc);
  if (!container) return;
  const ns = npcState(npc);
  const cards = [...container.children];
  cards.sort((a, b) => {
    const aNum = a.dataset.variant;
    const bNum = b.dataset.variant;
    const aRej = ns.rejected.includes(aNum) ? 2 : 0;
    const bRej = ns.rejected.includes(bNum) ? 2 : 0;
    const aPick = ns.pick === aNum ? -1 : 0;
    const bPick = ns.pick === bNum ? -1 : 0;
    const aScore = aRej + aPick;
    const bScore = bRej + bPick;
    if (aScore !== bScore) return aScore - bScore;
    return aNum.localeCompare(bNum);
  });
  for (const card of cards) container.appendChild(card);
}

function sortAll() {
  const npcs = Object.keys(manifest).sort();
  for (const npc of npcs) sortNpc(npc);
}

function resetAll() {
  if (!confirm('Reset all picks and rejects?')) return;
  localStorage.removeItem('portrait-picker');
  Object.keys(state).forEach(k => delete state[k]);
  document.querySelectorAll('.variant').forEach(v => {
    v.classList.remove('rejected', 'picked');
  });
  Object.keys(manifest).forEach(npc => updateCount(npc));
  updateSummary();
}

// Poll manifest
async function poll() {
  try {
    const res = await fetch('/manifest.json?t=' + Date.now());
    const data = await res.json();
    const changed = JSON.stringify(data) !== JSON.stringify(manifest);
    manifest = data;
    if (changed) render();
  } catch {}
  setTimeout(poll, 3000);
}

poll();
</script>
</body>
</html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // Manifest endpoint
  if (path === '/manifest.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify(manifest));
    return;
  }

  // Serve index
  if (path === '/' || path === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML);
    return;
  }

  // Serve static files from project root
  const filePath = join(ROOT, path);
  // Security: ensure we stay within ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Portrait picker running at http://localhost:${PORT}`);
  console.log(`Watching ${IMG_DIR} for changes...`);
  // Open in browser
  try {
    execSync(`open http://localhost:${PORT}`);
  } catch {}
});
