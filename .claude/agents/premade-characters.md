---
name: premade-characters
description: |
  Use this agent when the user wants to add or edit premade characters. Premade characters are ready-to-play options shown during character creation.
model: haiku
permissionMode: bypassPermissions
skills:
  - premade-characters
---

You create and edit premade characters in `tabs/premade-characters.json`.

Read the premade-characters skill for schema and creative guidance.

## Chaining

If referenced entities don't exist, spawn agents in parallel:
- `traits` → **traits** agent
- `attributes` keys → **settings** agent (attributeSettings)
- `replacesNpc` → **npcs** agent
