---
name: name-filter-settings
description: Schema and rules for managing name filter settings in meta.json
context: fork
agent: name-filter-settings
---

# Name Filter Settings

Inject default `nameFilterSettings` into the resolved target world's
`tabs/meta.json`.

Resolve the target world first. Prefer an explicit world root:

```bash
node .claude/skills/name-filter-settings/scripts/name-filter.js --world <world-root>
```

The flag may be omitted only when the current working directory resolves to an
editable world. Reference and template worlds are rejected. The script builds
through the world's configured build profile and restores `meta.json` if that
build fails.

Skips if `nameFilterSettings` already exists. Run once per new editable world.

## What Name Filters Do

Name filters intercept AI-generated names and replace overused/generic ones with culturally appropriate alternatives. When the AI generates a character named "Marcus", the system randomly picks from that entry's replacements list instead.

Two types of entries:

1. **Name entries** — Replace a generic name with culturally-matched alternatives (10-15 replacements)
2. **Word/phrase entries** — Replace AI-slop words or phrases with alternatives, or delete them (empty string `""`)

## Included Defaults

- 89 name filters covering fantasy-generic, modern-generic, and culturally-specific names
- 3 phrase deletions: " with practiced ease", " with practiced efficiency", " with deliberate precision"
- 11 word/phrase replacements: protocol, protocols, efficiency, practiced, precision, ease, ozone, sandalwood, breath catches, breath hitches, sharp intake of breath
