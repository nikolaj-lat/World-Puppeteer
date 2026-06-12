---
name: traits
description: Schema and rules for creating traits
context: fork
agent: traits
---

# Traits

Edit `tabs/traits.json`.

## Trait Categories

Traits must be organized into categories in `tabs/traits.json` under `traitCategories`.

| Field | Description |
|-------|-------------|
| `name` | Display name for the category |
| `maxSelections` | How many traits player can pick (0 = unlimited) |
| `traits` | Array of trait keys in this category |

Category patterns:
- **Single selection** (class/background): `maxSelections: 1`
- **Single selection** (species): `maxSelections: 1`
- **Multiple selection** (miscellaneous): `maxSelections: 3`

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `description` | What this trait mechanically does (3 sentences, effect-focused) |
| `quirk` | The AI narrator's primary reference for this trait's effects |
| `attributes` | Array of attribute modifiers (can be empty `[]`) |
| `skills` | Array of skill modifiers (can be empty `[]`) |
| `resources` | Array of resource modifiers (can be empty `[]`) |
| `startingItems` | Array of items granted (can be empty `[]`) |
| `abilities` | Array of ability names granted (can be empty `[]`) |
| `unlockedBy` | Leave empty `[]` - NOT YET IMPLEMENTED IN UI |
| `excludedBy` | Leave empty `[]` - NOT YET IMPLEMENTED IN UI |

## description and quirk

For **non-species traits** (Perception, Attributes, Expertise):
- `description` and `quirk` must be **identical** (same text)
- 3 sentences, effect-focused
- Describes what the trait mechanically DOES, not personality flavor
- The `quirk` is the AI narrator's primary reference for mechanical effects during play

For **species traits**, see the Species Traits section below.

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `attributes` (non-empty) | Class/background traits that affect core stats |
| `skills` (non-empty) | Traits that grant expertise or training |
| `resources` (non-empty) | Traits that affect resource pools |
| `startingItems` (non-empty) | Class/background traits with signature equipment 
| `abilities` (non-empty) | Traits that unlock special perks or powers |

## TraitModifier Format

All modifiers use the same structure:

```typescript
{ attribute: string, modifier: number }  // For attributes
{ skill: string, modifier: number }      // For skills
{ resource: string, modifier: number }   // For resources
```

The `modifier` is an additive value (positive or negative). Multiple traits stack.

## Point Cost Guidelines

Traits should be balanced around a point budget. Use these guidelines:

| Modifier Type | Point Cost |
|---------------|-------------------|
| Attribute | 1 point |
| Skill at modifier 0 | 1 point |
| Resource per 10 | 1 point |
| Starting item | 1 point |
| Ability | 1 points |

Every trait within a single traitCategory should be roughly equal. 

**Target values:**
- The `isHealth` resource should be set at roughly 100.
- Attributes should be at an average of 12, ranging from 0-20.

## startingItems Format

```typescript
{ item: string, quantity: number }
```

The `item` must reference a valid item key from `tabs/items.json`.

## Schema

```typescript
interface TraitCategory {
  name: string
  maxSelections: number
  traits: string[]
}

interface Trait {
  name: string
  description: string
  quirk: string
  attributes: Array<{attribute: string, modifier: number}>
  skills: Array<{skill: string, modifier: number}>
  resources: Array<{resource: string, modifier: number}>
  startingItems: Array<{item: string, quantity: number}>
  abilities: string[]
  unlockedBy: string[]
  excludedBy: string[]
}
```

## Species Traits

When creating a trait that represents a **species** (playable race):

1. Must have corresponding NPC Type and World Lore entries
2. The `description` contains lore paragraphs + skill blocks separated by `\n\n`
3. The `quirk` contains lore paragraphs only (no skills)
4. Lore paragraphs are identical across NPC Type `description`, Trait `description`, and Trait `quirk`
5. Must include exactly **3 skills** that work as both player skills AND NPC abilities
6. Skills should reflect innate species abilities or cultural training

See [Species Consistency Rules](../species-rules.md) for the full requirements.

## Reference

For detailed documentation, see [traits-reference.md](references/traits-reference.md).
