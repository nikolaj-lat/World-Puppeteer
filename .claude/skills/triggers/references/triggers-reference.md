# Triggers Reference

Complete documentation for `tabs/triggers.json`.

## Schema

```typescript
interface Trigger {
  name: string                      // ✅ Display name, must match object key
  conditions: TriggerCondition[]    // ✅ All must pass for trigger to fire
  effects: TriggerEffect[]          // ✅ Applied when all conditions pass
  recurring?: boolean               // ✅ If true, can fire every turn; if false/undefined, fires once
  script?: string                   // ✅ JavaScript executed after conditions pass, before effects apply. See trigger-scripts-reference.md
  embeddingId?: string              // ❌ Auto-generated for semantic conditions
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread
- ❌ **Always overwritten**: Set by initialization regardless of what exists in config

## TriggerCondition Schema

### Semantic Conditions (AI-Evaluated)

```typescript
interface SemanticCondition {
  type: 'story' | 'action'          // story = recent narrative, action = current player action
  query: string                     // Natural language query for semantic matching
  embeddingId?: string              // Auto-generated
}
```

### String Conditions

```typescript
interface StringCondition {
  type: 'story-text' | 'action-text' | 'party-realm' | 'party-region' | 'party-location' | 'party-area'
  operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'regex'
  value: string
}
```

### Number Conditions

```typescript
interface NumberCondition {
  type: 'player-level' | 'game-tick' | 'player-resource'
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual'
  value: number
  resource?: string                 // Required for player-resource type
}
```

### Boolean Conditions

```typescript
interface BooleanCondition {
  type: 'known-entity'
  operator: 'equals' | 'notEquals'
  value: boolean
  entity: string                    // NPC, faction, realm, region, or location name
}
```

### Array Conditions

```typescript
interface ArrayCondition {
  type: 'player-traits' | 'quests-completed'
  operator: 'contains' | 'notContains'
  value: string | number | boolean
}
```

### Read Conditions (from triggerWritable)

```typescript
interface ReadCondition {
  type: 'read-string' | 'read-number' | 'read-boolean' | 'read-array'
  key: string                       // Key in triggerWritable storage
  operator: '...'                   // Operators match the data type
  value: '...'                      // Value type matches the data type
}
```

`triggerWritable` storage holds any JSON-serializable value (strings, numbers, booleans, arrays, plain objects, nested combinations) — `write-*` effects produce the typed shapes, but trigger scripts can persist arbitrary nested objects. The four `read-*` types still strict-typecheck the stored value: `read-number` on an object returns `0`, `read-array` on a string returns `[]`, etc.

## TriggerEffect Schema

### Story Effect

```typescript
interface StoryEffect {
  type: 'story'
  instruction: string               // Injected into story generation context
}
```

### Quest Effects

```typescript
interface QuestProgressEffect {
  type: 'quest-progress'
  questId: string                   // Marks quest objective as completed
}

interface QuestInitEffect {
  type: 'quest-init'
  operator: 'set'
  value: string                     // Quest name to make available
}
```

### Location Effects

```typescript
interface LocationEffect {
  type: 'party-realm' | 'party-region' | 'party-location' | 'party-area'
  operator: 'set'
  value: string                     // Name of realm/region/location/area
}
```

Setting `party-location` automatically cascades:
- Updates `currentCoordinates` to location's x,y
- Sets `currentRegion` to location's region (unless explicitly set)
- Sets `currentRealm` to region's realm (unless explicitly set)
- Sets `currentLocationArea` to first area (unless explicitly set)

### Resource Effects

```typescript
interface ResourceEffect {
  type: 'player-resource'
  resource: string                  // Resource name from settings
  operator: 'set' | 'add' | 'subtract' | 'multiply' | 'divide'
  value: number
}
```

### Entity Knowledge Effects

```typescript
interface KnownEntityEffect {
  type: 'known-entity'
  entity: string                    // NPC, faction, realm, region, or location name
  operator: 'set' | 'toggle'
  value?: boolean                   // Required for 'set', ignored for 'toggle'
}
```

### Trait Effects

```typescript
interface TraitEffect {
  type: 'player-traits'
  operator: 'set' | 'add' | 'remove'
  value: string | string[]          // Trait name(s)
}
```

When adding/removing traits, the trait's attribute/skill/resource modifiers are automatically applied/removed.

### Write Effects (to triggerWritable)

```typescript
interface WriteEffect {
  type: 'write-string' | 'write-number' | 'write-boolean' | 'write-array'
  key: string                       // Key in triggerWritable storage
  operator: '...'                   // Operators match the data type
  value: '...'                      // Value type matches the data type
}
```

Write-number operators: `set`, `add`, `subtract`, `multiply`, `divide`
Write-array operators: `set`, `add`, `remove`
Write-string/boolean operators: `set`

## Phase Partitioning

Triggers evaluate in exactly one phase based on their conditions:

| Has `action` or `action-text` condition? | Phase | Timing |
|------------------------------------------|-------|--------|
| Yes | Planning | After player acts, before story generation |
| No | State | After story is generated |

## Evaluation Flow

1. **Filter**: Remove already-fired non-recurring triggers
2. **Mechanical check**: All mechanical conditions must pass
3. **Semantic check**: If has semantic conditions, AI evaluates them
4. **Fire**: If all conditions pass, effects are applied. Effects are filtered through the Effect schema and capped at 5 at apply time — defense for malformed effects produced by trigger script writeback. Trigger count/size limits are enforced at both publish time and runtime, so scripts that grow the trigger set past the limits have all of their mutations discarded for the phase.

## Quest Trigger Naming

Triggers named `{questId}_objective` or `{questId}_objective_N` are automatically filtered out if the quest is abandoned or not accepted.

## Cross-References

| Field | References |
|-------|------------|
| `conditions[].entity` (known-entity) | `tabs/npcs.json`, `tabs/factions.json`, `tabs/realms.json`, `tabs/regions.json`, `tabs/locations.json` |
| `conditions[].value` (party-*) | `tabs/realms.json`, `tabs/regions.json`, `tabs/locations.json` |
| `conditions[].resource` | `resourceSettings.resources` in `tabs/settings.json` |
| `conditions[].value` (player-traits) | `tabs/traits.json` |
| `conditions[].value` (quests-completed) | `tabs/quests.json` |
| `effects[].questId` | `tabs/quests.json` |
| `effects[].value` (quest-init) | `tabs/quests.json` |
| `effects[].entity` | `tabs/npcs.json`, `tabs/factions.json`, `tabs/realms.json`, `tabs/regions.json`, `tabs/locations.json` |
| `effects[].value` (party-*) | `tabs/realms.json`, `tabs/regions.json`, `tabs/locations.json` |
| `effects[].resource` | `resourceSettings.resources` in `tabs/settings.json` |
| `effects[].value` (player-traits) | `tabs/traits.json` |
