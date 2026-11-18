---
name: locations
description: Schema and rules for creating locations
context: fork
agent: locations
---

# Locations

Edit `tabs/locations.json`.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `basicInfo` | Freeform descriptive paragraph about the location |
| `x` | X coordinate - generate random value within the region |
| `y` | Y coordinate - generate random value within the region |
| `radius` | Infer from description (see radius guidelines below) |
| `region` | Must exist in `tabs/regions.json` |
| `complexityType` | Always `"complex"` |
| `detailType` | Always `"detailed"` |
| `hiddenInfo` | Full paragraph with location secrets - always include |
| `images.establishingShot` | The location's establishing-shot image: `{ crop: { focus: { x, y }, zoom }, imageUrl }`. `crop` (focus x/y and zoom) is required whenever the image object is present; `imageUrl` is optional. Focus x/y run 0..100 (50 = centered), zoom 100..300 (100 = no zoom); out-of-range values are clamped |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `known` | Set to `false` to hide from map at game start. Omit or set `true` for visible by default |
| `areas` | Optional - include when the location has distinct internal spaces |
| `factions` | Only for major plot-relevant faction presence |
| `npcLevelRange` | `{ min, max }` band for NPCs generated here whose level you don't set explicitly. Use it to keep a low-level village or a high-level dungeon on-theme regardless of party level |

## Never Include

Omit these fields (auto-set at runtime):
- `visited`, `lastVisitedTick`, `visitedAreas`
- `visualTags`, `embeddingId`

## areas Format

For locations with distinct internal spaces, define interconnected areas.

Each area needs:
- `description`: Freeform description of the area
- `paths`: Array of connected area names
- `name` (optional): Display label only. The area's key is its identity for `paths`, story starts, and NPC placement
- `images.establishingShot`: The area's establishing-shot image, `{ crop: { focus: { x, y }, zoom }, imageUrl }`. `crop` (focus x/y and zoom) is required whenever the image object is present; `imageUrl` is optional. When `imageUrl` is absent, the engine generates an image during play and saves it back; an existing image is never regenerated

Do not set `visualTags` on areas.

Rules:
- Use Title Case for area names (they are display strings, not programmatic identifiers)
- All paths must be bidirectional (if A links to B, B must list A)
- Areas can be 0 or more - no minimum required

### Areas Are Discrete Spaces

Each area is one place a person can stand in and take in at once.
- **Never plural.** A name that covers several rooms, halls, cells, or shops is several areas. Define each one separately, or describe them together inside one area as part of what is there.
- **No sub-spaces.** Parts of one space (a corner, a feature, furniture, a stage or altar within a hall) are not areas. Describe them inside the area. If two people could talk across a boundary without raising their voices, it is one area.
- **One space per area.** Never combine two spaces in one area name or description, such as "Kitchen and Cellar".
- **No filler areas.** Never add catch-all areas such as "Streets", "Surroundings", or "Outskirts" that stand for the space between places. Every area is a specific space with its own character.

### Logical Layout

- **Paths follow physical access.** Link two areas only when a person can walk directly from one to the other: a door, a stair, a gate, a short open stretch. A room reached only through a hall paths only to that hall.
- **Arrival area first.** A party arriving at the location lands in the first area listed. List the exterior, entrance, or public space first, and order the rest roughly from outside in.
- **Areas only where scenes split.** Add areas when a scene could plausibly happen in one space and a different scene in another, such as an exterior and interior, a public room and a private one, or a named space a quest or event uses. A place with only one such space needs no areas.

## Evergreen Descriptions

`basicInfo`, `hiddenInfo`, and area `description` describe the place as it persists across play.
- **No individual NPCs.** Never characterize a specific person (appearance, temperament, habits, secrets) in location or area text. NPCs can die, leave, or be replaced, and their details belong in `tabs/npcs.json`. Refer to roles and functions instead, such as "the innkeeper's quarters" or "where the garrison commander holds court".
- **No story-start moments.** Never write the situation of a story start, quest, or event as a permanent condition of the place. Describe ongoing character, recurring uses, and standing dangers, not what is happening at one moment.

## Gated Locations and Areas

Travel to a location or area is only impossible when its text explicitly establishes a lock: a boss guarding it, sealed access, a required access item, or authority clearance. Without such a statement, players get a skill check at most and can always attempt to go there. Even naming a destination that is not a defined location does not fail; the party simply travels toward it as an untracked destination. If a place should be gated, say so plainly in its `basicInfo`, `hiddenInfo`, or the area `description`.

## Coordinate System

- Check `locationSettings.regionSize` in `tabs/settings.json` to determine bounds
- Valid range is `-regionSize/2` to `regionSize/2`
- The location's radius must not extend beyond bounds (x ± radius and y ± radius must stay within range)
- No two locations can overlap (distance between centers must be >= sum of radii)
- Check `tabs/locations.json` for existing locations and their coordinates to avoid overlap

## Radius Guidelines

Radius is a size class — author exactly 1, 2, or 3:

| Radius | Size | Use for |
|--------|------|---------|
| `1` | small | Rooms, single buildings, small structures |
| `2` | medium | Villages, camps, modest settlements |
| `3` | large | Towns, cities, sprawling sites |

Values above 3 don't make the map marker bigger (everything above 2 renders as large) — they only inflate the location's travel catchment (arrivals within 2×radius km resolve to it) and its encounter-free zone.

## Schema

```typescript
interface Location {
  name: string
  basicInfo: string
  x: number
  y: number
  radius: number
  region: string
  complexityType: 'complex'
  detailType: 'detailed'
  hiddenInfo: string
  known?: boolean
  areas?: Record<string, Area>
  factions?: string[]
  npcLevelRange?: { min: number; max: number }
  images?: { establishingShot?: SceneImage }
}

interface Area {
  name?: string
  description: string
  paths: string[]
  images?: { establishingShot?: SceneImage }
  visualTags?: string[]
}

interface SceneImage {
  crop: { focus: { x: number; y: number }; zoom: number }
  imageUrl?: string
}
```

## Reference

For detailed documentation, see [locations-reference.md](references/locations-reference.md).
