# Claude Frontend Guide

Claude is a frontend for the shared World-Puppeteer tooling. Repository policy, task modes, world roles, validation requirements, and delegation rules live in the root `AGENTS.md` and the nearest applicable `AGENTS.override.md`; follow those first.

## World Resolution

- Resolve the target world with `.world-puppeteer.json` markers and `.claude/scripts/resolve-world.cjs`.
- Do not assume repository-root `tabs/` is the active world.
- Respect marker roles: `editable`, `reference`, and `template`.
- Do not edit `tabs/*.json` directly during ordinary content work unless the active task and specialist instructions explicitly require it.

## Shared Tooling

Claude and Codex use the same resolver, changed-path classification, hook routing, build, and validation pipeline.

Use these commands from the repository root:

```bash
node .claude/scripts/validate-world-puppeteer.cjs
node .claude/scripts/tooling-architecture-tests.cjs
node .claude/scripts/build-world.cjs --world <world-root>
node .claude/scripts/validate.js <world-root>/tabs --json
node .claude/scripts/count.js <world-root>/tabs --json
```

SessionStart hooks are read-only context emitters. They must not create `tabs/`, checklist files, compiled outputs, or other world files.

## Specialist Names

Content specialists retain their domain names: `npcs`, `npc-types`, `locations`, `regions`, `realms`, `items`, `abilities`, `triggers`, `quests`, `factions`, `traits`, `skills`, `story-starts`, `world-lore`, `world-background`, `settings`, and `ai-instructions`.

Utility specialists use the current shared names: `world-capacity`, `world-charts`, `world-maps`, `review-npcs`, and `npc-type-review`.

## Reference Packs

Reference material lives under `.world-puppeteer/reference-packs/`. These packs are read-only source material for review and later approved manual adaptation. They are not installable mods and must not mutate world markers, tabs, compiled output, or provenance records.

Generated reference-pack reports may be written only under `.world-puppeteer/reports/reference-packs/`.

## Completion

Before reporting work complete, run the applicable shared validation commands, inspect the diff/status, and report generated or ignored outputs separately from tracked edits. Arbitrary shell writes are outside hook guarantees, so final explicit validation is still required.
