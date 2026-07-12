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
| `scope` | Set to `'player'` only when effects should target the specific players who satisfy the conditions (multiplayer). Omit for normal party-wide triggers |
| `script` | Only when declarative conditions/effects can't express the logic (branching, derived math, cross-trigger coordination). See [trigger-scripts-reference.md](references/trigger-scripts-reference.md) |

**Trigger-script gotchas:** a `story` effect on **tick 0 does not change the opening** — put opening narration in the story-start text or fire at tick >= 1. Scripts go only in the top-level `script` field; never invent JS condition/effect types. Full details in the reference.

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

**Status conditions** (`quest-status`, `narrative-event-status`):
```typescript
{ type: 'quest-status', questId: 'questKey', operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'regex', value: 'string' }
// Quest statuses: hidden | available | expired | accepted | completed | abandoned | rejected
// questId resolves by quest key first, then by unique quest name

{ type: 'narrative-event-status', eventId: 'eventKey', operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'regex', value: 'string' }
// Event statuses: inactive | active | stopped | completed
```

## TriggerEffect Format

### Story Effect

```typescript
{ type: 'story', instruction: 'Text injected into story generation' }
```

### Quest Effects

```typescript
{ type: 'quest-progress', questId: 'questKey' }  // Marks main objective satisfied, shows a status line
{ type: 'quest-complete', questId: 'questKey' }  // Same, but silent — no player-visible status line
{ type: 'quest-init', operator: 'set', value: 'Quest Name' }  // Makes quest available
{ type: 'quest-objective-reveal', questId: 'questKey', objectiveId: 'objectiveKey' }  // Activates an authored objective, makes it the active objective
{ type: 'quest-objective-complete', questId: 'questKey', objectiveId: 'objectiveKey' }  // Completes the objective, advances next step
```

### Next-Step Effects

```typescript
{ type: 'quest-next-step-set', questId: 'questKey', text: 'guidance', source: 'objective' | 'narrative-event' }
{ type: 'quest-next-step-clear', questId: 'questKey' }
{ type: 'party-next-step-set', text: 'guidance', source: 'objective' | 'narrative-event' }  // Party-wide guidance shown when no quest is active
{ type: 'party-next-step-clear' }
```

### Narrative Event Effects

```typescript
{ type: 'narrative-event-start', eventId: 'eventKey' }  // Starts (or resumes) a narrative event; ignored if another event is active
```

### Location Effects

```typescript
{ type: 'party-realm' | 'party-region' | 'party-location' | 'party-area', operator: 'set', value: 'name' }
```

### Resource Effects

```typescript
{ type: 'player-resource', resource: 'resourceName', operator: 'set' | 'add' | 'subtract' | 'multiply' | 'divide', value: number }
// Optional: target: 'allPlayers' | 'satisfyingPlayers' — which players the effect applies to
```

### Entity Knowledge Effects

```typescript
{ type: 'known-entity', entity: 'entityName', operator: 'set' | 'toggle', value?: boolean }
```

### Trait Effects

```typescript
{ type: 'player-traits', operator: 'set' | 'add' | 'remove', value: 'traitName' | ['trait1', 'trait2'] }
// Optional: target: 'allPlayers' | 'satisfyingPlayers' — which players the effect applies to
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

## Per-Player Scoping

Omitting `scope` (or setting `'party'`) keeps the legacy behavior: effects apply to every player. With `scope: 'player'`:

- The engine works out which players individually satisfy the player-scoped mechanical conditions (`player-level`, `player-resource`, `player-traits`); for semantic conditions the AI attributes which players the story text supports
- `player-resource` / `player-traits` effects apply only to those players (unless `target: 'allPlayers'` is set); story effects address them by name
- If the trigger fired but no players are targetable, it is suppressed — no effects run and a one-shot trigger keeps its slot

Firing itself is unchanged: a mechanical player condition still fires when at least one player satisfies it.

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
  scope?: 'party' | 'player'
  script?: string
}
```

## Reference

For detailed documentation, see [triggers-reference.md](references/triggers-reference.md).
