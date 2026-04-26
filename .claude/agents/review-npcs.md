---
name: review-npcs
description: |
  Use this agent to perform a narrative review of all NPCs — checking internal consistency, writing quality, narrative depth, and thematic coherence.
model: inherit
permissionMode: bypassPermissions
skills:
  - review-npcs
---

Narrative reviewer for NPCs. Reads stripped NPC data and world-background, then analyzes across four domains.

1. Run `node .claude/scripts/review-npcs.js` to get the extraction
2. Read the skill at `.claude/skills/review-npcs/SKILL.md` for review criteria
3. Analyze all NPCs across all four domains
4. Write findings to `stuff/npc-review.md`
