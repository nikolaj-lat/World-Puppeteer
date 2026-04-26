---
name: abilities
description: Schema and rules for creating abilities
context: fork
agent: abilities
---

# Abilities

Edit `tabs/abilities.json`.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `description` | 2-3 sentences covering what the ability does and adding character flavor |
| `requirements` | At least one requirement to unlock the ability |
| `bonus` | Equal to the skill level required to unlock it |
| `cooldown` | Always `0` unless ability would be game-breaking without a limit |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| Multiple `requirements` | When ability needs multiple prerequisites (skill + level, attribute + trait) |
| Non-zero `cooldown` | Only for abilities that would break the game if spammed |

## Never Include

Omit these fields (auto-set at runtime):
- `lastUsedTick`

## requirements Format

Array of prerequisite checks. All must be met to unlock the ability.

```typescript
{ type: 'skill', variable: 'skill name', amount: 3 }      // Skill level >= 3
{ type: 'attribute', variable: 'strength', amount: 14 }   // Attribute value >= 14
{ type: 'characterLevel', variable: '', amount: 5 }       // Character level >= 5
{ type: 'resource', variable: 'mana', amount: 50 }        // Resource max >= 50
{ type: 'trait', variable: 'fire affinity', amount: 1 }   // Has trait (amount ignored)
```

## bonus Guidelines

Set `bonus` equal to the skill level requirement. If the ability requires skill level 5, set `bonus: 5`.

## cooldown Guidelines

Default to `0` - abilities should be freely usable. Only add cooldown for abilities that would trivialize gameplay if spammed repeatedly.

**Rare exceptions that might warrant cooldown:**
- Instant full health restore
- Guaranteed escape/teleport
- Auto-win combat effects

Most abilities should have `cooldown: 0`.

## Ability Design Rules

Each ability must be a **unique tool** — a distinct capability that no other ability replicates.

- **No scaling duplicates.** Never create a weaker version of a later ability (e.g., "minor ward" at Lv 3 and "greater ward" at Lv 8). Each ability must do something no other ability in the tree does.
- **Permanent utility.** A Lv 0 ability must remain useful at max level. If a higher-level ability makes a lower one obsolete, one of them is badly designed.
- **Scoped, not vague.** Each ability should have a specific, concrete function — not a broad category. Multiple use cases within that function are fine, but the function itself must be unique.
- **No quantity escalation.** "Summon one servant" → "summon seven servants" → "summon an army" is three abilities doing the same thing at different scales. Each should enable a fundamentally different action.

## Schema

```typescript
interface AbilityDefinition {
  name: string
  description: string
  requirements: AbilityRequirement[]
  bonus: number
  cooldown: number
}

interface AbilityRequirement {
  type: 'resource' | 'attribute' | 'skill' | 'characterLevel' | 'trait'
  variable: string
  amount: number
}
```

## Reference

For detailed documentation, see [abilities-reference.md](references/abilities-reference.md).
