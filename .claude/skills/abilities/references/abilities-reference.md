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

```typescript
interface AbilityRequirement {
  type: 'resource' | 'attribute' | 'skill' | 'characterLevel' | 'trait'  // What to check
  variable: string                // Name of the requirement target
  amount: number                  // Required value (ignored for trait type)
}
```

| Type | Checks | Example |
|------|--------|---------|
| `resource` | Resource max >= amount | Mana pool of 50+ |
| `attribute` | Attribute value >= amount | Strength of 14+ |
| `skill` | Skill level >= amount | Melee weapons at level 3+ |
| `characterLevel` | Character level >= amount | Level 5+ |
| `trait` | Has trait with that name | Has "fire affinity" trait |

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
