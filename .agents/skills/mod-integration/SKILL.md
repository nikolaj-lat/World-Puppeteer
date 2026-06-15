---
name: mod-integration
description: Dry-run-first workflow for applying reusable World-Puppeteer mods to a resolved world with provenance and conflict reporting.
---

# Mod Integration

Use this skill for reusable World-Puppeteer mods under `.world-puppeteer/mods/`.

Canonical reusable mods live only in `.world-puppeteer/mods/`. `.claude/mods/` is not a payload mirror.

## Workflow

1. Resolve the target world and selected mod.
2. Validate `mod.json`, registry membership, dependencies, and compatible formats.
3. Run `node .claude/scripts/mod-dry-run.cjs --mod <mod-id> --world <target-world-root> [--mode reference|apply]`.
4. Inspect the emitted dry-run operation plan, conflicts, payload inventory, and warnings.
5. Require explicit approval before meaningful content application.
6. Never overwrite existing keys silently.
7. Build and validate afterward.
8. Record provenance in the target marker’s `appliedMods`.

Default mode is `reference`. Automatic replacement is unsupported. Dry-run operations are limited to `reference`, `add`, and `adapt`; creative adaptation requires human or specialist-agent judgment.
