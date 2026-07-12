---
name: npc-type-review
description: Read-only review of NPC type definitions for schema correctness, mechanical arrays, narrative role, and cross-entry consistency.
context: fork
agent: npc-type-review
---

# NPC Type Review

Review only. Do not edit reviewed content directly.

## Check

- Required fields and valid local schema values.
- `vulnerabilities`, `resistances`, and `immunities` as intentional mechanical arrays, including empty arrays when appropriate.
- Damage type validity against current settings.
- Whether description text gives useful narrator guidance without overfitting to one encounter.
- Consistency with NPCs, traits, abilities, and world lore where applicable.

Use `species-consistency` only when the type represents a species/lineage and the target world or task requires cross-entry synchronization.

Do not apply any world-specific cultural, folklore, or genre criteria unless an active world profile explicitly requires them.
