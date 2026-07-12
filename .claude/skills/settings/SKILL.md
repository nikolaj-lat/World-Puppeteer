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
| `regionSize` | `100` | 100km regions |
| `simpleRadius` | `5` | 5km simple interaction radius |
| `complexRadius` | `10` | 10km complex interaction radius |
| `avgTravelDistance` | `40` | 40km average between locations |
| `minTravelDistance` | `20` | 20km minimum between locations |
| `regionLocationCount` | `0` | Designer defines per world |
| `regionFactionCount` | `0` | Designer defines per world |
| `encountersEnabled` | `false` | Enable random wilderness encounters during travel |
| `regionMapBorderFeatheringEnabled` | `true` | Feathered border / rounded frame treatment on region map images |

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
| `characterCreationMusic` | Optional top-level field. `"fantasy"` or `"nonfantasy"` background music for the character-creation screen. Defaults to `"fantasy"` |
| `imageModelSources` | Optional top-level field. Pins which platform-provided image model renders NPC portraits (`portrait`), location/area images (`location`), and region maps (`region`) for the world and its games. Omit fields to use the platform's current defaults |

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
  imageModelSources?: { portrait?: string, location?: string, region?: string }
}
```

## Reference

For detailed documentation, see [settings-reference.md](references/settings-reference.md).
