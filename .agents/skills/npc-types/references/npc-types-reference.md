# NPC Types Reference

Complete documentation for `tabs/npc-types.json`.

## Schema

```typescript
interface NPCType {
  name: string              // ✅ Type name, must match object key
  description: string       // ✅ What this creature/character type is
  vulnerabilities: string[] // ✅ Damage types that deal 1.5x damage (can be empty [])
  resistances: string[]     // ✅ Damage types that deal 0.5x damage (can be empty [])
  immunities: string[]      // ✅ Damage types that deal 0x damage (can be empty [])
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread

## How Inheritance Works

When an NPC references a type via `type: "typeName"`, the game looks up `npcTypes.typeName` and merges damage profiles.

### Inheritance Rules

| Damage Category | Behavior |
|-----------------|----------|
| vulnerabilities | Union of type + NPC arrays |
| resistances | Union of type + NPC arrays |
| immunities | Union of type + NPC arrays |

NPCs with `type: ""` use only their own damage arrays (no inheritance).

## Damage Multipliers

| Category | Multiplier | Effect |
|----------|------------|--------|
| vulnerability | 1.5x | +50% damage taken |
| resistance | 0.5x | -50% damage taken |
| immunity | 0x | No damage taken |

Stacking: Static resistances and buff resistances multiply. 0.5x (static) x 0.5x (buff) = 0.25x (75% reduction).

## Type vs NPC Decision Matrix

| Scenario | Recommendation |
|----------|----------------|
| 5+ NPCs share exact damage profile | Create a type |
| Creature category with consistent traits | Create a type |
| One-off unique character | Use `type: ""` |
| Boss with custom resistances | Use `type: ""` or extend a type |
| Generic guards/soldiers | Create a type |

## Cross-References

| Field | References |
|-------|------------|
| `vulnerabilities`, `resistances`, `immunities` | `combatSettings.damageTypes` in `tabs/settings.json` |

## Used By

| Field | Location |
|-------|----------|
| `type` | `tabs/npcs.json` - NPCs reference types by key |
