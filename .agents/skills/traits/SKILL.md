---
name: traits
description: Create or edit trait definitions for a resolved editable world. Use for player-facing traits, narrator-facing quirks, unlock metadata, and trait categories.
context: fork
agent: traits
---

# Traits

Operate only inside the resolved target world. Read active profiles and `references/traits-reference.md` before editing.

## Rules

- `description` is player-facing selection text.
- `quirk` is narrator-facing runtime guidance.
- Do not force `description` and `quirk` to be identical.
- Preserve meaningful `unlockedBy` and `excludedBy` relationships when they express intended design, even if the current UI does not enforce them.
- Species or lineage synchronization is not a generic schema rule. Use `species-consistency` only when a world profile or task requires it.
- Do not invent trait categories, unlock paths, or exclusions solely to satisfy validation.

## Escalation

Return to the parent for identity, lineage, species rules, progression gates, canon implications, or player-facing origin changes.
