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
| `imageUrl` | URL for the location's image |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `known` | Set to `false` to hide from map at game start. Omit or set `true` for visible by default |
| `areas` | Optional - include when the location has distinct internal spaces |
| `factions` | Only for major plot-relevant faction presence |

## Never Include

Omit these fields (auto-set at runtime):
- `visited`, `lastVisitedTick`, `visitedAreas`
- `visualTags`, `embeddingId`

## areas Format

For locations with distinct internal spaces, define interconnected areas.

Each area needs:
- `description`: Freeform description of the area
- `paths`: Array of connected area names

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

Infer radius from the location type:

| Location Type | Radius |
|---------------|--------|
| Single room/building | 1-2 |
| Small structure | 2-4 |
| Village/small settlement | 4-8 |
| Town | 8-15 |
| Large town/small city | 15-25 |
| Major city | 25-50 |

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
  imageUrl?: string
}

interface Area {
  description: string
  paths: string[]
}
```

## Reference

For detailed documentation, see [locations-reference.md](references/locations-reference.md).
