# Regions Reference

Complete documentation for `tabs/regions.json`.

## Schema

```typescript
interface Region {
  name: string              // ✅ Display name, must match object key
  basicInfo: string         // ✅ Geographic and atmospheric description
  x: number                 // ✅ Integer grid coordinate (horizontal position)
  y: number                 // ✅ Integer grid coordinate (vertical position)
  realm?: string            // ✅ Key from realms.json (optional)
  factions?: string[]       // ✅ Keys from factions.json with regional presence
  hiddenInfo?: string       // ✅ Unused — region secrets belong in location or NPC entries
  known?: boolean           // ✅ Defaults to true; set false to hide at game start
  imageUrl?: string         // ✅ URL for the region's map image
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread
- ❌ **Always overwritten**: Set by initialization regardless of what exists in config

## Coordinate System

Regions occupy integer positions on a 2D grid. The grid extends infinitely in all directions.

```
        North (-y)
           ↑
West (-x) ← → East (+x)
           ↓
        South (+y)
```

### Grid Layout Example

```
Region (0,0)  Region (1,0)  Region (2,0)
Region (0,1)  Region (1,1)  Region (2,1)
Region (0,2)  Region (1,2)  Region (2,2)
```

### Cross-Region Travel

When players travel past region boundaries, coordinates wrap to the adjacent region:

```
From location (95, 50) in region (2,2)
Travel +10 in x direction
→ Arrive at (5, 50) in region (3,2)
```

The `regionSize` setting in `locationSettings` determines the coordinate space within each region (default: 100).

## Relationship to Realms

Realms are optional thematic containers. A region can exist:
- **Without a realm**: For single-realm worlds, omit the `realm` field entirely
- **Within a realm**: Reference the realm key for multi-realm worlds

Players can only access locations in regions whose realm is known (or regions without a realm).

```typescript
// Single-realm world (no realm field needed)
regions: {
  "northern-wastes": {
    name: "Northern Wastes",
    x: 0, y: 0
  }
}

// Multi-realm world
regions: {
  "northern-wastes": {
    name: "Northern Wastes",
    x: 0, y: 0,
    realm: "mortal-lands"
  },
  "shadow-wastes": {
    name: "Shadow Wastes",
    x: 0, y: 0,
    realm: "shadow-realm"
  }
}
```

Regions at the same coordinates in different realms can represent parallel locations (e.g., a place and its shadow reflection).

## Relationship to Locations

Locations exist within regions. Each location references its containing region and has float coordinates within the region's coordinate space.

```typescript
// Region defines the grid cell
regions: {
  "central-plains": {
    name: "Central Plains",
    x: 1, y: 1
  }
}

// Locations exist within the region
locations: {
  "thornhaven": {
    name: "Thornhaven",
    region: "central-plains",
    x: 45.5,    // Position within region (0 to regionSize)
    y: 32.0
  }
}
```

A region typically contains 3-8 locations, though this varies by world design.

## Location Cascading

When a trigger or travel action sets `party-location`, the system automatically updates the party's region:

```
Set party-location: "Thornhaven"
        ↓
currentLocation = "Thornhaven"
currentRegion = location.region ("central-plains")
currentRealm = region.realm (if set)
```

## Cross-References

| Field | References |
|-------|------------|
| `realm` | `tabs/realms.json` |
| `factions` | `tabs/factions.json` |
| (referenced by) `region` field in locations | `tabs/locations.json` |
