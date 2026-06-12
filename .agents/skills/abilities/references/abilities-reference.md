# Abilities Reference

Complete documentation for `tabs/abilities.json`.

## Schema

```typescript
interface AbilityDefinition {
  name: string                       // ✅ Display name, must match object key
  description: string                // ✅ What the ability does
  requirements: AbilityRequirement[] // ✅ Prerequisites to unlock
  bonus: number                      // ✅ Power bonus when used in actions
  cooldown: number                   // ✅ Turns between uses
}
```

Ability names are matched against player input case-insensitively (whitespace is also normalized), so "Fireball", "fireball", and "FIREBALL" in player input all detect an ability named `Fireball`. Pick whichever capitalization reads best for your world.

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread
- ⚠️ **Calculated default**: Has fallback logic if not predefined
- ❌ **Always overwritten**: Set by initialization regardless of what exists in config

## AbilityRequirement Schema

A requirement is one of two shapes. Most types name a target via `variable`; `characterLevel` has no target, so it omits `variable` entirely.

```typescript
// resource | attribute | skill | trait
interface ReferencedAbilityRequirement {
  type: 'resource' | 'attribute' | 'skill' | 'trait'  // What to check
  variable: string                // Name of the requirement target
  amount: number                  // Required value (ignored for trait type)
}

// characterLevel — no variable
interface CharacterLevelAbilityRequirement {
  type: 'characterLevel'
  amount: number                  // Required character level
}
```

| Type | Shape | Checks | Example |
|------|-------|--------|---------|
| `resource` | with `variable` | Resource max >= amount | `{ type: "resource", variable: "mana", amount: 50 }` |
| `attribute` | with `variable` | Attribute value >= amount | `{ type: "attribute", variable: "strength", amount: 14 }` |
| `skill` | with `variable` | Skill level >= amount | `{ type: "skill", variable: "melee", amount: 3 }` |
| `trait` | with `variable` | Has trait with that name | `{ type: "trait", variable: "fire affinity", amount: 1 }` |
| `characterLevel` | no `variable` | Character level >= amount | `{ type: "characterLevel", amount: 5 }` |

## Runtime State

When a character unlocks an ability, it becomes an `Ability` with additional runtime fields:

```typescript
interface Ability extends AbilityDefinition {
  lastUsedTick: number            // ❌ Always set to -1 on creation
}
```

Characters track:
- `unlockedAbilities`: Abilities they've unlocked
- `availableCustomAbilities`: AI-generated abilities available to unlock
- `freeAbilityPoints`: Unspent ability points

## Bonus Mechanics

When an ability is used in an action, the `bonus` value is added to the relevant check.

Formula: `effectiveBonus = bonus × combatSettings.abilityBonus`

The `abilityBonus` setting (default 1.0) allows global scaling of ability power.

## Cooldown Mechanics

After using an ability:
1. `lastUsedTick` is set to current tick
2. Ability unavailable for `cooldown` turns
3. Cooldown can be modified by `combatSettings.abilityCooldown` setting

Formula: `effectiveCooldown = cooldown × combatSettings.abilityCooldown`

## Unlocking Abilities

Players can unlock predefined abilities through:

1. **Spending ability points**: Meeting requirements + spending `freeAbilityPoints`
2. **Trait abilities**: Automatically granted by certain traits
3. **Gameplay learning**: `generateLearnedAbility` task creates custom abilities

## Cross-References

| Field | References |
|-------|------------|
| `requirements[].variable` (skill) | `tabs/skills.json` |
| `requirements[].variable` (attribute) | `attributeSettings.attributeNames` in `tabs/settings.json` |
| `requirements[].variable` (resource) | `resourceSettings` keys in `tabs/settings.json` |
| `requirements[].variable` (trait) | `tabs/traits.json` |
