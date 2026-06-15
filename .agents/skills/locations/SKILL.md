---
name: locations
description: Create or edit Voyage location entries for a resolved editable world. Do not use for map generation or random coordinate assignment.
context: fork
agent: locations
---

# Locations

Operate only inside the resolved target world. Read the world marker, active profiles, and `references/locations-reference.md` before editing.

## Rules

- `name` must match the object key exactly.
- `region` must reference an existing region.
- Coordinates, radius, and placement are semantic decisions. Use an approved map/layout, explicit user instruction, or existing placement convention. Do not generate random coordinates.
- `complexityType` and `detailType` must be chosen intentionally from valid local schema values; do not force every location to be complex or detailed.
- `hiddenInfo`, `imageUrl`, `areas`, `factions`, `npcLevelRange`, `visualTags`, and `embeddingId` are optional unless the approved brief or local schema requires them.
- `visualTags` may be authored when they carry real visual metadata. Do not generate decorative tag noise merely because the field exists.
- `embeddingId` may be authored only when it points to a known valid embedding record or an approved embedding workflow. Never fabricate an embedding identifier.
- Do not predefine initialization/runtime state fields such as `visited`, `lastVisitedTick`, or `visitedAreas`; the engine overwrites them.
- `questOriginArcId` and `questOriginQuestId` are engine-generated provenance for quest-spawned locations. Do not invent them for ordinary authored locations.

## Evidence status

Current upstream World-Puppeteer documentation marks `visualTags` and `embeddingId` as predefinable and marks `visited`, `lastVisitedTick`, and `visitedAreas` as initialization-overwritten. No directly indexed VoyageWiki locations page was found during the 2026-06-15 reconciliation. Treat this as medium-confidence community-source evidence rather than official platform certainty, and preserve uncertainty if local schema or reproducible platform behavior conflicts.

## Escalation

Return to the parent for placement, radius, region assignment, hidden secrets, faction control, canon-sensitive naming, embedding assignment, or anything that changes player-facing geography.
