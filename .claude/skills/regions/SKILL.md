---
name: regions
description: Schema and rules for creating regions
context: fork
agent: regions
---

# Regions

Edit `tabs/regions.json`.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `basicInfo` | One paragraph describing geography, climate, and atmosphere |
| `x` | Integer grid coordinate - must be adjacent to other regions in the same realm |
| `y` | Integer grid coordinate - must be adjacent to other regions in the same realm |
| `realm` | Which realm this region belongs to |
| `images.map` | The region's map image: `{ crop: { focus: { x, y }, zoom }, imageUrl }`. `crop` (focus x/y and zoom) is required whenever the image object is present; `imageUrl` is optional. Focus x/y run 0..100 (50 = centered), zoom 100..300 (100 = no zoom); out-of-range values are clamped. When `imageUrl` is absent, the engine generates a map during play and saves it back; an existing map is never regenerated |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `known` | Set to `false` to hide from map at game start. Omit or set `true` for visible by default |
| `factions` | Only when region has dominant faction presence affecting the entire area |
| `npcLevelRange` | `{ min, max }` band for NPCs generated anywhere in this region whose level you don't set explicitly. A location's own band overrides it. Use it to set a baseline difficulty for the whole region |

## Never Include

| Field | Reason |
|-------|--------|
| `hiddenInfo` | Unused field — region secrets belong in location or NPC entries instead |

## basicInfo Format

One paragraph covering three aspects:

1. **Geography** - Terrain, landmarks, natural features
2. **Climate/Atmosphere** - Weather patterns, sensory details, mood
3. **Inhabitant hints** - Who or what lives here, without full faction details

Format: "[Terrain description]. [Climate and atmospheric details]. [Brief mention of inhabitants or dangers]."

## Coordinate System

Regions use integer grid coordinates. **Within a realm, regions must be adjacent** (differ by 1 in x or y, not diagonal).

```
(0,0)  (1,0)  (2,0)
(0,1)  (1,1)  (2,1)
(0,2)  (1,2)  (2,2)
```

**Rules:**
- Regions in the same realm must form a connected grid (no isolated regions)
- Adjacent means sharing an edge, not diagonal
- Check existing regions in `tabs/regions.json` before assigning coordinates

**Design guidance:**
- Place related regions adjacent to each other
- Consider travel routes when positioning
- North is -y, South is +y, East is +x, West is -x
- Regions at same coordinates in different realms can represent parallel locations

## Region Scope

Regions are large geographic areas containing multiple locations. Think:
- A forest, not a single grove
- A mountain range, not a single peak
- A coastal stretch, not a single beach
- A district or quarter, not a single building

Each region typically contains various locations.

## Schema

```typescript
interface Region {
  name: string
  basicInfo: string
  x: number
  y: number
  realm?: string
  known?: boolean
  hiddenInfo?: string
  factions?: string[]
  npcLevelRange?: { min: number; max: number }
  images?: { map?: SceneImage }
}

interface SceneImage {
  crop: { focus: { x: number; y: number }; zoom: number }
  imageUrl?: string
}
```

## Reference

For detailed documentation, see [regions-reference.md](references/regions-reference.md).
