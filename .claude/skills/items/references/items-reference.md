# Items Reference

Complete documentation for `tabs/items.json`.

## ItemDefinition Schema

```typescript
interface ItemDefinition {
  name: string                                 // ✅ Item name, must match object key
  category: string                             // ✅ Must be in itemSettings.itemCategories
  description: string                          // ✅ Flavor text describing the item
  bonuses: ItemBonus[]                         // ✅ Stat bonuses, can be empty []
  slot?: string                                // ✅ Equipment slot from itemSettings.itemSlots
  mediaContent?: string                        // ✅ Text content for readable items (books, scrolls)
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config

## ItemInstance Schema (Runtime)

When items are added to inventory, they become ItemInstance:

```typescript
interface ItemInstance {
  // === FROM DEFINITION ===
  name: string                    // ✅ From ItemDefinition.name
  category: string                // ⚠️ From ItemDefinition.category or 'other'
  description: string             // ⚠️ From ItemDefinition.description or ''
  bonuses: ItemBonus[]            // ⚠️ From ItemDefinition.bonuses or []
  slot?: string                   // ✅ From ItemDefinition.slot
  mediaContent?: string           // ✅ From ItemDefinition.mediaContent

  // === GENERATED AT CREATION ===
  uuid: string                    // ❌ Always generated (getHeroesUuid())
  quantity: number                // ❌ Always 1 initially, then modified

  // === CALCULATED ===
  equippedSlot?: string           // ⚠️ Set when equipped
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, copied to instance
- ⚠️ **Calculated default**: Has fallback logic if not predefined
- ❌ **Always overwritten**: Set by initialization regardless of what exists in config

Note: Items do NOT use the spread pattern. Fields are explicitly copied from definition to instance.

## ItemBonus Schema

```typescript
interface ItemBonus {
  type: 'resource' | 'stat' | 'attribute' | 'skill'  // Bonus category
  variable: string                                    // Target stat/attribute/skill/resource name
  value: number                                       // Modifier amount
}
```

Bonuses are applied when item is **equipped**, removed when unequipped.

| Type | Variable | Effect |
|------|----------|--------|
| `attribute` | attribute name | Adds to attribute value |
| `skill` | skill name | Adds to skill level |
| `resource` | resource name | Adds to resource max |
| `stat` | `defense` | Adds to armor/defense |
| `stat` | `damage` | Adds to damage |
| `stat` | other | General stat modifier |

## AI-Generated Items

When the AI generates items (loot, rewards, shop inventory), it uses explicit add/remove/equip/unequip operations. The AI determines item bonuses based on narrative context, enemy difficulty, and progression.

**Key difference**: Predefined items are fully authored — their bonuses are exactly as specified. AI-generated items are constrained by the AI's judgment of what fits the current situation.

## Equipment Slots

Slots are defined in `itemSettings.itemSlots`:

```typescript
interface ItemSlot {
  slot: string       // Slot identifier
  category: string   // Item category that can equip here
  quantity: number   // How many items can equip to this slot
}
```

When equipping:
1. Check if slot is valid for item's `slot` and `category`
2. If slot is full, first item is unequipped
3. Bonuses applied on equip, removed on unequip

## Currency Stacking

Items matching `itemSettings.currencyName` stack based on name and category only, ignoring bonuses. Non-currency items must match all properties to stack.

## Starting Items

All characters receive `itemSettings.startingItems` plus:
- Items from selected traits
- Items from story start
- Items from learned skills

All are automatically equipped if possible.

## Cross-References

| Field | References |
|-------|------------|
| `category` | `itemSettings.itemCategories` in `tabs/settings.json` |
| `slot` | `itemSettings.itemSlots` in `tabs/settings.json` |
| `bonuses.variable` (attribute) | `attributeSettings.attributeNames` in `tabs/settings.json` |
| `bonuses.variable` (skill) | `tabs/skills.json` keys |
| `bonuses.variable` (resource) | `resourceSettings.resources` in `tabs/settings.json` |
