---
name: review-npcs
description: Narrative review of NPCs for consistency, writing quality, thematic coherence, and narrative depth.
context: fork
agent: review-npcs
---

# Review NPCs

Perform a thorough narrative review of all NPCs. Run `node .claude/scripts/review-npcs.js` to get stripped narrative data, then analyze.

## Setup

1. Run `node .claude/scripts/review-npcs.js` — outputs NPC narrative text with world-background and entity name lists
2. Read the full output carefully
3. Analyze across all four domains below
4. Write findings to `stuff/npc-review.md`

## Domain 1: Internal Consistency

**Timeline/dates**: Cross-check ages, years, and historical events mentioned across NPCs. When two NPCs reference the same event, the details must match.

**Relationship symmetry**: When NPC A describes a relationship with NPC B, check that NPC B's entry reflects the relationship back. Flag one-way references where both NPCs exist.

## Domain 2: Writing & Style

**Structural consistency**: NPCs should follow a similar structure in basicInfo and hiddenInfo. Flag outliers that break the common pattern — these should conform, not diverge. Consistent structure is intentional and desirable.

**Depth imbalance**: Flag NPCs that are significantly underdeveloped compared to the average. Compare basicInfo and hiddenInfo length and detail level across the cast.

**Tone/voice drift**: Flag modern phrasing, anachronistic language, or anything that breaks the world's established Heian-era voice. Check against the world-background for tone.

**Voice distinctiveness**: Flag NPCs whose basicInfo or hiddenInfo could be swapped with another NPC and no one would notice. Each NPC should sound like a distinct person.

**Cultural grounding**: Flag anachronisms, misused Japanese terminology, titles or social roles that don't fit the setting, or cultural details that feel generic rather than researched.

## Domain 3: Narrative Depth

**One-way relationships**: When NPC A mentions NPC B and both exist, check that B mentions A. Flag asymmetric relationships.

**Missing names**: When an NPC's prose mentions a named character who doesn't exist as an NPC, flag it only if that character feels like a significant absence — someone who should be in the world. Ignore minor or historical mentions.

**NPC interconnectedness**: Flag NPCs that exist in total isolation — no connections to any other NPC in the world. Every NPC should be woven into the web.

**Secrets worth keeping**: hiddenInfo should add genuine depth. Flag entries where hiddenInfo is mundane, predictable, or simply repeats what basicInfo already says.

**Narrative tension**: Flag clusters of allied NPCs with no internal friction, and rivals whose conflict has no meaningful stakes.

**Personality vs backstory**: Flag mismatches where personality traits contradict the character's story. A "cheerful" NPC with a purely tragic backstory and no levity needs reconciliation.

**Hidden info quality**: Flag redundancy between basicInfo and hiddenInfo. Hidden info should reveal, not restate.

## Domain 4: Thematic & Structural

**Thematic coherence**: Do NPCs collectively reinforce the world's core themes? Flag NPCs that feel thematically adrift — disconnected from what the world is about.

**Power dynamics**: Do hierarchies described in NPC relationships make sense? Flag when a subordinate sounds more powerful than their superior, or when authority structures are contradictory.

**Archetype diversity**: Flag when multiple NPCs fill the same narrative role. The cast should offer variety, not redundancy.

**Moral complexity**: Flag purely good or purely evil NPCs that lack nuance. Flag factions where every member shares the same moral stance.

**Story potential**: Flag NPCs who exist as set dressing with no hooks for player interaction or narrative development. Every NPC should offer something a player can engage with.

## Output Format

Group findings by domain. Within each domain, list findings with the NPC name(s) involved and a clear description of the issue. Prioritize the most significant findings first within each domain.

## Important

- **Ignore empty fields** — NPCs with no location, no type, or no area assigned are normal and should not be flagged.
- **Structural repetition is good** — consistent formatting across NPCs is intentional. Only flag NPCs that break the pattern.
- **Be thorough** — this is a comprehensive editorial pass. Surface everything worth noting.
