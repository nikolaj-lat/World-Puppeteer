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
  aliases?: string[]              // ✅ Alternate names/titles (e.g. "the captain", "Reed") used only to match input/dialogue to this NPC; never sent to the AI
  level?: number                  // ⚠️ Set explicitly for any NPC that should be stronger; an explicit level is used as-is. If omitted, the engine rolls a level near the party average when the NPC first becomes visible (so it reflects the party's level at that moment), then clamps it into the npcLevelRange of the NPC's location (or, if the location has none, its region). Each NPC level adds +2 to base damage
  hpMax?: number                  // ⚠️ Calculated from level + tier if undefined
  hpCurrent?: number              // ⚠️ Defaults to hpMax if undefined
  healthMultiplier?: number       // ✅ Scales calculated max HP. 1 is normal, 10 is ten times normal, 0.5 is half. Clamped to 0.1–100. Ignored when hpMax is set explicitly
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
  properName?: string             // ⚠️ The NPC's true name. Defaults to name if omitted. Set it (different from name) for a hidden-identity NPC: name is the current display name, properName is revealed later. The identity counts as revealed once the two match, and a reveal flips name to properName
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

### Party-Member Promotion

A party-member NPC below `elite` is promoted to `elite` when it levels up alongside the party, so long-term companions become major NPCs (gaining the death countdown and higher HP/damage modifiers).

## What the AI Sees About an NPC

`basicInfo`, `hiddenInfo`, and `abilities` are exposed to the AI only when the NPC is `detailType: 'detailed'`.

- `hiddenInfo` is sent to the combat-intent task, the story narration, and the NPC's own dialogue.
- `abilities` are sent to the combat-intent and detail-generation tasks, but not to the story narration. When generating combat intents, about 3 of an NPC's abilities are sampled at random each turn, re-sampled every turn.

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
