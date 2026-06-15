---
name: mod-integration
description: Dry-run-first workflow for applying reusable World-Puppeteer mods to a resolved world with provenance and conflict reporting.
---

# Mod Integration

Use this skill for reusable World-Puppeteer mods under `.world-puppeteer/mods/`.

## Workflow

1. Resolve the target world and selected mod.
2. Validate `mod.json`, registry membership, dependencies, and compatible formats.
3. Inspect reusable structure separately from source-world creative content.
4. Produce a dry-run operation plan with conflicts and affected files.
5. Require explicit approval before meaningful content application.
6. Never overwrite existing keys silently.
7. Build and validate afterward.
8. Record provenance in the target marker’s `appliedMods`.

Default mode is `reference`. Automatic replacement is unsupported.
