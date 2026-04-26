# Traits Reference

Complete documentation for `tabs/traits.json`.

## Schema

```typescript
interface Trait {
  name: string                    // ✅ Display name, must match object key
  description: string             // ✅ Player-facing description shown during selection
  quirk: string                   // ✅ AI narrator's primary reference for trait effects
  attributes: Array<{attribute: string, modifier: number}>   // ✅ Additive attribute modifiers
  skills: Array<{skill: string, modifier: number}>           // ✅ Additive skill level modifiers
  resources: Array<{resource: string, modifier: number}>     // ✅ Additive resource max modifiers
  startingItems: InventoryDefinition[]                       // ✅ Items granted on trait application
  abilities: string[]             // ✅ Ability names unlocked (deduplicated if multiple sources)
  unlockedBy: string[]            // ✅ Trait prerequisites (OR logic) - NOT YET IMPLEMENTED IN UI
  excludedBy: string[]            // ✅ Trait conflicts - NOT YET IMPLEMENTED IN UI
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread

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
  quantity: number                // How many to grant
}
```

## TraitCategory Schema

```typescript
interface TraitCategory {
  name: string                    // ✅ Display name shown to player
  maxSelections: number           // ✅ Maximum traits player can select (0 = unlimited)
  traits: string[]                // ✅ Array of trait keys (not display names)
}
```

Categories group traits and limit selections during character creation. Players must select between 0 and `maxSelections` traits from each category.

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
| `unlockedBy[]` | Keys from `traits` in same file |
| `excludedBy[]` | Keys from `traits` in same file |
| `traitCategories[].traits[]` | Keys from `traits` in same file |
