#!/usr/bin/env node
'use strict';

/*
 * SessionStart hook: pre-create .claude/secrets.env so setup is just
 * "paste your key". Never touches an existing file. The file is gitignored
 * and agent access to it is blocked by guard-secrets.js; an empty value
 * reads as not-configured, so the template is inert until filled in.
 */

const fs = require('fs');
const path = require('path');

const secretsPath = path.join(__dirname, '..', 'secrets.env');

if (!fs.existsSync(secretsPath)) {
  fs.writeFileSync(
    secretsPath,
    [
      '# World Puppeteer secrets (see SETUP.md). Paste each key directly after',
      '# its = sign and save. This file is gitignored and agents are blocked',
      '# from reading it.',
      '',
      '# Voyage Creator API key (pull/push, remote validation, uploads)',
      'VOYAGE_CREATOR_API_KEY=',
      '',
      '# Google Gemini key (local image generation)',
      'GEMINI_API_KEY=',
      '',
    ].join('\n'),
  );
  try {
    fs.chmodSync(secretsPath, 0o600);
  } catch {
    // Windows: chmod is a no-op; the gitignore + guard hook still apply.
  }
}
