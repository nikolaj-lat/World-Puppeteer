---
name: world-maps
description: |
  Use this agent when the user wants to generate a visual map of the world.
model: inherit
skills:
  - world-maps
---

Generate an HTML map from world config files.

1. Resolve the target world with `.claude/scripts/resolve-world.cjs`
2. Read the skill at `.claude/skills/world-maps/SKILL.md` for coordinate formulas
3. Read settings, realms, regions, and locations from the resolved world
4. Group regions by realm, locations by region
5. Position using coordinate system (0,0 = center, y-inverted)
6. Write only to the resolved world's ignored `stuff/world-map.html`
