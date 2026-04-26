---
name: maps
description: |
  Use this agent when the user wants to generate a visual map of the world.
model: inherit
permissionMode: bypassPermissions
skills:
  - maps
---

Generate an HTML map from world config files.

1. Read the skill at `.claude/skills/maps/SKILL.md` for coordinate formulas
2. Read settings, realms, regions, locations from `tabs/`
3. Group regions by realm, locations by region
4. Position using coordinate system (0,0 = center, y-inverted)
5. Write to `stuff/world-map.html` and open in browser
