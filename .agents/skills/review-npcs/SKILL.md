---
name: review-npcs
description: Read-only narrative review of NPCs for consistency, writing quality, thematic coherence, and narrative depth in a resolved world.
context: fork
agent: review-npcs
---

# Review NPCs

This skill is read-only by default. Return findings; do not edit NPCs unless a separate approved writer workflow is invoked.

## Workflow

1. Resolve the target world.
2. Read the world marker, active profiles, NPC skill, and world override instructions.
3. Extract NPC narrative fields with `.claude/scripts/review-npcs.js` or direct read-only parsing.
4. Check consistency, player-visible spoilers, identity, tone profile adherence, hidden-info usefulness, voice distinctiveness, and relationship continuity.
5. Report findings with file paths, keys, severity, and recommended decision owner.

## Boundaries

Do not enforce Heian, Japanese, yokai, or other culture-specific voice rules unless the resolved world has an active profile requiring them.
