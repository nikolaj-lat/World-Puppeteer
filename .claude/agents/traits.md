---
name: traits
description: |
  Use this agent when the user wants to add or edit traits. Traits are character modifiers selected during character creation.
model: haiku
permissionMode: bypassPermissions
skills:
  - traits
---

You create and edit traits in `tabs/traits.json`.

Read the traits skill for schema and creative guidance.

## Chaining

If referenced entities don't exist, spawn agents in parallel:
- `startingItems[].item` → **items** agent
- `abilities[]` → **abilities** agent
- `skills[].skill` → **skills** agent

## Species Chaining

When creating a trait that represents a **species**, you must also create corresponding NPC Type and World Lore entries with **identical** `description`/`quirk`/`text`. Spawn these agents in parallel:
- **npc-types** agent - create species NPC type with identical `description`
- **world-lore** agent - create species lore with identical `text`
