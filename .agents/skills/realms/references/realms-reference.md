# Realms Reference

Complete documentation for `tabs/realms.json`.

## Schema

```typescript
interface Realm {
  name: string            // ✅ Display name, must match object key
  basicInfo: string     // ✅ Prose realm description
  known?: boolean         // ✅ Defaults to true; set false to hide at game start
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread
- ❌ **Always overwritten**: Set by initialization regardless of what exists in config

## Hierarchy Position

Realms sit at the top of the location hierarchy:

```
Realm (optional, thematic container)
  └── Region (grid cell with coordinates)
        └── Location (point within region with radius)
              └── Area (node in location graph)
```

## Runtime Behavior

When the game initializes, realms default to `known: true` unless the config explicitly sets `known: false`. Players cannot access locations in unknown realms.

To reveal or hide a realm dynamically, use a trigger effect:

```typescript
{
  type: 'known-entity',
  entity: 'Shadow Realm',
  operator: 'set',
  value: true
}
```

Or set the party's realm directly (auto-reveals):

```typescript
{
  type: 'party-realm',
  operator: 'set',
  value: 'Shadow Realm'
}
```

## Location Cascading

When setting `party-location`, the system automatically updates the realm:

```
Set party-location: "Shadow Gate"
        ↓
currentLocation = "Shadow Gate"
currentRegion = location.region
currentRealm = region.realm
```

For cross-realm travel to work, locations must have their region's `realm` field set correctly.

## Cross-References

| Field | References |
|-------|------------|
| Region's `realm` | Keys in `tabs/realms.json` |
| Trigger `party-realm` | Keys in `tabs/realms.json` |
| Story start realm | Keys in `tabs/realms.json` |
