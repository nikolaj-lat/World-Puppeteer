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


Category selection at character creation ignores `requirements`, `unlockedBy`, and `excludedBy` — those only affect level-up trait picks (see below).

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `description` | What the trait is — shown to players at character creation (full paragraph) |
| `traitNarrativeEffects` | The narrator's reference for portraying the trait. Usually the same as `description`; elaborate further or add hidden aspects the player shouldn't see |
| `attributes` | Array of attribute modifiers (can be empty `[]`) |
| `skills` | Array of skill modifiers (can be empty `[]`) |
| `resources` | Array of resource modifiers (can be empty `[]`) |
| `startingItems` | Array of items granted (can be empty `[]`) |
| `abilities` | Array of ability names granted (can be empty `[]`) |
| `requirements` | Array of requirement objects (can be empty `[]`). Only gates level-up trait picks — ignored at character creation |
| `unlockedBy` | Trait prerequisites (OR logic). Only affects level-up trait picks — ignored at character creation |
| `excludedBy` | Trait conflicts. Only affects level-up trait picks — ignored at character creation |

## description and traitNarrativeEffects

For **non-species traits**:
- By default, `description` and `traitNarrativeEffects` carry the **same content** — write both as full paragraphs.
- `description` is shown to players at character creation. `traitNarrativeEffects` is the narrator's reference during play.
- Let them **diverge** only when: (a) the narrative effects hold hidden aspects the player shouldn't know, or (b) the description is a shorter summary and `traitNarrativeEffects` is the elaborated, fuller version.

Older configs used a field named `quirk` for this; it is auto-migrated to `traitNarrativeEffects` verbatim. Always write `traitNarrativeEffects` in new configs.

For **species traits**, see the Species Traits section below.

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `attributes` (non-empty) | Class/background traits that affect core stats |
| `skills` (non-empty) | Traits that grant expertise or training |
| `resources` (non-empty) | Traits that affect resource pools |
| `startingItems` (non-empty) | Class/background traits with signature equipment 
| `abilities` (non-empty) | Traits that unlock special perks or powers |
| `requirements` (non-empty) | Traits in the level-up pool that should be gated behind stats, skills, other traits, or character level |
| `vulnerabilities` / `resistances` / `immunities` | Traits that should change how much typed damage the player takes in combat (e.g. a fire-elemental species immune to fire). Values must match `combatSettings.damageTypes` |

## Level-Up Trait Picks

Traits can be offered as level-up rewards via `progressionSettings.levelUpTraitPool` in `tabs/settings.json` (default cadence: 1 pick every 10 levels). When a pick is pending, the player chooses from pool traits they don't already have whose `unlockedBy`/`excludedBy` conditions pass and whose `requirements` are met; the chosen trait applies immediately, exactly like a starting trait. An empty pool means no picks are ever granted.

**Gotcha:** `requirements`, `unlockedBy`, and `excludedBy` do nothing at character creation — they only filter the level-up pick list. To keep a trait out of starting selection, leave it out of every trait category.

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

## requirements Format

Array of prerequisite checks. All must be met for the trait to appear as a level-up pick. Same format as ability requirements.

```typescript
{ type: 'skill', variable: 'skill name', amount: 3 }      // Skill level >= 3
{ type: 'attribute', variable: 'strength', amount: 14 }   // Attribute value >= 14
{ type: 'characterLevel', amount: 5 }                     // Character level >= 5 (no variable)
{ type: 'resource', variable: 'mana', amount: 50 }        // Resource max >= 50
{ type: 'trait', variable: 'fire affinity', amount: 1 }   // Has trait (amount ignored)
```

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
  traitNarrativeEffects: string
  attributes: Array<{attribute: string, modifier: number}>
  skills: Array<{skill: string, modifier: number}>
  resources: Array<{resource: string, modifier: number}>
  startingItems: Array<{item: string, quantity: number}>
  abilities: string[]
  requirements: TraitRequirement[]
  unlockedBy: string[]
  excludedBy: string[]
  vulnerabilities?: string[]
  resistances?: string[]
  immunities?: string[]
}

type TraitRequirement =
  | { type: 'resource' | 'attribute' | 'skill' | 'trait'; variable: string; amount: number }
  | { type: 'characterLevel'; amount: number }
```

## Species Traits

When creating a trait that represents a **species** (playable race):

1. Must have corresponding NPC Type and World Lore entries
2. The `description` contains lore paragraphs + skill blocks separated by `\n\n`
3. The `traitNarrativeEffects` contains lore paragraphs only (no skills)
4. Lore paragraphs are identical across NPC Type `description`, Trait `description`, and Trait `traitNarrativeEffects`
5. Must include exactly **3 skills** that work as both player skills AND NPC abilities
6. Skills should reflect innate species abilities or cultural training

See [Species Consistency Rules](../species-rules.md) for the full requirements.

## Reference

For detailed documentation, see [traits-reference.md](references/traits-reference.md).
