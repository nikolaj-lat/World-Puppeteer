# NPCs Reference

Complete documentation for `tabs/npcs.json`.

## Schema

```typescript
interface NPC {
  name: string                    // ✅ Display name, must match object key
  type: string                    // ✅ Key from npc-types.json or ""
  currentLocation: string         // ✅ Key from locations.json or "". Matching ignores casing and whitespace. Blank means off-stage until placed (e.g. by an npc-placement trigger effect)
  currentArea: string             // ✅ Area within location or "". Blank means "somewhere in this location": the NPC can appear in any area there. Set an area only to pin the NPC to it
  gender?: string                 // ✅ "male", "female", or "non-binary"
  faction?: string                // ✅ Key from factions.json
  relationship?: number           // ✅ Starting attitude toward the player, -100..100; 0 is genuinely Neutral. Omit to let the AI initialize it on the NPC's first turn in the scene (see Relationship below)
  basicInfo?: string              // ✅ Immediately available info
  hiddenInfo?: string             // ✅ Info revealed via interaction
  visualDescription?: string      // ✅ Used for portrait generation
  visualTags?: string[]           // ✅ Only used for image caching
  personality?: string[]          // ✅ Prose descriptions of personality traits
  abilities?: string[]            // ✅ Prose descriptions of abilities
  aliases?: string[]              // ✅ Alternate names/titles (e.g. "the captain", "Reed") used only to match input/dialogue to this NPC; never sent to the AI
  level?: number                  // ⚠️ Set explicitly (1 or higher) for any NPC that should be stronger; an explicit level is used as-is. If omitted or set to 0, the engine rolls a level near the party average when the NPC first becomes visible (so it reflects the party's level at that moment), then clamps it into the npcLevelRange of the NPC's location (or, if the location has none, its region). Each NPC level adds +2 to base damage
  hpMax?: number                  // ⚠️ Used exactly as written when authored; the engine never raises it to its own calculation. If undefined, derived live from level, tier, healthMultiplier, and difficulty. Set 0 (with hpCurrent 0) to spawn the NPC dead/dying
  hpCurrent?: number              // ⚠️ Defaults to hpMax if undefined; clamped to the final hpMax
  healthMultiplier?: number       // ✅ Scales calculated max HP. 1 is normal, 10 is ten times normal, 0.5 is half. Clamped to 0.1–100 (non-numeric values are treated as 1)
  tier?: 'trivial' | 'weak' | 'average' | 'strong' | 'elite' | 'boss' | 'mythic'                  // ⚠️ Defaults to 'average' if omitted. Affects HP calculation AND combat intent complexity. Named NPCs the story introduces keep their generated tier
  vulnerabilities?: string[]      // ✅ 1.5× damage from these types. Unions with npc-type's vulnerabilities
  resistances?: string[]          // ✅ 0.5× damage from these types. Unions with npc-type's resistances
  immunities?: string[]           // ✅ 0× damage from these types. Unions with npc-type's immunities
  successBonus?: number           // ✅ Flat bonus to the NPC's action success score. 0 (the default) leaves rolls unchanged; clamps to -1000..1000, and 25 points is one full success tier (see Combat Tuning below)
  damageModifier?: number         // ✅ Percent change to the NPC's outgoing damage: 0 (the default) unchanged, -100 removes it, 100 doubles it. Clamps to -100..10000 (see Combat Tuning below)
  damageReductionModifier?: number // ✅ Percent reduction to damage the NPC takes: 0 (the default) unchanged, 100 is true immunity. Clamps to 0..100 (see Combat Tuning below)
  activeBuffs?: ActiveBuff[]      // ✅ See ActiveBuff schema below
  known?: boolean                 // ✅ Whether NPC appears in player journal
  lastSeenLocation?: string       // ✅ Preserved if predefined, but auto-updated when NPC is nearby. Shown in journal as "Last seen at..."
  lastSeenArea?: string           // ✅ Preserved if predefined, but auto-updated when NPC is nearby. Shown in journal with lastSeenLocation
  currentCoordinates?: number[]   // ✅ [x, y] for wilderness positioning
  detailType?: 'basic' | 'detailed'  // ⚠️ Defaults to 'detailed' if undefined. If 'detailed', generateNPCDetails won't run
  voiceTag?: string               // ✅ Voice tag for speech synthesis (see voice-tags.md)
  worldVoiceId?: string           // ✅ Key from the world's worldVoices catalog. Overrides the generic voiceTag pick for this NPC; works whether or not the voice is exposed in character creation
  portraitFocusX?: number         // ✅ Horizontal crop focus for an authored portrait. 0..100, defaults to 50 (centered). Generated portraits ignore it
  portraitFocusY?: number         // ✅ Vertical crop focus for an authored portrait. 0..100, defaults to 0 (top). Generated portraits ignore it
  portraitZoom?: number           // ✅ Zoom level for the portrait crop. 100..300, defaults to 100 (no zoom). Generated portraits ignore it
  questOriginArcId?: string       // ✅ Auto-generated for quest-spawned NPCs. Links to the arc that spawned this NPC; provides arc theme/secrets to AI detail generation
  questOriginQuestId?: string     // ✅ Auto-generated for quest-spawned NPCs. Links to the quest that spawned this NPC; provides quest design brief to AI detail generation
  embedding?: number[]            // ✅ Auto-generated
  embeddingId?: string            // ✅ Auto-generated
  portraitUrl?: string            // ✅ .png portrait image URL
  needsDetailGeneration?: boolean // ✅ Flag to async trigger  generateNPCDetails
  deathXPAwarded?: boolean        // ✅ Whether XP will be given on death
  properName?: string             // ⚠️ The NPC's true name. Defaults to name if omitted. Set it (different from name) for a hidden-identity NPC: name is the current display name, properName is revealed later. The identity counts as revealed once the two match, and a reveal flips name to properName
  status: string                  // ❌ Always set to ''. Free-form runtime text; mortality is no longer encoded here (see Death Countdown below)
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

Formula: `(npcHealthPerLevel × level + npcMinHealth) × tierHPModifier × healthMultiplier × difficultyHealthMultiplier`

### How HP Is Calculated

An authored `hpMax` is used **exactly as written** — the formula above and the game's difficulty never modify it, and the engine never raises it to its own calculation. Only missing HP is computed.

When `hpMax` is not authored, HP is derived **live** from the formula each time it's needed — it is not frozen at world load, so the NPC's HP always reflects the game's actual difficulty.

On an NPC with **no authored `level`** (or `level: 0`), level and HP resolve lazily when the NPC first becomes visible (level near the party average, clamped to the location's or region's level range; HP from the formula unless authored). An authored `hpCurrent` is always clamped to the final `hpMax`; authoring `hpCurrent: 0` deliberately spawns the NPC dead/dying.


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

NPCs with tier `elite`, `boss`, or `mythic` (and party member NPCs) use a 3-turn death countdown when they reach 0 HP. The countdown is a runtime incapacitation counter that creators never set (it is not stored in `status`):

| Counter | State | Description |
|---------|-------|-------------|
| 1 | near death | Just went down, can be healed |
| 2 | dying | Slipping closer to death |
| 3 | dead | Dead; revivable only as described below |

Standard-tier NPCs (`trivial`, `weak`, `average`, `strong`) die instantly at 0 HP.

### Death and Healing

- Positive healing clears near death and dying.
- A dead character is revived only by explicit healing (an NPC, a player action, an item, a spell, or a story event) in non-permadeath games. Passive recharge and ordinary rest never revive.
- Under permadeath, a dead character cannot be revived.
- Recover and Revive restore 35% of max health.

### Party-Member Promotion

A party-member NPC below `elite` is promoted to `elite` when it levels up alongside the party, so long-term companions become major NPCs (gaining the death countdown and higher HP/damage modifiers).

## Combat Tuning

Three optional fields tune an individual NPC's combat math. Each defaults to 0 (no change) when omitted. Out-of-range values survive in hand-written JSON; the engine clamps them at read time.

### successBonus

A flat bonus to the NPC's action success score, in the player success-score space. NPC rolls sample a score inside the rolled tier's band, add `successBonus`, then re-derive the tier from the total. 25 points is one full success tier, so `successBonus: 25` shifts every roll up a tier and `-25` shifts every roll down one. Clamps to -1000..1000; at 0 the roll distribution is unchanged.

An NPC's natural roll always lands at basic success or better, so a negative bonus is how you make an NPC fumble. Applies to any acting NPC, ally or enemy.

### damageModifier

Percent change to the NPC's outgoing damage: 0 unchanged, -100 removes it entirely, 100 doubles it. Clamps to -100..10000. Multiplies with per-attack impact and affects damage only; healing the NPC gives lands at normal strength.

### damageReductionModifier

Percent reduction to damage the NPC takes: 0 unchanged, 100 is true immunity. It is applied after all other bonuses, so at 100 nothing leaks through. Clamps to 0..100: values above 100 saturate at full immunity, and negative values read as 0. Reduces damage from any attacker, player or NPC alike; healing the NPC receives lands at full strength.

## Relationship

`relationship` is the NPC's attitude toward the player, from -100 to 100, mapped to named stages by the world's `relationshipStages`. An authored value is preserved exactly, including 0: authoring `relationship: 0` means genuinely Neutral. Values outside -100..100 are an authoring error.

When the field is omitted, the NPC starts with a pending relationship, and the AI initializes it on the first turn the NPC is in the scene. The AI picks an absolute score (not a delta) inferred from `basicInfo`, `hiddenInfo`, `personality`, `faction`, and the story so far, so the rest of the NPC record indirectly sets the starting attitude. A creator-editable AI-instruction section guides this initialization (see the ai-instructions skill).

While the relationship is pending, the story prompt gives the narrator no attitude cue; NPC chat and the npc-relationship / npc-relationship-stage trigger conditions read it as 0 and the neutral stage.

## Placement

A blank or omitted `currentArea` means "somewhere in this location": the NPC can appear in any area there. Authoring an NPC by location alone is legitimate; choose an area only when the NPC should be pinned to it. In a location that has areas, treat a blank `currentArea` as an explicit choice rather than an accident.

`currentLocation` may also be blank: such an NPC is off-stage until placed, for example by an npc-placement trigger effect.

## Naming

Avoid giving an NPC (key, `name`, or `properName`) any of these names: `allSceneNPCs`, `anySceneNPC`, `allPartyNPCs`, `anyPartyNPC`. They are reserved trigger selector tokens; an NPC answering to one takes over that token, and the selector becomes unusable in that world.

Name resolution works the same across the engine: record keys and display names match interchangeably, case-insensitively, and a `name` match on any NPC beats a `properName` match. Display names are not unique, so an effect naming a shared display name reaches every NPC with that name: keep names unique when you need precise targeting.

## NPC Chat

Players can tap an NPC to talk to it directly. The chat reads the NPC's `basicInfo` (description), `personality` (voice and tone), `hiddenInfo` (the NPC knows this about itself and can let it slip), `faction`, `relationship` (as the attitude stage), status and HP, plus the world background and relevant world lore. Other NPCs present in the scene are seen only by name and `basicInfo`.

Chat is available outside combat and only with living NPCs. When a conversation ends, it is summarized into the story. Creator-editable AI-instruction sections exist for dialogue style, conversation starters, and the conversation summary (see the ai-instructions skill).

## Triggers

NPC state is readable and writable from world triggers: the npc-health, npc-health-percent, npc-in-scene, npc-in-party, npc-realm, npc-region, npc-location, and npc-area conditions, and the npc-health, npc-in-party, npc-portrait, and npc-placement effects. Full semantics live in the triggers reference. Death detection is npc-health equals 0. The npc-placement and npc-in-party effects act on NPCs that are still up; npc-health effects can revive downed allies, after which they can be moved or recruited again.

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
| `worldVoiceId` | `worldVoices` keys in `tabs/settings.json` |
