---
name: settings
description: Schema and rules for editing settings
context: fork
agent: settings
---

# Settings

Edit `tabs/settings.json`.

## Power Level Framework

Characters progress through four power levels based on skill proficiency:

| Power Level | Skill Range | Experience |
|-------------|-------------|------------|
| I | 1-10 | Fails almost every roll - training arc |
| II | 10-30 | Fails most rolls - underdog experience |
| III | 30-40 | Succeeds most rolls - capable hero |
| IV | 40-60 | Succeeds almost always - master |

The balanced values below support this progression curve.

## Required Fields by Category

### Attribute Settings

| Field | Balanced Value | Notes |
|-------|----------------|-------|
| `startingAttributeValue` | `0` | Traits determine attributes, not point-buy |
| `startingAttributePoints` | `0` | No point allocation |
| `maxStartingAttribute` | `0` | No hard cap (traits handle limits) |
| `attributeBonusModifier` | `2.5` | Each attribute point = +2.5 to checks |
| `lowAttributeThreshold` | `8` | Below this grants weakness traits |

### Skill Settings

| Field | Balanced Value | Notes |
|-------|----------------|-------|
| `trainingCooldown` | `10` | Ticks between training opportunities |
| `skillBonusModifier` | `1` | Each skill level = +1 to checks |
| `maxSkillLevel` | `999` | Effectively uncapped |
| `maxSkillSuccessLevel` | `999` | Cap on the absolute contribution any single skill, attribute, ability, random roll, or context modifier can make to a success check |
| `startingXPToLevelUpSkill` | `50` | Fast early progression |
| `additionalXPRequiredPerSkillLevel` | `50` | Consistent XP increase per level |
| `baseXPFromSkillUpgrade` | `100` | Bonus XP when skills level up |
| `charXPPerSkillLevel` | `100` | Character XP from skill progression |
| `baseChanceToLearnNewSkill` | `1` | Use 1 if world allows learning new skills, 0 if fixed |
| `skillLearningBonusModifier` | `1` | Use 1 if world allows learning new skills, 0 if fixed |
| `xpFromNewSkill` | `200` | Character XP when learning a new skill |
| `newSkillGenerationEnabled` | `true` | Allow the AI to invent skills not in the config; `false` restricts characters to predefined skills |

### Skill XP Rewards

| Field | Balanced Value |
|-------|----------------|
| `skillXPRewards.small` | `50` |
| `skillXPRewards.medium` | `100` |
| `skillXPRewards.large` | `150` |
| `skillXPRewards.huge` | `200` |

### Location Settings

| Field | Balanced Value | Notes |
|-------|----------------|-------|
| `regionSize` | `100` | 100km regions. Every location's `x`/`y` must sit within half the region size of the origin (within 50km at the balanced value) |
| `simpleRadius` | `5` | 5km simple interaction radius |
| `complexRadius` | `10` | 10km complex interaction radius |
| `avgTravelDistance` | `40` | 40km average between locations |
| `minTravelDistance` | `20` | 20km minimum between locations |
| `regionLocationCount` | `0` | Designer defines per world |
| `encountersEnabled` | `false` | Enable random wilderness encounters during travel |
| `regionMapBorderFeatheringEnabled` | `false` | Feathered border / rounded frame treatment on region map images. Defaults to `false`; set `true` to enable |

### Item Settings

| Field | Balanced Value | Notes |
|-------|----------------|-------|
| `startingItems` | `[]` | Starting items come from traits |

### Combat Settings

| Field | Balanced Value | Notes |
|-------|----------------|-------|
| `baseCombatXP` | `200` | Combat is rewarding |
| `minCombatXP` | `50` | Trivial fights still meaningful |
| `abilityCooldown` | `0` | Cooldown for AI-generated (learned) abilities + throttle on learning new ones; does not affect predefined abilities |
| `abilityBonus` | `10` | Default bonus for AI-generated (learned) abilities; does not scale predefined abilities |
| `npcDailyHealingAmount` | `999` | NPCs fully heal daily |

### NPC Health (otherSettings)

| Field | Balanced Value | Notes |
|-------|----------------|-------|
| `npcHealthPerLevel` | `10` | NPC HP per level |
| `npcMinHealth` | `0` | NPC base HP |

> Player HP scaling lives on the health resource (`resourceSettings.health.maxValue` and `gainPerLevel`), not in `otherSettings`. See the ai-instructions skill for the Resource schema.

### Character Progression (progressionSettings)

Required section. Character XP and level-up configuration lives here (legacy configs with XP fields in `otherSettings` migrate automatically).

| Field | Balanced Value | Notes |
|-------|----------------|-------|
| `startingCharacterLevelUpRequirement` | `500` | Base XP for first level |
| `extraRequiredXPPerCharacterLevel` | `100` | +100 XP per level; `0` = flat curve (only field allowed to be 0) |
| `maxCharacterLevel` | `999` | Effectively uncapped |
| `abilityPointEveryLevels` | `1` | Grant ability points every N levels |
| `abilityPointsPerGrant` | `1` | Ability points per grant (1/1 = one per level) |
| `attributePointEveryLevels` | `5` | Grant attribute points every N levels |
| `attributePointsPerGrant` | `1` | Attribute points per grant |
| `maxAttributeValue` | `999` | Cap on attributes raised by spending points |
| `traitPickEveryLevels` | `10` | Grant trait picks every N levels |
| `traitPicksPerGrant` | `1` | Trait picks per grant |
| `locationDiscoveryXP` | `10` | XP per party member on first entering an area |
| `levelUpTraitPool` | `[]` | Trait names offered on level-up picks — **empty means no trait picks are ever granted**; entries must name existing traits (see the traits skill) |
| `milestoneTitles` | defaults | `{ levelGranted, title }[]` — titles granted when a level is hit exactly; levels unique positive integers, titles non-blank |

All numeric fields must be positive whole numbers except `extraRequiredXPPerCharacterLevel` (non-negative).

## World-Specific Fields

These must be configured per-world:

| Field | Guidance |
|-------|----------|
| `attributeSettings.attributeNames` | Thematic attribute names for the world |
| `attributeSettings.lowAttributeTraits` | See lowAttributeTraits format below |
| `attributeSettings.attributeStatModifiers` | Only where narratively sensible (e.g., Constitution to Health) |
| `attributeSettings.attributeDamageModifiers` | Optional. Per-point % bonus to outgoing damage, keyed by attribute (e.g. `{ strength: 1 }` = +1% damage per point). Positive values only |
| `attributeSettings.attributeDamageReductionModifiers` | Optional. Per-point % reduction to incoming damage, keyed by attribute (e.g. `{ dexterity: 1 }` = -1% damage taken per point). Positive values only |
| `skillSettings.skillTypeDifficultyBonus` | Always include `"none": 0`, others creative |
| `itemSettings.currencyName` | Thematic currency name |
| `itemSettings.itemCategories` | Always include `"Armor"`, `"Consumable"`, plus world-specific |
| `itemSettings.itemSlots` | World-specific |
| `combatSettings.damageTypes` | Types that fit world theme |
| `combatSettings.damageTypePresentation` | Required (use `{}` for none). Keyed by damage type, each entry `{ emoji }` sets the emoji shown for that damage type in the UI. Emoji characters only, no text |
| `otherSettings.visualNovelModeByDefault` | Optional. `true`/`false` sets visual novel mode once when a player first enters the game. Leave unset to let each player's own device preference decide |
| `characterCreationMusic` | Optional top-level field. `"fantasy"` or `"nonfantasy"` background music for the character-creation screen. Defaults to `"fantasy"` |
| `imageModelSource` | Optional top-level field. Pins which platform-provided image model renders all generated images (portraits, location/area images, region maps) while editing the world; games created from it start with this as their default but can pick their own. One of `falai-gpt-image-2-low`, `falai-gpt-image-2`, `google-nano-banana-lite`, `google-nano-banana-pro`, `falai-flux-2-dev`. Omit to use the platform's current default |
| `worldVoices` | Optional top-level field. Catalog of reusable voice presets (see worldVoices below) that NPCs and premade characters reference by `worldVoiceId` |

## worldVoices

Optional record of voice presets keyed by an id you choose. Each preset pairs a display `label` with one of the character voice tags (`voiceTag`), plus optional delivery `instructions`, a `speed`, and audio `effects`. NPCs and premade characters point at a preset with `worldVoiceId`; the id must exist in `worldVoices`. Set `exposeInCharacterCreation: true` on presets players may pick for their own character at character creation; presets without it can still be assigned to NPCs and premades.

`effects` is a partial object of sub-effects (`pitch`, `reverb`, `echo`, `eq`, `distortion`, `output`), each with an `enabled` flag plus its own parameters. Omit any sub-effect you do not use. The engine trims labels and tags and clamps out-of-range values (speed to 0.5-2, pitch to -12..12 semitones, mixes to 0-1, and so on), and the catalog size is capped, so keep the list to voices the world actually uses.

## lowAttributeTraits Format

Each entry follows this structure: **"You have a weak [domain]. [What skill types this affects]. [Effect on learning and usage]."**

- Sentence 1: State the weakness plainly ("You have a weak X")
- Sentence 2: Name the skill types powered by this attribute and state the consequence
- Sentence 3: Describe the practical effect on learning and reliability
- Reference skill/ability type names, not individual skill names
- Not every attribute needs an entry; omit attributes where a low value doesn't make narrative sense

## Schema

```typescript
interface Settings {
  attributeSettings: AttributeSettings
  skillSettings: SkillSettings
  locationSettings: LocationSettings
  itemSettings: ItemSettings
  combatSettings: CombatSettings
  otherSettings: OtherSettings
  progressionSettings: ProgressionSettings
  characterCreationMusic?: 'fantasy' | 'nonfantasy'
  imageModelSource?: 'falai-gpt-image-2-low' | 'falai-gpt-image-2' | 'google-nano-banana-lite' | 'google-nano-banana-pro' | 'falai-flux-2-dev'
  worldVoices?: Record<string, WorldVoice>
}

interface OtherSettings {
  npcHealthPerLevel: number
  npcMinHealth: number
  visualNovelModeByDefault?: boolean
}

interface WorldVoice {
  label: string
  voiceTag: string
  instructions?: string
  speed?: number
  effects?: {
    pitch?: { enabled: boolean, semitones: number }
    reverb?: { enabled: boolean, space: 'room' | 'hall' | 'cavern', mix: number }
    echo?: { enabled: boolean, delayMs: number, feedback: number, mix: number }
    eq?: {
      enabled: boolean
      highPass: { enabled: boolean, frequency: number }
      lowShelf: { enabled: boolean, frequency: number, gainDb: number }
      bell1: { enabled: boolean, frequency: number, gainDb: number, q: number }
      bell2: { enabled: boolean, frequency: number, gainDb: number, q: number }
      highShelf: { enabled: boolean, frequency: number, gainDb: number }
      lowPass: { enabled: boolean, frequency: number }
    }
    distortion?: { enabled: boolean, drive: number }
    output?: { enabled: boolean, gainDb: number, compressor: boolean }
  }
  exposeInCharacterCreation?: boolean
}
```

## Reference

For detailed documentation, see [settings-reference.md](references/settings-reference.md).
