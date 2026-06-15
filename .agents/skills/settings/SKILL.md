---
name: settings
description: Edit Voyage settings for a resolved editable world. Use only for explicit settings work; do not infer defaults or weaken validation.
context: fork
agent: settings
---

# Settings

Settings define world mechanics and platform behavior. Treat them as high-impact.

## Workflow

1. Resolve the target world and read active profiles.
2. Read `references/settings-reference.md` and current `tabs/settings.json`.
3. Separate platform facts, local validator requirements, project policy, and world-specific preferences.
4. Change only the approved setting surface.
5. Build and validate the target world.

## Rules

- Do not invent enum values, numeric ranges, or platform behavior.
- Do not describe local defaults as engine requirements.
- Do not remove settings merely because they appear unused.
- Preserve unknown or version-sensitive claims as unverified until tested or sourced.

## Escalation

Return to the parent for combat mechanics, progression, generation policy, hidden platform behavior, or settings that alter major player experience.
