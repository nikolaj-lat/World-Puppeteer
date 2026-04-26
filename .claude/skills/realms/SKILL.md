---
name: realms
description: Schema and rules for creating realms
context: fork
agent: realms
---

# Realms

Edit `tabs/realms.json`.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `basicInfo` | One paragraph describing the realm's nature and atmosphere |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `known` | Set to `false` to hide from map at game start. Omit or set `true` for visible by default |

## Realm Access

Players can only access locations in **known** realms. At runtime:
- Realms default to `known: true` unless the config explicitly sets `known: false`
- Use `known: false` for realms the player must discover through gameplay
- Revealing a realm doesn't reveal its regions or locations

## Schema

```typescript
interface Realm {
  name: string           // Display name, must match object key
  basicInfo: string      // One-paragraph description
  known?: boolean        // Defaults to true; set false to hide at game start
}
```

## Reference

For detailed documentation, see [realms-reference.md](references/realms-reference.md).
