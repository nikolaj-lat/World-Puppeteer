---
name: skills
description: Schema and rules for creating skills
context: fork
agent: skills
---

# Skills

Edit `tabs/skills.json`.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `attribute` | Must reference a valid attribute from attributeSettings |
| `type` | Skill category - must match a key in `skillTypeDifficultyBonus` from settings |
| `description` | 3 sentences explaining what the skill does |
| `startingItems`| Always set to `[]` |

## Never Include

Omit these fields:
- `level`, `xp`, `xpToNextLevel`

## description Format

Skill descriptions should be **3 sentences, effect-focused**.

1. **No em dashes** — use periods, commas, and semicolons instead
2. **No translation labels** — avoid opening with bare translations
3. **Weave name meanings into prose** — fold the meaning into full sentences
4. **Focus on mechanical effects** — what it does, how it works, what happens when used
5. **Avoid species-specific details** — skills are shared, descriptions should be generic

## type Categories

Skill types are defined per-world in `skillTypeDifficultyBonus` in `tabs/settings.json`. Each type can grant different difficulty bonuses to skill checks.

`"none": 0` is the default type. Other types are world-specific.

## attribute Selection

Attributes are defined per-world in `attributeSettings.attributeNames` in `tabs/settings.json`. Choose the attribute that governs this skill.

The attribute affects:
- Skill check bonuses: `(attributeValue - base) * attributeBonusModifier`
- Chance to learn: `baseChanceToLearnNewSkill + (attributeValue * skillLearningBonusModifier)`

## Schema

```typescript
interface SkillType {
  name: string
  attribute: string
  type: string
  description: string
  startingItems: InventoryDefinition[]
}

interface InventoryDefinition {
  item: string
  quantity: number
}
```

## Reference

For detailed documentation, see [skills-reference.md](references/skills-reference.md).
