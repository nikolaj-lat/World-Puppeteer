---
name: factions
description: Schema and rules for creating factions
context: fork
agent: factions
---

# Factions

Edit `tabs/factions.json`.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `basicInfo` | Three-sentence structure (see format below) |
| `factionType` | `"minor"` for local groups, `"major"` for influential organizations |
| `hiddenInfo` | Full paragraph of secrets (see guidelines below) |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `known` | Set to `false` to hide at game start. Omit otherwise |

## Never Include

Omit these fields (auto-set at runtime):
- `detailType`, `embeddingId`, `embedding`

## basicInfo Format

Three sentences covering scope, purpose, and public perception:

1. One sentence about what the faction is and its scope
2. One sentence about their goals or activities
3. One sentence about how outsiders perceive them

Format: "[Name] is [scope description]. They [primary activity or goal]. [Public reputation or perception]."

## hiddenInfo Guidelines

Write a full paragraph revealing what is not publicly known. Mix different types of secrets:
- True origins or founding history
- Internal conflicts or power struggles
- Secret alliances or enmities with other factions
- Hidden resources, locations, or capabilities
- Long-term plans or hidden agendas
- Dark secrets or moral compromises

Both narrative depth AND gameplay-useful information should be included.

## factionType Selection

| Type | Use When |
|------|----------|
| `minor` | Local militia, small guilds, neighborhood groups, single-location organizations |
| `major` | Kingdom-spanning guilds, religious orders, noble houses, crime syndicates |

Minor factions get details generated more aggressively than major factions.

## Discovery Mechanics

Factions default to `known: true` at runtime unless the config explicitly sets `known: false`. Use `known: false` for secret organizations, hidden cults, or factions the player must discover through gameplay. Triggers can also reveal or hide factions dynamically using the `known-entity` effect.

## Schema

```typescript
interface Faction {
  name: string
  basicInfo: string
  factionType: 'minor' | 'major'
  hiddenInfo: string
  known?: boolean
}
```

## Faction + World Lore Sync

When creating a faction, you must also create a corresponding World Lore entry. The faction key and world lore key must match exactly. The faction `basicInfo` and world lore `text` must be **identical** (same text, two retrieval pathways: semantic search for lore, exact key match for faction).

## Reference

For detailed documentation, see [factions-reference.md](references/factions-reference.md).
