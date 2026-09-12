---
name: creator-api
description: Sync the world with Voyage through the Creator API - pull, push, remote validation, official image uploads, moderation preflight. Use when asked to pull or push the world, upload images officially, check moderation, or diagnose remote validation results.
---

# Creator API

World Puppeteer talks to Voyage's Creator API (alpha host, `/creator/v1`) for the single world pinned in `.creator-api.json` (project root, machine-written; also holds the optional apiBase, remoteValidation, and usageGuard settings). The API key lives in `.claude/secrets.env`: never read, print, or reference that file; the client scripts handle it. Setup is in `SETUP.md` Step 5.

## Commands

| Task | Command |
|------|---------|
| Pull the live draft into tabs | `node .claude/scripts/api/pull.js` |
| First pull / pin a world (user gives a link or shortId) | `node .claude/scripts/api/pull.js <shortId-or-world-link>` |
| Push report (validation + diff, no write) | `node .claude/scripts/api/push.js` |
| Push for real (after human go-ahead) | `node .claude/scripts/api/push.js --confirm` |
| Remote-validate on demand | `node .claude/scripts/api/remote-validate.js [--stage publish]` |
| Moderation state / fresh run | `node .claude/scripts/api/moderation.js [--run]` |
| Official image upload | `node .claude/skills/image-gen/scripts/upload-image.mjs -n <name> [-t TARGET] <file>` |
| Paid AI image generation | `node .claude/scripts/api/generate-image.js --type npc --payload req.json` |

## Rules

- Tabs are canonical. Pull never blocks: existing tabs are backed up to `config-backups/` automatically and the alert says where.
- Pushing is a full replace. ALWAYS run the bare `push.js` first, relay its diff report (local changes plus any remote drift) to the human, and add `--confirm` only after their explicit go-ahead in chat.
- A push 412 means the remote moved: pull, reconcile, push again. Never work around it.
- World Puppeteer cannot publish or unpublish, by design. When moderation is clean, the human publishes in Voyage Studio.
- Remote validation runs automatically in the edit hook and inside push.
- Image uploads live in the image-gen skill's uploader and use the four sanctioned targets only (NPC_PORTRAIT default, AREA_IMAGE, LOCATION_IMAGE, REGION_MAP_IMAGE).
- AI generation spends the paid plan's usage; the script prints usage first and honors the optional `usageGuard` threshold in the state file.
- When the API's behavior is in doubt, fetch the live contract: `GET <apiBase>/agent-guide.md` and `GET <apiBase>/openapi.json`.
