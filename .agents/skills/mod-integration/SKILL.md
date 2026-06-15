---
name: mod-integration
description: Dry-run-first workflow for applying reusable World-Puppeteer mods to a resolved world with provenance and conflict reporting.
---

# Mod Integration

Use this skill for reusable World-Puppeteer mods under `.world-puppeteer/mods/`.

Canonical reusable mods live only in `.world-puppeteer/mods/`. `.claude/mods/` is not a payload mirror.

## Manifest contract

- `files` is the exact payload inventory. Every payload file must be listed once, and every listed file must exist.
- `payloadMappings` maps each reusable source section to its intended world section using `file`, `sourcePath`, `targetPath`, `preferredTargetFile`, and `domain`.
- The dry-run planner scans the resolved world's actual tabs for `targetPath` before falling back to `preferredTargetFile`; do not assume every world uses the same logical tab split.
- `reference-only` mods may not run in apply mode.
- `conflictPolicy: stop` blocks apply mode when existing target content overlaps a mapped source section.
- `manual` application profiles propose adaptation only. They never propose automatic additions.

## Workflow

1. Resolve the target world and selected mod.
2. Run `node .claude/scripts/validate-world-puppeteer.cjs`.
3. Run `node .claude/scripts/mod-dry-run.cjs --mod <mod-id> --world <target-world-root> [--mode reference|apply]`.
4. Inspect the schema-validated plan, exact payload mappings, resolved target files, conflicts, operations, and warnings.
5. Require explicit approval before any meaningful content application.
6. Never overwrite existing keys silently and never invent a replacement operation.
7. Build and run every configured validator after approved application.
8. Record approved content changes in the target marker's `appliedMods` only after successful application and validation.

Reference-only consultation is not recorded as an applied mod. `appliedMods` is reserved for real approved content changes, uses `mode: "apply"`, and records only `add` or `adapt` operations.

## Verification

Run both:

```text
node .claude/scripts/mod-architecture-tests.cjs
node .claude/scripts/validate-world-puppeteer.cjs
```

Default mode is `reference`. Creative adaptation always requires human or specialist-agent judgment.
