# Locations Reference

Complete documentation for `tabs/locations.json`.

## Schema

```typescript
interface Location {
  name: string                      // ✅ Display name, must match object key
  basicInfo: string                 // ✅ Description of the location
  x: number                         // ✅ X coordinate on world map
  y: number                         // ✅ Y coordinate on world map
  radius: number                    // ⚠️ Size class: 1 small, 2 medium, 3 large. Defaults to 10 if omitted. Must be positive. Map markers render by bucket (>2 = large). The number also sets the travel catchment (arrivals within 2×radius km) and the encounter-free zone (radius + minTravelDistance km)
  region: string                    // ✅ Key from regions.json
  complexityType: ComplexityType    // ⚠️ 'simple' | 'complex' | 'wilderness'. Defaults to 'complex' if omitted
  detailType: 'basic' | 'detailed'  // ⚠️ Detail level - 'basic' triggers AI generation. Defaults to 'detailed' if omitted
  areas?: Record<string, Area>      // ✅ Areas within location (for complex types)
  factions?: string[]               // ✅ Keys from factions.json
  hiddenInfo?: string               // ✅ Secret information revealed through exploration
  visualTags?: string[]             // ✅ Visual metadata tags for the location
  images?: { establishingShot?: SceneImage }  // ✅ Establishing-shot image with its crop. When imageUrl is absent, the engine generates an image during play and saves it back; an existing image is never regenerated
  embeddingId?: string              // ✅ Reference to embeddings record
  known?: boolean                   // ✅ Defaults to true; set false to hide at game start
  npcLevelRange?: { min: number, max: number }  // ✅ Optional level band for NPCs generated here. NPCs with no explicit level are rolled near party level, then clamped into this band. Takes priority over the region's band. NPCs with an explicit level ignore it
  visited?: boolean                 // ❌ Always false at creation
  lastVisitedTick?: number          // ❌ Always 0 at creation
  visitedAreas?: string[]           // ❌ Always [] at creation
  questOriginArcId?: string         // ✅ Auto-generated for quest-spawned locations. Links to the arc that spawned this location; provides arc context to AI detail generation
  questOriginQuestId?: string       // ✅ Auto-generated for quest-spawned locations. Links to the quest that spawned this location; provides quest design brief to AI detail generation
}

type ComplexityType = 'simple' | 'complex' | 'wilderness'

interface SceneImage {
  crop: { focus: { x: number, y: number }, zoom: number }  // ✅ Required whenever the image object is present. focus x/y run 0..100 (50 = centered, the default); zoom runs 100..300 (100 = no zoom, the default). Out-of-range values are clamped
  imageUrl?: string                                        // ✅ Image URL. Optional; generated during play when absent
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread
- ⚠️ **Calculated default**: Has fallback logic if not predefined
- ❌ **Always overwritten**: Set by initialization regardless of what exists in config

### Map Placement

Locations sit within half of `locationSettings.regionSize` of the region center in either direction, with a positive `radius`.

## Area Schema

```typescript
interface Area {
  description: string   // Brief description of the area
  paths: string[]       // Connected area names (must be bidirectional)
  images?: { establishingShot?: SceneImage }  // Establishing-shot image with its crop (same shape as on the location). When imageUrl is absent, the engine generates an image during play and saves it back; an existing image is never regenerated
  visualTags?: string[] //  Engine-written cache of the tags used for the area's image prompt
}
```

Areas define internal structure for complex locations. The `paths` array creates a graph of connected spaces that controls movement within the location.

**Path rules:**
- Bidirectional recommended: If A lists B in paths, B should list A
- Validation auto-fixes missing reverse paths
- Every area must have at least one path to be reachable
- Paths only work within a location, not between locations

## Complexity Types

| Type | Description | Areas Required |
|------|-------------|----------------|
| `simple` | Single area, quick to traverse | No |
| `complex` | Multiple areas, detailed exploration | Yes (if detailed) |
| `wilderness` | Open area, coordinate-based movement | Optional |

When the party ends a scene in untracked space and no permanent settlement is established, the engine falls back to a synthetic location named `Wilderness` (with area `Wilderness`). This name is case-insensitive on parse — `wilderness`, `Wilderness`, and `WILDERNESS` from the AI all canonicalize to `Wilderness`.

## Detail Types

| Type | Behavior |
|------|----------|
| `basic` | AI generates areas and hiddenInfo on first visit |
| `detailed` | Full description provided, no generation needed |

## Movement Types

The system has three distinct movement mechanisms:

| Type | Scope | How It Works |
|------|-------|--------------|
| **MOVE** | Within a location | Uses `areas.paths` for valid targets |
| **TRAVEL** | Between locations | Uses coordinate distance, no path graph |
| **TELEPORT** | Anywhere | Bypasses all constraints |
| **FAST TRAVEL** | Anywhere | Like teleport, with optional location/area targeting |

### Movement Difficulty

Travel is simple unless the party is restrained, in combat, or the destination is not yet established (those cases call for a skill check). Naming a destination that is not a defined location does not fail: the party travels toward it as an untracked destination, moving northward by the average travel distance. Travel is impossible only when the destination is explicitly locked by its text: a boss guarding it, sealed access, a required access item, or authority clearance. A location or area that should be gated must state the lock in its `basicInfo`, `hiddenInfo`, or area `description`; otherwise players get a skill check at most.

## generateLocationDetails

Only runs when `complexityType: 'complex'` AND `detailType: 'basic'`.

Reads: basicInfo, existing areas
Generates: areas (with paths), hiddenInfo

## Cross-References

| Field | References |
|-------|------------|
| `region` | `tabs/regions.json` |
| `factions` | `tabs/factions.json` |
