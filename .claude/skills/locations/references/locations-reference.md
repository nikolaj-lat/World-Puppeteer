# Locations Reference

Complete documentation for `tabs/locations.json`.

## Schema

```typescript
interface Location {
  name: string                      // ✅ Display name, must match object key
  basicInfo: string                 // ✅ Description of the location
  x: number                         // ✅ X coordinate on world map
  y: number                         // ✅ Y coordinate on world map
  radius: number                    // ✅ Size of location (affects travel time)
  region: string                    // ✅ Key from regions.json
  complexityType: ComplexityType    // ✅ 'simple' | 'complex' | 'wilderness'
  detailType: 'basic' | 'detailed'  // ✅ Detail level - 'basic' triggers AI generation
  areas?: Record<string, Area>      // ✅ Areas within location (for complex types)
  factions?: string[]               // ✅ Keys from factions.json
  hiddenInfo?: string               // ✅ Secret information revealed through exploration
  visualTags?: string[]             // ✅ Visual metadata tags for the location
  imageUrl?: string                 // ✅ URL for the location's image
  embeddingId?: string              // ✅ Reference to embeddings record
  known?: boolean                   // ✅ Defaults to true; set false to hide at game start
  visited?: boolean                 // ❌ Always false at creation
  lastVisitedTick?: number          // ❌ Always 0 at creation
  visitedAreas?: string[]           // ❌ Always [] at creation
  questOriginArcId?: string         // ✅ Auto-generated for quest-spawned locations. Links to the arc that spawned this location; provides arc context to AI detail generation
  questOriginQuestId?: string       // ✅ Auto-generated for quest-spawned locations. Links to the quest that spawned this location; provides quest design brief to AI detail generation
}

type ComplexityType = 'simple' | 'complex' | 'wilderness'
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread
- ❌ **Always overwritten**: Set by initialization regardless of what exists in config

## Area Schema

```typescript
interface Area {
  description: string   // Brief description of the area
  paths: string[]       // Connected area names (must be bidirectional)
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

## generateLocationDetails

Only runs when `complexityType: 'complex'` AND `detailType: 'basic'`.

Reads: basicInfo, existing areas
Generates: areas (with paths), hiddenInfo

## Cross-References

| Field | References |
|-------|------------|
| `region` | `tabs/regions.json` |
| `factions` | `tabs/factions.json` |
