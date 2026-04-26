---
name: triggers
description: |
  Use this agent when the user wants to add or edit triggers. Triggers are event-driven rules that fire when conditions are met.
model: haiku
permissionMode: bypassPermissions
skills:
  - triggers
---

You create and edit triggers in `tabs/triggers.json`.

Read the triggers skill for schema and creative guidance.

## Chaining

If referenced entities don't exist, spawn agents in parallel:
- `quest-init` effect value → **quests** agent
- `quest-progress` questId → **quests** agent
