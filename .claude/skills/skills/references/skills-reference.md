# Skills Reference

Complete documentation for `tabs/skills.json`.

## Schema

```typescript
interface SkillType {
  name: string                      // ✅ Display name, must match object key
  attribute: string                 // ✅ Key from attributeSettings.attributeNames
  type: string                      // ✅ Key from skillTypeDifficultyBonus in settings
  description: string               // ✅ Explanation of the skill
  startingItems?: InventoryDefinition[]  // ✅ Items granted when skill is learned
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

Based on how much the roll exceeds the target:

| Result | Condition |
|--------|-----------|
| Critical Success | Exceeds by large margin |
| Success | Meets or exceeds target |
| Partial Success | Just below target |
| Failure | Below target |
| Critical Failure | Below by large margin |

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

## Type Difficulty Bonuses

Skill types are defined per-world in `skillTypeDifficultyBonus`. Each type can grant different difficulty bonuses to skill checks.

```typescript
skillTypeDifficultyBonus: {
  "none": 0,  // Always include
  // Other types are world-specific
}
```

These values are added to all checks of that skill type.

## Cross-References

| Field | References |
|-------|------------|
| `attribute` | `attributeSettings.attributeNames` in `tabs/settings.json` |
| `startingItems[].item` | `tabs/items.json` |
| `type` | `skillSettings.skillTypeDifficultyBonus` keys in `tabs/settings.json` |
