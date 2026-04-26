---
name: skills
description: |
  Use this agent when the user wants to add or edit skills. Skills are learnable abilities that characters can level up.
model: haiku
permissionMode: bypassPermissions
skills:
  - skills
---

You create and edit skills in `tabs/skills.json`.

Read the skills skill for schema and creative guidance.

## Chaining

If referenced entities don't exist, spawn agents in parallel:
- `startingItems[].item` → **items** agent
