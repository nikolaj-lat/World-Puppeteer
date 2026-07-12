# Traits Reference

Complete documentation for `tabs/traits.json`.

## Schema

```typescript
interface Trait {
  name: string                    // ✅ Display name, must match object key
  description: string             // ✅ Player-facing description shown during selection
  traitNarrativeEffects: string   // ✅ AI narrator's primary reference for trait effects
  attributes: Array<{attribute: string, modifier: number}>   // ✅ Additive attribute modifiers
  skills: Array<{skill: string, modifier: number}>           // ✅ Additive skill level modifiers
  resources: Array<{resource: string, modifier: number}>     // ✅ Additive resource max modifiers
  startingItems: InventoryDefinition[]                       // ✅ Items granted on trait application
  abilities: string[]             // ✅ Ability names unlocked (deduplicated if multiple sources)
  requirements: TraitRequirement[] // ⚠️ Prerequisites for level-up trait picks (defaults to [] if omitted)
  unlockedBy: string[]            // ✅ Trait prerequisites (OR logic) — level-up picks only
  excludedBy: string[]            // ✅ Trait conflicts — level-up picks only
  vulnerabilities?: string[]      // ✅ Damage types that deal 1.5x damage to the player (can be empty [])
  resistances?: string[]          // ✅ Damage types that deal 0.5x damage to the player (can be empty [])
  immunities?: string[]           // ✅ Damage types that deal 0x damage to the player (can be empty [])
}
```

Configs written before the schema change may use `quirk` instead of `traitNarrativeEffects`; the value is migrated verbatim. Write new configs with `traitNarrativeEffects`.

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread
- ⚠️ **Calculated default**: Has fallback logic if not predefined

## TraitModifier Schema

```typescript
interface AttributeModifier {
  attribute: string               // Key from attributeSettings.attributes
  modifier: number                // Additive value (positive or negative)
}

interface SkillModifier {
  skill: string                   // Key from skills.json
  modifier: number                // Additive value to skill level
}

interface ResourceModifier {
  resource: string                // Key from resourceSettings.resources
  modifier: number                // Additive value to resource max
}
```

All modifiers are additive and stack across multiple traits:
```
character.attributes[attribute] += modifier
character.skills[skill].level += modifier
character.characterResources[resource].max += modifier
```

## InventoryDefinition Schema

```typescript
interface InventoryDefinition {
  item: string                    // Key from items.json
  quantity: number                // How many to grant. A negative quantity removes that many of the item from the character instead (useful for traits/backgrounds that take away default gear). 0 is a no-op
}
```

## TraitRequirement Schema

Same format as ability requirements. A requirement is one of two shapes. Most types name a target via `variable`; `characterLevel` has no target, so it omits `variable` entirely.

```typescript
// resource | attribute | skill | trait
interface ReferencedTraitRequirement {
  type: 'resource' | 'attribute' | 'skill' | 'trait'  // What to check
  variable: string                // Name of the requirement target
  amount: number                  // Required value (ignored for trait type)
}

// characterLevel — no variable
interface CharacterLevelTraitRequirement {
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

**Requirements gate level-up trait picks only.** Starting trait selection at character creation ignores `requirements`, `unlockedBy`, and `excludedBy` entirely — a player can pick any trait its category offers, regardless of these fields. All three fields only shape which traits appear in the level-up pick list (see Level-Up Trait Picks below). If a trait must never be a starting option, keep it out of every `traitCategories` entry rather than relying on requirements.

## Damage Modifiers (vulnerabilities, resistances, immunities)

These fields give the **player character** typed-damage modifiers in combat, the same way `npcTypes` gives them to NPCs:

| Modifier | Multiplier | Effect |
|----------|------------|--------|
| vulnerability | 1.5x | +50% damage taken |
| resistance | 0.5x | -50% damage taken |
| immunity | 0x | No damage taken |

- The player's effective lists are the **union across all their traits** (starting traits, level-up picks, and trigger-applied traits alike).
- Stacking with buffs: a static vulnerability plus a matching vulnerability buff becomes 2x; a static resistance plus a matching resistance buff becomes 0.25x (75% reduction).
- Precedence when the same damage type appears in multiple lists: immunity beats vulnerability, and vulnerability beats resistance.
- Values must match entries in `combatSettings.damageTypes` in `tabs/settings.json`. Mismatched values produce validation warnings and have no combat effect.

## TraitCategory Schema

```typescript
interface TraitCategory {
  name: string                    // ✅ Display name shown to player
  maxSelections: number           // ✅ Maximum traits player can select (0 = unlimited)
  traits: string[]                // ✅ Array of trait keys (not display names)
}
```

Categories group traits and limit selections during character creation. Players must select between 0 and `maxSelections` traits from each category.


Category selection at character creation ignores `requirements`, `unlockedBy`, and `excludedBy` — those fields only affect level-up trait picks.

## Modifier Application Order

When traits are selected during character creation:

```
1. Attribute modifiers → applied to base attributes
        ↓
2. Resource initialization (uses modified attributes via attributeStatModifiers)
        ↓
3. Skill modifiers → applied to skill levels
        ↓
4. Resource modifiers → applied to resource max values
        ↓
5. Abilities → added to character (deduplicated)
        ↓
6. Starting items → queued for granting
```

**Why order matters:** Attribute modifiers apply BEFORE resources initialize. If a trait gives +2 STR and `attributeStatModifiers` grants +2 health per STR, the character gets +4 bonus health from the attribute boost.

## Trait Removal

When traits are removed dynamically (via triggers):
- Attribute modifiers subtracted
- Skill modifiers subtracted
- Resource modifiers subtracted (current may drop if above new max)
- Items NOT removed (remain in inventory)
- Abilities may be removed if no other source grants them

## Low Attribute Traits

`attributeSettings.lowAttributeTraits` can auto-apply traits when attributes drop too low:

```typescript
lowAttributeTraits: {
  "strength": "weak-bodied",
  "intelligence": "simple-minded"
}
```

If an attribute drops to/below `lowAttributeThreshold`, the corresponding trait is automatically applied.

## Level-Up Trait Picks

Traits can also be earned during play through level-up picks, configured in `progressionSettings` in `tabs/settings.json`:

- `progressionSettings.levelUpTraitPool` lists the trait names eligible as level-up rewards.
- A cadence setting controls how often picks are granted (default: 1 pick every 10 levels).

When a player has pending picks, the game lists every pool trait that:

1. The character doesn't already have
2. Passes its `unlockedBy` / `excludedBy` conditions
3. Meets all its `requirements`

The player picks one, and it applies immediately exactly like a starting trait — skill/attribute/resource modifiers, abilities, and starting items all take effect.

Notes:
- An empty `levelUpTraitPool` means no picks are ever granted, regardless of cadence.
- This is the ONLY place `requirements`, `unlockedBy`, and `excludedBy` matter — starting trait selection ignores all three.
- Level-up traits don't need to appear in any `traitCategories` entry; a trait can be pool-only (never a starting option) or both.

See the settings documentation for the full `progressionSettings` schema.

## Dynamic Trait Changes

Triggers can add/remove traits via `player-traits` effect:

```typescript
{
  type: 'player-traits',
  operator: 'add',
  value: 'cursed'
}
```

## Cross-References

| Field | References |
|-------|------------|
| `attributes[].attribute` | `attributeSettings.attributes` in `tabs/settings.json` |
| `skills[].skill` | `tabs/skills.json` |
| `resources[].resource` | `resourceSettings.resources` in `tabs/settings.json` |
| `startingItems[].item` | `tabs/items.json` |
| `abilities[]` | `tabs/abilities.json` |
| `requirements[].variable` (resource) | `resourceSettings.resources` in `tabs/settings.json` |
| `requirements[].variable` (attribute) | `attributeSettings.attributes` in `tabs/settings.json` |
| `requirements[].variable` (skill) | `tabs/skills.json` |
| `requirements[].variable` (trait) | Keys from `traits` in same file |
| `vulnerabilities[]`, `resistances[]`, `immunities[]` | `combatSettings.damageTypes` in `tabs/settings.json` |
| `unlockedBy[]` | Keys from `traits` in same file |
| `excludedBy[]` | Keys from `traits` in same file |
| `traitCategories[].traits[]` | Keys from `traits` in same file |
| `progressionSettings.levelUpTraitPool` (in `tabs/settings.json`) | Keys from `traits` in same file |
