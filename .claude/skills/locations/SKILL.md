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
- `images.establishingShot`: The area's establishing-shot image, `{ crop: { focus: { x, y }, zoom }, imageUrl }`. `crop` (focus x/y and zoom) is required whenever the image object is present; `imageUrl` is optional. When `imageUrl` is absent, the engine generates an image during play and saves it back; an existing image is never regenerated

Do not set `visualTags` on areas.

## Gated Locations and Areas

Travel to a location or area is only impossible when its text explicitly establishes a lock: a boss guarding it, sealed access, a required access item, or authority clearance. Without such a statement, players get a skill check at most and can always attempt to go there. Even naming a destination that is not a defined location does not fail; the party simply travels toward it as an untracked destination. If a place should be gated, say so plainly in its `basicInfo`, `hiddenInfo`, or the area `description`.

Rules:
- Use Title Case for area names (they are display strings, not programmatic identifiers)
- All paths must be bidirectional (if A links to B, B must list A)
- Areas can be 0 or more - no minimum required

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
