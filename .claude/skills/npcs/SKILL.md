---
name: npcs
description: Schema and rules for creating NPCs
context: fork
agent: npcs
---

# NPCs

Edit `tabs/npcs.json`.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `type` | Use existing npcType when it fits, otherwise `""` for unique NPCs |
| `currentLocation` | Use a fitting existing location, or invent one |
| `currentArea` | Use `""` if not relevant, or a valid area from the location |
| `gender` | Always set - aim for distribution: 40% male, 40% female, 20% non-binary |
| `basicInfo` | Three-sentence structure (see format below) |
| `personality` | Four traits using personality psychology (see format below) |
| `hiddenInfo` | Full paragraph - mix of narrative secrets and gameplay-useful information |
| `abilities` | At least five abilities + fighting style summary (see format below) |
| `tier` | Always set to `mythic` for combat NPCs (determines intent complexity) |
| `level` | Always set - each level adds +1 to damage output (see guidelines below) |
| `hpMax` | Always set - see HP guidelines below |
| `known` | Always set to `true` |
| `voiceTag` | Voice tag for speech synthesis (see [voice-tags reference](references/voice-tags.md)) |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `faction` | Only for major plot-relevant faction membership |
| `aliases` | Include when NPC is commonly referred to by title, epithet, or nickname in the story (e.g. `"the captain"`, `"Reed"`). Only list exact strings the narrator or other NPCs would literally speak — these are matched verbatim during dialogue speaker attribution |

## Never Include

Omit these fields (auto-set or unused):
- `vulnerabilities`, `resistances`, `immunities`
- `visualDescription`, `visualTags`
- `detailType`, `hpCurrent`, `activeBuffs`
- `currentCoordinates`, `embeddingId`, `embedding`, `portraitUrl`
- `properName`, `status`, `relationship`, `lastSeenTick`
- `lastSeenLocation`, `lastSeenArea`, `playerNotes`
- `needsDetailGeneration`, `deathXPAwarded`

## basicInfo Format

Three sentences covering role, appearance, and dress:

1. One sentence about what they are
2. One elaborate sentence about their appearance and species features in detail
3. One short sentence about their clothes/equipment

Format: "A [gender] [species] [role]. [Build] with [hair], [eyes], [species features in detail]. Wears [X]."

## personality Format

Four traits in this order, drawing from personality psychology trait vocabulary:

1. **Positive trait** - a strength or virtue
2. **Neutral trait** - a characteristic that's neither good nor bad
3. **Negative trait** - a flaw or weakness
4. **Speaking style** - how they talk (verbal patterns, tone, word choice)

Format: "Label: Explanation in under 10 words"

## abilities Format

At least five appropriate abilities plus a fighting style summary.

### Ability Descriptions

Format: `"Ability Name: 3 sentence description of what it is and how it can be used."`

Describe what the ability is, then list possibilities for how it can be used. Stay vague enough for creative interpretation but elaborate enough to inspire varied usage. Show flexibility - most abilities can be used offensively, defensively, or for utility depending on the situation.

### fighting style Summary

The final entry summarizes their overall combat approach - longer and more detailed than individual abilities. **Important:** Include a literal `\n` before "fighting style" so it appears on its own line when displayed.

Format: `"\nfighting style: [5 sentences covering how they fight]"`

Include:
- How they combine and synergize their abilities
- Tactical preferences and engagement patterns
- Emotional tone and attitude in combat
- How their personality manifests when fighting
- How they adapt to different situations or opponents

## level & hpMax Calculation

Players start with 100 HP and deal ~16 damage on success.

- **level**: Determines NPC damage. Calculate hits to down player: `100 ÷ (16 + level)`
- **hpMax**: Determines NPC survivability. Calculate hits to down NPC: `hpMax ÷ 16`

## hiddenInfo Guidelines

Write a full paragraph with maximum variety. No formula - be creative.

Mix different types of secrets:
- Personal history and backstory
- Fears, desires, and contradictions
- Connections to other NPCs or factions
- Knowledge of locations, treasures, or dangers
- Skills or abilities not immediately apparent
- Plans, schemes, or hidden agendas

Both narrative depth AND gameplay-useful information should be included.

## Schema

```typescript
interface NPC {
  name: string
  type: string
  currentLocation: string
  currentArea: string
  tier?: 'trivial' | 'weak' | 'average' | 'strong' | 'elite' | 'boss' | 'mythic'
  gender?: string
  faction?: string
  basicInfo?: string
  hiddenInfo?: string
  personality?: string[]
  abilities?: string[]
  level?: number
  hpMax?: number
  known?: boolean
  voiceTag?: string
  vulnerabilities?: string[]
  resistances?: string[]
  immunities?: string[]
}
```

## Species Ability Inheritance

When creating an NPC with a species `type`, the NPC should **inherit the 3 species skills** from the corresponding trait as abilities:

1. Look up the species in `tabs/traits.json`
2. Copy those skill names and descriptions into the NPC's `abilities` array
3. Add additional unique abilities specific to that individual
4. Add the `\nfighting style:` summary

See [Species Consistency Rules](../species-rules.md) for the full requirements.

## Reference

For detailed documentation, see [npcs-reference.md](references/npcs-reference.md).
