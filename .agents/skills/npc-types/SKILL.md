---
name: npc-types
description: Schema and rules for creating NPC types
context: fork
agent: npc-types
---

# NPC Types

Edit `tabs/npc-types.json`.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `description` | A paragraph describing this type and their typical physical features and personality|
| `vulnerabilities` | Array of damage types (use `[]` if none) |
| `resistances` | Array of damage types (use `[]` if none) |
| `immunities` | Array of damage types (use `[]` if none) |

## When to Create Types

**Create an NPC type when:**
- Multiple NPCs share the same damage profile (vulnerabilities/resistances/immunities)
- The type represents a species, creature category, or profession

## Damage Type Inheritance

When an NPC has `type: "goblin"`, it looks up `npcTypes.goblin` for damage interactions:

- NPC's vulnerabilities = union of type's vulnerabilities + NPC's vulnerabilities
- NPC's resistances = union of type's resistances + NPC's resistances
- NPC's immunities = union of type's immunities + NPC's immunities

This means types provide baseline damage profiles that individual NPCs can extend.

## description Format

A paragraph describing this type and their typical physical features and personality. Keep descriptions focused on what the type IS, not specific individuals.

## Damage Type Reference

Use damage types from `combatSettings.damageTypes` in settings.

## Schema

```typescript
interface NPCType {
  name: string              // Must match object key
  description: string       // What this type is
  vulnerabilities: string[] // 1.5x damage from these types
  resistances: string[]     // 0.5x damage from these types
  immunities: string[]      // 0x damage from these types
}
```

## Species NPC Types

When creating an NPC type that represents a **species** (playable race or sentient creature type), you must also create corresponding Trait and World Lore entries. The `description` contains lore paragraphs + skill blocks separated by `\n`. The lore paragraphs are shared identically with the Trait `description` and Trait `quirk`; the skill block format differs per field.

See [Species Consistency Rules](../species-rules.md) for the full requirements.

## Reference

For detailed documentation, see [npc-types-reference.md](references/npc-types-reference.md).
