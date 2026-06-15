---
name: name-filter-settings
description: Manage nameFilterSettings schema and approved world-local filter packs. Do not inject opinionated defaults implicitly.
context: fork
agent: name-filter-settings
---

# Name Filter Settings

Use this skill for explicit name-filter schema work or approved world-local filter pack application.

## Rules

- Resolve the target world first.
- Treat filter lists as world-specific policy unless they are platform schema facts.
- Do not inject cultural, tonal, or phrase filters into a generic world.
- Do not rebuild a root world when the target is nested.
- Apply initializer scripts only when the user explicitly approves the target world and filter pack.

## Escalation

Return to the parent for any filter that changes voice, culture, naming canon, or player-visible style.
