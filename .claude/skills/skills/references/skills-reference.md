# Skills Reference

Complete documentation for `tabs/skills.json`.

## Schema

```typescript
interface SkillType {
  name: string                      // ✅ Display name, must match object key
  attribute: string                 // ✅ Key from attributeSettings.attributeNames
  type: string                      // ✅ Key from skillTypeDifficultyBonus in settings
  description: string               // ✅ Explanation of the skill
  startingItems: InventoryDefinition[]   // ✅ Items granted when skill is learned (required; use [] for none)
}

interface InventoryDefinition {
  item: string                      // Key from items.json
  quantity: number                  // Number to grant
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread

## Skill Checks

When a skill check occurs, the total is calculated as:

```
total = baseRoll
      + (skillLevel * skillBonusModifier)
      + ((attributeValue - base) * attributeBonusModifier)
      + skillTypeDifficultyBonus[skillType]
      + contextModifiers
```

Compare total to the difficulty target for success/failure.

### Success Levels

The score is adjusted down by 2 per 10 character levels and then placed on the world's success ladder (`successLevelSettings` in `tabs/settings.json`; see the settings reference). Each tier is a named score band. Tiers from the first successful tier upward are successes of increasing strength; tiers below it are failures. The stock ladder, lowest to highest: Critical Failure, Failure, Mixed Results, Basic Success, Success, Great Success, Critical Success.

## Skill XP

### Earning XP

Skills earn XP based on reward size (configured in `skillXPRewards`):

| Size | XP Reward |
|------|-----------|
| small | 50 |
| medium | 100 |
| large | 150 |
| huge | 200 |

### Level Up Formula

```
xpToNextLevel = startingXPToLevelUpSkill + (currentLevel * additionalXPRequiredPerSkillLevel)
```

With balanced settings (`startingXPToLevelUpSkill: 50`, `additionalXPRequiredPerSkillLevel: 50`):

| Current Level | XP to Next Level |
|---------------|------------------|
| 0 | 50 |
| 1 | 100 |
| 2 | 150 |
| 3 | 200 |
| ... | ... |

Maximum skill level is controlled by `maxSkillLevel` (default: 999).

## Learning New Skills

When using a skill you don't have:

```
chanceToLearn = baseChanceToLearnNewSkill + (attributeValue * skillLearningBonusModifier)
```

If successful:
- Skill added at level 0
- Character gains `xpFromNewSkill` (200) XP
- `startingItems` from skill definition added to inventory

Note: Use `baseChanceToLearnNewSkill: 1` and `skillLearningBonusModifier: 1` if the world allows learning new skills, or `0` for both if skills are fixed at creation.

## Training

Players can train skills between uses:
- Cooldown: `trainingCooldown` (10) ticks between sessions
- Training improves skill XP directly

## Triggers and Skills

Trigger conditions can test a character's skill level (the `skill-value` condition), and trigger effects can set or shift it (the `player-skill` effect, which resets the skill's in-progress XP and only updates skills the character already has). Full semantics live in the triggers reference.

## Type Difficulty Bonuses

Skill types are defined per-world in `skillTypeDifficultyBonus`. Each type can grant different difficulty bonuses to skill checks.

```typescript
skillTypeDifficultyBonus: {
  "none": 0,  // Always include
  // Other types are world-specific
}
```

These values are added to all checks of that skill type.

### The `combat` type

The type value `"combat"` is special: when a character attacks using a skill whose `type` is exactly `"combat"`, the attack gains a flat damage bonus based on that skill's linked `attribute` — `+1 damage per 2 attribute points above 6` (e.g. an attribute of 14 adds +4). Skills of any other type do not add this bonus. Give an attack skill `type: "combat"` if you want it to scale damage with its attribute.

## Cross-References

| Field | References |
|-------|------------|
| `attribute` | `attributeSettings.attributeNames` in `tabs/settings.json` |
| `startingItems[].item` | `tabs/items.json` |
| `type` | `skillSettings.skillTypeDifficultyBonus` keys in `tabs/settings.json` |
