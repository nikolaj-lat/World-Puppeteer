# Factions Reference

Complete documentation for `tabs/factions.json`.

## Schema

```typescript
interface Faction {
  name: string                     // ✅ Faction name, must match object key
  basicInfo: string                // ✅ Public information about the faction
  factionType: 'minor' | 'major'   // ✅ Faction scope and influence level
  hiddenInfo?: string              // ✅ Secret information revealed via gameplay
  embeddingId?: string             // ✅ Reference to embeddings record
  detailType: 'basic' | 'detailed' // ❌ Always set to 'detailed' at creation
  known?: boolean                  // ✅ Defaults to true; set false to hide at game start
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread
- ❌ **Always overwritten**: Set by initialization regardless of what exists in config

## Initialization Behavior

When `createFactionFromDefinition` runs:

```typescript
return {
    ...factionDefinition,  // ALL config fields preserved first
    detailType: 'detailed',  // ALWAYS overwritten
    known: factionDefinition.known !== false,  // Defaults to true
}
```

Factions have `detailType` always overwritten. The `known` field honors the config value (defaults to `true` if omitted).

## Faction Types

| Type | Description | Detail Generation |
|------|-------------|-------------------|
| `minor` | Local or small-scale faction | More aggressive |
| `major` | Large, influential faction | Less aggressive |

## NPC Association

NPCs belong to factions via their `faction` field:

```typescript
npcs: {
  "guard-captain": {
    name: "Guard Captain",
    faction: "town-guard"
  }
}
```

Faction membership affects:
- NPC behavior toward party
- Hostility/friendliness
- Information available to party
- Which NPCs work together

## Location Presence

Factions can be associated with locations and regions:

```typescript
locations: {
  "fortress": {
    factions: ["iron-legion", "merchants-guild"]
  }
}

regions: {
  "northern-wastes": {
    factions: ["nomad-tribes"]
  }
}
```

## Discovery Mechanic

Factions default to `known: true` unless the config sets `known: false`. Unknown factions may be:
- Referenced vaguely in narrative
- Discovered through exploration
- Revealed by triggers

To reveal or hide a faction dynamically via trigger:
```typescript
{
  type: 'known-entity',
  entity: 'shadow-guild',
  operator: 'set',
  value: true
}
```

## generateFactionDetails

Reads `basicInfo` and generates: hiddenInfo.

## Cross-References

No cross-reference fields remain on factions.
