# Factions Reference

Complete documentation for `tabs/factions.json`.

## Schema

```typescript
interface Faction {
  name: string                     // ✅ Faction name, must match object key
  basicInfo: string                // ✅ Public information about the faction
  factionType: 'minor' | 'major'   // ✅ major: passed to new-region generation, journal label "World"; minor: journal label "Local"
  hiddenInfo?: string              // ✅ Secret information revealed via gameplay
  embeddingId?: string             // ✅ Reference to embeddings record
  known?: boolean                  // ✅ true: in the journal from the start. false or omitted: hidden until the story names the faction
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread
- ❌ **Always overwritten**: Set by initialization regardless of what exists in config

## Initialization Behavior

Factions are copied into the game exactly as authored; no field is overwritten or defaulted at game start.

A faction is known only when `known` is `true`. With `known: false`, or with no `known` field at all, it is hidden: absent from the journal and reading as not known to `known-entity` trigger conditions, until the latest story text names it in full as a whole word or a `known-entity` effect reveals it.

## Factions Are Authored Content

The authored faction roster is the complete roster for the game. The engine feeds factions to the AI as fixed context (names, `basicInfo`, `hiddenInfo`, type, and known state) and manages their `known` flag during play, through story mentions and triggers.

## Faction Types

| Type | Effect |
|------|--------|
| `minor` | Labelled "Local" in the journal. Reaches the AI only through the regions, locations, and NPCs it is attached to |
| `major` | Labelled "World" in the journal. Also included as context whenever the engine generates a new region, so new regions can reference it |

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

Entries are faction keys from `tabs/factions.json`.

## Discovery Mechanic

Factions default to `known: true` unless the config sets `known: false`. An unknown faction is hidden from the party's faction list until it becomes known, which happens in two ways:

**Story mention.** After each turn the engine scans the latest story text for the faction's full `name` as a whole word. Matching ignores case and collapses spacing, so "the iron legion" reveals `Iron Legion`. Each turn's scan covers that turn's story text, so a faction a trigger has set back to `known: false` stays hidden until its name is written again.

**Trigger.** A `known-entity` effect sets `known` directly, in either direction:
```typescript
{
  type: 'known-entity',
  entity: 'shadow-guild',
  operator: 'set',
  value: true
}
```

Because reveal depends on the full name appearing in narration, give hidden factions distinctive names the narrator can plausibly write out verbatim (a faction called "The Watch" would be revealed by any mention of a watch).

## Cross-References

No cross-reference fields live on factions themselves. Factions are referenced by:

| Field | References |
|-------|------------|
| `locations[].factions`, `regions[].factions` | Faction keys |
| `npcs[].faction` | Faction key |
| `known-entity` trigger `entity` | Faction key |
| World lore entry key | Must match the faction key (see the world-lore sync rule in the skill) |
