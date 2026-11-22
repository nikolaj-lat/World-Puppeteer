---
name: creator-api
description: Sync the world with Voyage through the Creator API - pull, push, remote validation, official image uploads, moderation preflight. Use when asked to pull or push the world, upload images officially, check moderation, or diagnose remote validation results.
---

# Creator API

World Puppeteer talks to Voyage's Creator API (alpha host, `/creator/v1`) for the single world or mod pinned in `.creator-api.json` (project root, machine-written; also holds the optional apiBase, remoteValidation, and usageGuard settings). The API key lives in `.claude/secrets.env`: never read, print, or reference that file; the client scripts handle it. Setup is in `SETUP.md` Step 5.

## Commands

| Task | Command |
|------|---------|
| Pull the live draft into tabs | `node .claude/scripts/api/pull.js` |
| First pull / pin a world or mod (user gives a link or shortId) | `node .claude/scripts/api/pull.js <shortId-or-world-or-mod-link>` |
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

## Mods

A mod link (`voyage.io/mod/<shortId>/<slug>`) pulls and pushes exactly like a world. Pull records `"kind": "mod"` in `.creator-api.json`, using the API's `isMod` flag.

- **What a mod is.** The draft is a full world. Voyage applies its diff against the blank world template to each host world. Tabs therefore hold all default template content, which stays in place: deleting it deletes it from every host world, and editing it overrides every host world.
- **Scope.** The mod's patch from `GET /mods/{id}/changes` is its scope. Pull prints it, and the push report shows it. Some API hosts do not expose the endpoint yet; scope is then "unknown", and every edit or deletion of existing content is listed as a warning.
- **Push warnings never block.** Relay each one to the creator in the push ceremony and get explicit confirmation that it is intended: out-of-scope deletes, out-of-scope edits, and edits to `aiInstructions.[task].custom` (which almost always conflict with host worlds). Some mods change default content on purpose.
- **After a confirmed push** the script prints the new scope and what newly entered it. Show that to the creator.
- **Delegation.** Every agent prompt in a mod checkout carries the mod directive from `.claude/rules/tabs.md`.
- `moderation.js` also prints the mod's consumer count when the host supports it. Publishing still happens in Voyage Studio.
- Creating new mods is not supported; the creator makes the mod in Studio and shares its link.
