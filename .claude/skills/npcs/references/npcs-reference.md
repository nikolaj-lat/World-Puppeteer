# NPCs Reference

Complete documentation for `tabs/npcs.json`.

## Schema

```typescript
interface NPC {
  name: string                    // ✅ Display name, must match object key
  type: string                    // ✅ Key from npc-types.json or ""
  currentLocation: string         // ✅ Key from locations.json or ""
  currentArea: string             // ✅ Area within location or ""
  gender?: string                 // ✅ "male", "female", or "non-binary"
  faction?: string                // ✅ Key from factions.json
  basicInfo?: string              // ✅ Immediately available info
  hiddenInfo?: string             // ✅ Info revealed via interaction
  visualDescription?: string      // ✅ Used for portrait generation
  visualTags?: string[]           // ✅ Only used for image caching
  personality?: string[]          // ✅ Prose descriptions of personality traits
  abilities?: string[]            // ✅ Prose descriptions of abilities
  aliases?: string[]              // ✅ Alternate names/titles matched during dialogue speaker attribution (e.g. "the captain", "Reed")
  level?: number                  // ⚠️ For premade NPCs, defaults to a 50/50 roll between 1 and 2 — set explicitly for any NPC that should be stronger. Each level adds +1 base damage
  hpMax?: number                  // ⚠️ Calculated from level + tier if undefined
  hpCurrent?: number              // ⚠️ Defaults to hpMax if undefined
  tier?: 'trivial' | 'weak' | 'average' | 'strong' | 'elite' | 'boss' | 'mythic'                  // ✅ Affects HP calculation AND combat intent complexity.
  vulnerabilities?: string[]      // ✅ 1.5× damage from these types. Unions with npc-type's vulnerabilities
  resistances?: string[]          // ✅ 0.5× damage from these types. Unions with npc-type's resistances
  immunities?: string[]           // ✅ 0× damage from these types. Unions with npc-type's immunities
  activeBuffs?: ActiveBuff[]      // ✅ See ActiveBuff schema below
  known?: boolean                 // ✅ Whether NPC appears in player journal
  lastSeenLocation?: string       // ✅ Preserved if predefined, but auto-updated when NPC is nearby. Shown in journal as "Last seen at..."
  lastSeenArea?: string           // ✅ Preserved if predefined, but auto-updated when NPC is nearby. Shown in journal with lastSeenLocation
  currentCoordinates?: number[]   // ✅ [x, y] for wilderness positioning
  detailType?: 'basic' | 'detailed'  // ⚠️ Defaults to 'detailed' if undefined. If 'detailed', generateNPCDetails won't run
  voiceTag?: string               // ✅ Voice tag for speech synthesis (see voice-tags.md)
  questOriginArcId?: string       // ✅ Auto-generated for quest-spawned NPCs. Links to the arc that spawned this NPC; provides arc theme/secrets to AI detail generation
  questOriginQuestId?: string     // ✅ Auto-generated for quest-spawned NPCs. Links to the quest that spawned this NPC; provides quest design brief to AI detail generation
  embedding?: number[]            // ✅ Auto-generated
  embeddingId?: string            // ✅ Auto-generated
  portraitUrl?: string            // ✅ .png portrait image URL
  needsDetailGeneration?: boolean // ✅ Flag to async trigger  generateNPCDetails
  deathXPAwarded?: boolean        // ✅ Whether XP will be given on death
  properName: string              // ❌ Always set to name
  status: '' | 'near death' | 'dying' | 'dead'      // ❌ Always set to ''
  relationship: number            // ❌ Always set to 0
  lastSeenTick: number            // ❌ Always set to -1. Value of -1 means immune to cleanup until first seen
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread
- ⚠️ **Calculated default**: Has fallback logic if not predefined
- ❌ **Always overwritten**: Set by initialization regardless of what exists in config

## ActiveBuff Schema

```typescript
interface ActiveBuff {
  type: 'resource' | 'resistance' | 'vulnerability' | 'immunity'  // Buff type
  amount: number                // Buff magnitude, only used for type 'resource' (NPC health)
  duration: number              // Ticks remaining before buff expires
  source: string                // Description of buff source
  resource: string              // For type 'resource': the world's health resource — accepts 'health', 'hp', or the configured isHealth resource name. NPCs have no other resources, so any non-health name is ignored. Otherwise use ""
  attribute: string             // Always "" for NPCs (they have no attributes)
  skill: string                 // Always "" for NPCs (they have no skills)
  damageType?: string           // For type 'resistance'|'vulnerability'|'immunity': the damage type as a string
}
```

Static resistances and buff resistances stack: 0.5× (static) × 0.5× (buff) = 0.25× (75% reduction).

## Tier Effects

### HP Multipliers

| Tier | Multiplier | Effect |
|------|------------|--------|
| trivial | 0.15 | -85% HP |
| weak | 0.5 | -50% HP |
| average | 1.0 | Base HP |
| strong | 1.25 | +25% HP |
| elite | 1.5 | +50% HP |
| boss | 1.7 | +70% HP |
| mythic | 1.85 | +85% HP |

Formula: `(npcHealthPerLevel × level + npcMinHealth) × tierHPModifier`

### Damage Multipliers

Each tier also scales NPC damage output (engine constants, not configurable):

| Tier | Multiplier | Effect |
|------|------------|--------|
| trivial | 0.65 | -35% damage |
| weak | 0.8 | -20% damage |
| average | 1.0 | Base damage |
| strong | 1.12 | +12% damage |
| elite | 1.25 | +25% damage |
| boss | 1.35 | +35% damage |
| mythic | 1.55 | +55% damage |

### Combat Intent Complexity

Tier determines how many intents an NPC generates in combat and their tactical sophistication:

| Tier | Intents | Behavior |
|------|---------|----------|
| trivial / weak | 1 | Simple, direct actions |
| average | 1-2 | Basic tactics |
| strong | 2 | Uses abilities when appropriate |
| elite / boss / mythic | 2-3 | Tactical and dramatic |

### Death Countdown (Major NPCs)

NPCs with tier `elite`, `boss`, or `mythic` (and party member NPCs) use a 3-turn death countdown when they reach 0 HP:

| Turn | Status | Description |
|------|--------|-------------|
| 1 | `near death` | Just went down, can be healed |
| 2 | `dying` | Slipping closer to death |
| 3 | `dead` | Permanently dead, cannot be revived |

Standard-tier NPCs (`trivial`, `weak`, `average`, `strong`) die instantly at 0 HP.

## generateNPCDetails

Only runs when `detailType: 'basic'` and `needsDetailGeneration: 'true'`

Reads `basicInfo` and generates: personality, hiddenInfo, faction, abilities, detailType, known, portraitUrl. Sets `needsDetailGeneration` to false when complete.

## Cross-References

| Field | References |
|-------|------------|
| `type` | `tabs/npc-types.json` |
| `currentLocation`, `currentArea` | `tabs/locations.json` |
| `faction` | `tabs/factions.json` |
| `vulnerabilities`, `resistances`, `immunities` | `combatSettings.damageTypes` in `tabs/settings.json`|
