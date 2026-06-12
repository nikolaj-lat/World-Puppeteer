---
name: items
description: Schema and rules for creating items
context: fork
agent: items
---

# Items

Edit `tabs/items.json`.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `category` | Must be in itemSettings.itemCategories (armor, consumable, etc.) |
| `description` | Brief flavor text describing the item's appearance and nature |
| `bonuses` | Array of bonuses - use `[]` if item is not equipable |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `slot` | Required for equippable items |
| `mediaContent` | Required for readable items - the text content to display |

## Never Include

Omit these fields (calculated at runtime):
- `uuid`, `quantity`, `equippedSlot`

## Item Types

### Consumables
- `category: "Consumable"`, no slot
- Always `bonuses: []`

### Currency
- `category: "Currency"`, no slot
- Must match `itemSettings.currencyName` for stacking
- Always `bonuses: []`

### Readable
- `category: "Readable"`, no slot
- Include `mediaContent` with the text to display
- Always `bonuses: []`

## bonuses Format

Array of stat modifications applied when item is equipped.

```typescript
{ type: "stat", variable: "damage", value: 5 }     // +50% damage
{ type: "stat", variable: "armor", value: 100 }    // 10% incoming damage reduction
{ type: "attribute", variable: "strength", value: 2 }  // +2 to attribute
{ type: "skill", variable: "stealth", value: 1 }   // +1 to skill
{ type: "resource", variable: "health", value: 10 }  // +10 max health
```

Format: `{ type: "stat" | "attribute" | "skill" | "resource", variable: string, value: number }`

For `type: "stat"`, only `damage` and `armor` are valid `variable` values. Armor reduces incoming damage by `value / 1000` (capped at 90%).

## Schema

```typescript
interface ItemDefinition {
  name: string
  category: string
  description: string
  bonuses: ItemBonus[]
  slot?: string
  mediaContent?: string
}

interface ItemBonus {
  type: 'resource' | 'stat' | 'attribute' | 'skill'
  variable: string
  value: number
}
```

## Reference

For detailed documentation, see [items-reference.md](references/items-reference.md).
