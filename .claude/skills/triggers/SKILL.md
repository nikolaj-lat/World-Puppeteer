---
name: triggers
description: Schema and rules for creating triggers
context: fork
agent: triggers
---

# Triggers

Edit `tabs/triggers.json`.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `conditions` | Array of TriggerCondition objects (see format below) |
| `effects` | Array of TriggerEffect objects (see format below) |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `recurring` | Set to `true` only when trigger should fire every turn conditions are met |
| `script` | Only when declarative conditions/effects can't express the logic (branching, derived math, cross-trigger coordination). See [trigger-scripts-reference.md](references/trigger-scripts-reference.md) |

## Never Include

Omit these fields (auto-set or unused):
- `embeddingId` (auto-generated for semantic conditions)

## TriggerCondition Format

All conditions in a trigger must pass for effects to fire.

### Semantic Conditions (AI-Evaluated)

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `story` | Query matches recent story narrative | `query` |
| `action` | Query matches player's current action | `query` |

Format: `{ type: 'story' | 'action', query: 'natural language description' }`

### Mechanical Conditions (Code-Evaluated)

**String conditions** (`party-realm`, `party-region`, `party-location`, `party-area`, `story-text`, `action-text`):
```typescript
{ type: '...', operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'regex', value: 'string' }
```

**Number conditions** (`player-level`, `game-tick`, `player-resource`):
```typescript
{ type: '...', operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual', value: number }
// For player-resource, also include: resource: 'resourceName'
```

**Boolean conditions** (`known-entity`):
```typescript
{ type: 'known-entity', operator: 'equals' | 'notEquals', value: boolean, entity: 'entityName' }
```

**Array conditions** (`player-traits`, `quests-completed`):
```typescript
{ type: '...', operator: 'contains' | 'notContains', value: 'string' }
```

**Read conditions** (`read-string`, `read-number`, `read-boolean`, `read-array`):
```typescript
{ type: '...', key: 'triggerWritableKey', operator: '...', value: '...' }
```

## TriggerEffect Format

### Story Effect

```typescript
{ type: 'story', instruction: 'Text injected into story generation' }
```

### Quest Effects

```typescript
{ type: 'quest-progress', questId: 'questKey' }  // Marks objective complete
{ type: 'quest-init', operator: 'set', value: 'Quest Name' }  // Makes quest available
```

### Location Effects

```typescript
{ type: 'party-realm' | 'party-region' | 'party-location' | 'party-area', operator: 'set', value: 'name' }
```

### Resource Effects

```typescript
{ type: 'player-resource', resource: 'resourceName', operator: 'set' | 'add' | 'subtract' | 'multiply' | 'divide', value: number }
```

### Entity Knowledge Effects

```typescript
{ type: 'known-entity', entity: 'entityName', operator: 'set' | 'toggle', value?: boolean }
```

### Trait Effects

```typescript
{ type: 'player-traits', operator: 'set' | 'add' | 'remove', value: 'traitName' | ['trait1', 'trait2'] }
```

### Write Effects (to triggerWritable)

```typescript
{ type: 'write-string' | 'write-number' | 'write-boolean' | 'write-array', key: 'keyName', operator: '...', value: '...' }
```

## Phase Partitioning

Triggers evaluate in exactly one phase based on conditions:

| Has `action` or `action-text` condition? | Phase |
|------------------------------------------|-------|
| Yes | Planning (before story) |
| No | State (after story) |

## Important Gotchas

- **Turn 0**: `story` effects on tick 0 do NOT affect initial story. Use `storyStart` text or tick 1+ triggers
- **Recurring**: Without `recurring: true`, triggers fire only once ever

## Schema

```typescript
interface Trigger {
  name: string
  conditions: TriggerCondition[]
  effects: TriggerEffect[]
  recurring?: boolean
}
```

## Reference

For detailed documentation, see [triggers-reference.md](references/triggers-reference.md).
