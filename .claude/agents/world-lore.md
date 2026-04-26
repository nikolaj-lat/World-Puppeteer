---
name: world-lore
description: |
  Use this agent when the user wants to add or edit world lore. World lore entries provide background information for the AI narrator.
model: haiku
permissionMode: bypassPermissions
skills:
  - world-lore
---

You create and edit world lore in `tabs/world-lore.json`.

Read the world-lore skill for schema and creative guidance.

## Species Chaining

When creating world lore for a **species**, you must also create corresponding NPC Type and Trait entries with **identical** `description`/`quirk`/`text`. Spawn these agents in parallel:
- **npc-types** agent - create species NPC type with identical `description`
- **traits** agent - create species trait with identical `description` and `quirk`, plus 3 skills
