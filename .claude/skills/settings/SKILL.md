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

### Item Settings

| Field | Balanced Value | Notes |
|-------|----------------|-------|
| `startingItems` | `[]` | Starting items come from traits |

### Combat Settings

| Field | Balanced Value | Notes |
|-------|----------------|-------|
| `baseCombatXP` | `200` | Combat is rewarding |
| `minCombatXP` | `50` | Trivial fights still meaningful |
| `abilityCooldown` | `0` | No cooldowns |
| `abilityBonus` | `10` | Abilities give +10 to checks |
| `npcDailyHealingAmount` | `999` | NPCs fully heal daily |

### Character Progression (otherSettings)

| Field | Balanced Value | Notes |
|-------|----------------|-------|
| `startingCharacterLevelUpRequirement` | `500` | Base XP for first level |
| `extraRequiredXPPerCharacterLevel` | `100` | +100 XP per level |
| `maxCharacterLevel` | `999` | Effectively uncapped |
| `npcHealthPerLevel` | `10` | NPC HP per level |
| `npcMinHealth` | `0` | NPC base HP |

> Player HP scaling lives on the health resource (`resourceSettings.health.maxValue` and `gainPerLevel`), not in `otherSettings`. See the ai-instructions skill for the Resource schema.

## World-Specific Fields

These must be configured per-world:

| Field | Guidance |
|-------|----------|
| `attributeSettings.attributeNames` | Thematic attribute names for the world |
| `attributeSettings.lowAttributeTraits` | See lowAttributeTraits format below |
| `attributeSettings.attributeStatModifiers` | Only where narratively sensible (e.g., Constitution to Health) |
| `skillSettings.skillTypeDifficultyBonus` | Always include `"none": 0`, others creative |
| `itemSettings.currencyName` | Thematic currency name |
| `itemSettings.itemCategories` | Always include `"Armor"`, `"Consumable"`, plus world-specific |
| `itemSettings.itemSlots` | Always include 7 armor slots, plus world-specific |
| `combatSettings.damageTypes` | Types that fit world theme |

## lowAttributeTraits Format

Each entry follows this structure: **"You have a weak [domain]. [What skill types this affects]. [Effect on learning and usage]."**

- Sentence 1: State the weakness plainly ("You have a weak X")
- Sentence 2: Name the skill types powered by this attribute and state the consequence
- Sentence 3: Describe the practical effect on learning and reliability
- Reference skill/ability type names, not individual skill names
- Not every attribute needs an entry; omit attributes where a low value doesn't make narrative sense

## Required Item Slots

Always include these 7 armor slots:

```json
[
  { "slot": "head", "category": "Armor", "quantity": 1 },
  { "slot": "chest", "category": "Armor", "quantity": 1 },
  { "slot": "shoulders", "category": "Armor", "quantity": 1 },
  { "slot": "hands", "category": "Armor", "quantity": 1 },
  { "slot": "waist", "category": "Armor", "quantity": 1 },
  { "slot": "legs", "category": "Armor", "quantity": 1 },
  { "slot": "feet", "category": "Armor", "quantity": 1 }
]
```

Additional slots are world-specific.

## Schema

```typescript
interface Settings {
  attributeSettings: AttributeSettings
  skillSettings: SkillSettings
  locationSettings: LocationSettings
  itemSettings: ItemSettings
  combatSettings: CombatSettings
  otherSettings: OtherSettings
}
```

## Reference

For detailed documentation, see [settings-reference.md](references/settings-reference.md).
