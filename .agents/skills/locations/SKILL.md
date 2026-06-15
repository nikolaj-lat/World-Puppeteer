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
- `hiddenInfo`, `imageUrl`, `areas`, `factions`, and `npcLevelRange` are optional unless the approved brief or local schema requires them.
- Do not include runtime fields such as `visited`, `lastVisitedTick`, `visitedAreas`, `visualTags`, or `embeddingId`.

## Escalation

Return to the parent for placement, radius, region assignment, hidden secrets, faction control, canon-sensitive naming, or anything that changes player-facing geography.
