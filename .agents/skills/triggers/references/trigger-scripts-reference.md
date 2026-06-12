# Trigger Scripts Reference

Complete documentation for the `script` field on triggers.

Trigger scripts run JavaScript inside a sandboxed VM after a trigger's conditions pass but before its effects apply. Scripts can mutate storage, rewrite effects, mutate other triggers, and short-circuit the trigger entirely.

## When to use

Use `script` only when the declarative condition/effect vocabulary can't express what you need. Typical cases:

- Branching logic: inspect multiple condition values and choose which effects to apply this turn
- Derived math: combine several resources or trigger storage values before writing a result
- Cross-trigger coordination: disable, enable, or rewrite other triggers based on runtime state
- Multi-write storage updates: read-modify-write patterns that would need several `read-*` / `write-*` effects
- Custom data shapes: objects or nested arrays in storage that the `write-*` effects can't produce

Prefer declarative conditions and effects when they suffice — they're cheaper, easier to review, and don't compete for the shared script budget.

## Execution model

### Phase routing

Scripts run in one of two phases per turn, decided by the trigger's conditions:

- **Planning phase**: triggers with at least one `action` or `action-text` condition.
- **State phase**: every other trigger (semantic story conditions, mechanical conditions, no conditions, etc.).

Each phase has its **own independent** budget. A turn that uses both phases gets two separate budgets — they do not share or combine.

### Per phase, in order

For every triggered trigger in the phase:

1. Conditions evaluate (no script involvement).
2. If conditions pass AND `script` is non-empty AND the phase's script budget is not exhausted:
   a. Enter a fresh VM context with globals bound to a **copy** of current storage, triggers, and this trigger's effects.
   b. Run the script to completion (or until it exceeds the remaining budget).
   c. Read back `skip`, `storage`, `triggers`, `effects` from the VM.
3. If `skip === true`, this trigger's effects are cleared for the turn AND the trigger is **not** counted as fired — non-recurring triggers with `skip = true` re-fire next turn. Storage and trigger-set writes still persist.
4. Otherwise, filter `effects` through the Effect schema and cap at 5 effects, then apply them. This filter+cap also defends against malformed effects produced by script writeback.
5. After all triggers in the phase complete, validate mutated `triggers` via the trigger-limits rules; if any limit is violated, **all** trigger mutations for the phase are discarded. Storage writes are validated via JSON round-trip and reverted if non-serializable.

### Per-phase budget

- **500 ms shared budget** across all scripts that run in the same phase (not per-script, not per-turn).
- Once exhausted, remaining scripts in that phase are skipped and their effects apply unmodified (as if `script` were empty).
- The other phase still has its own fresh 500 ms budget the same turn.
- **16 MB base memory** per isolate, plus headroom proportional to the total trigger set size. Running out of memory terminates scripts for the rest of the phase.
- Scripts run in a sandboxed isolate with no Node.js built-ins (`require`, `process`, `Buffer`, `setTimeout`, etc.) and no `Function` constructor.

## Available globals

| Global | Type | Description |
|--------|------|-------------|
| `check(condition)` | function | Evaluates a condition object against live game state. With `operator`: returns boolean. Without `operator`: returns the raw underlying value. See Check Function below. |
| `log(...args)` | function | Appends to the `trigger-script` system log. Args are joined with spaces. |
| `console` | object | `{ log, warn, error, info }` — all four forward to `log`. |
| `info` | object | `{ engineVersion, semanticVersion }`. Copy-in; mutating does not affect the host. |
| `storage` | object | Read/write mirror of shared trigger storage. See Storage below. |
| `triggers` | object | Read/write mirror of the world's trigger set. See Trigger Mutations below. |
| `effects` | array | Read/write mirror of this trigger's effects array for this turn. See Effect Mutations below. |
| `skip` | boolean | Set to `true` to drop this trigger's effects for this turn AND prevent the trigger from being counted as fired. Non-recurring triggers with `skip = true` re-fire next turn. Storage and trigger-set mutations still persist. |

## Check Function

`check(condition)` accepts a standard condition object and returns either a boolean (with `operator`) or the raw value (without `operator`). Same evaluation logic as declarative conditions, except:

- `operator: 'regex'` is **blocked** — returns `undefined` (regex runs on the host thread, outside the VM timeout). Use `/pattern/.test(check({ type: '...' }))` inside the VM instead.
- Malformed conditions silently return `undefined`.

### Raw value by condition type

| Condition type | Raw return |
|---------------|------------|
| `story`, `story-text` | `string` — the most recent story message |
| `action`, `action-text` | `string[]` — all pending action inputs this turn |
| `player-level` | `Record<characterName, number>` |
| `game-tick` | `number` |
| `party-realm` / `party-region` / `party-location` / `party-area` | `string` |
| `player-resource` | `Record<characterName, number \| undefined>` (requires `resource` field) |
| `known-entity` | `boolean` — whether the entity is known (requires `entity` field) |
| `player-traits` | `Record<characterName, string[]>` |
| `quests-completed` | `string[]` — names of completed quests |
| `read-string` | `string` — falls back to `""` |
| `read-number` | `number` — falls back to `0` |
| `read-boolean` | `boolean` — falls back to `false` |
| `read-array` | `unknown[]` — falls back to `[]` |

### Examples

```javascript
// Returns the current story text (string)
const story = check({ type: 'story-text' })

// Returns a boolean
if (check({ type: 'player-level', operator: 'greaterThan', value: 5 })) {
  effects.push({ type: 'story', instruction: 'The party radiates experience.' })
}

// Per-character resource map
const health = check({ type: 'player-resource', resource: 'health' })
const lowest = Math.min(...Object.values(health).filter((v) => typeof v === 'number'))
```

## Storage

`storage` is the same shared key/value store that `read-*` and `write-*` effects use. Values can be any JSON-serializable shape — strings, numbers, booleans, arrays, plain objects, and arbitrarily-nested combinations. Typed `read-string` / `read-number` / `read-boolean` / `read-array` conditions still strict-typecheck and fall back to defaults when the stored shape doesn't match (e.g. `read-number` on an object returns `0`).

Writes persist even if `skip = true` or the trigger's effects throw. The final storage object is JSON round-tripped after every script in the phase runs; if the result isn't serializable, the entire phase's storage writes are reverted to the pre-phase snapshot.

### Type survival matrix

The values below apply when reading `storage` back from the VM:

| Value | Outcome | Resulting type |
|-------|---------|----------------|
| `string`, `number`, `boolean`, `null` | Survives | As written |
| `undefined` | Survives (key preserved with `undefined`) | `undefined` |
| `NaN`, `Infinity` | Survives | Stored as `null` after JSON round-trip |
| Array, plain Object (arbitrarily nested) | Survives | As written |
| `Date` | Survives | Becomes ISO string after JSON round-trip |
| `RegExp`, `Map`, `Set`, `TypedArray`, `function`, `Symbol` value | Survives the script boundary | Becomes `{}` or `null` after JSON round-trip |
| `BigInt` | **Rejects the whole phase's storage writes** | Storage reverts to pre-turn snapshot |
| Circular reference | **Rejects the whole phase's storage writes** | Storage reverts to pre-turn snapshot |

### Shape guards

- Reassigning `storage` to a non-plain-object (array, `null`, primitive) resets storage to `{}` for the turn.
- Symbol keys (`storage[Symbol('x')] = ...`) silently drop at the clone boundary; string keys in the same script still persist.
- Literal `__proto__` keys are safe — stored as normal keys, no host prototype pollution.

### Cross-script visibility

Later scripts in the same turn see earlier scripts' storage writes immediately. Effects from earlier triggers have already applied before later scripts run.

## Trigger Mutations

`triggers` is a read/write mirror of the whole trigger set. Scripts can:

- Mutate existing triggers: `triggers["other-trigger"].recurring = false`
- Add new triggers: `triggers["new-id"] = { name: "new-id", conditions: [], effects: [], recurring: true }`
- Delete triggers: `delete triggers["victim"]`

### Visibility timing

- **Within the same phase**: later scripts read earlier scripts' mutations immediately. Storage and the `triggers` global both reflect prior writes.
- **For trigger firing**: mutations only affect which triggers fire and which conditions/effects apply on the **next turn**. The current turn's set of fired triggers and their effects is already locked in by the time scripts run.

Mutations are buffered until all scripts in the phase complete, then validated against the same trigger limits enforced at publish time. If **any** check fails, the entire buffer is discarded and a `trigger-script-error` log entry is written. See [triggers-reference.md](triggers-reference.md) for the full trigger-limits table.

Validation catches include:
- Semantic trigger count > 200, mechanical > 500
- More than 5 conditions or 5 effects on a single trigger
- Whole-trigger JSON > 10 000 chars
- Condition query > 1 000 chars, effect instruction > 1 000 chars
- Any condition or effect value > 100 chars (stringified)
- Trigger name not matching its object key
- Non-serializable trigger shape

### Semantic embedding cleanup

If a script rewrites a trigger's semantic condition (`story` / `action` query), the old embedding is automatically cleared during cleanup. New embeddings generate on the next turn.

## Effect Mutations

`effects` is a read/write mirror of the current trigger's effects array for this turn. Writes do NOT persist to the stored trigger definition — they only affect what gets applied this turn.

Supported operations:

```javascript
// Push an effect
effects.push({ type: "story", instruction: "extra narration" })

// Replace entirely
effects = [{ type: "story", instruction: "only this" }]

// Clear
effects.length = 0

// Conditional removal
effects = effects.filter((e) => e.type !== "party-realm")
```

After readback:
- Malformed effects (unknown type, non-object, primitive) are silently dropped.
- The first 5 valid effects apply; the rest are discarded.

If `skip = true`, the entire effect array is cleared regardless of what the script wrote.

## Error Handling

Script errors log as `trigger-script-error` with the trigger name as prefix. On error:

- The trigger's declarative `effects` apply unmodified (fallback behavior).
- Other triggers in the same turn continue to run, up to the shared budget.
- Storage writes made **before** the error still persist (unless the final JSON round-trip rejects the whole phase).

## Practical Patterns

### Branch on storyline state

```javascript
const tick = check({ type: 'game-tick' })
if (tick < 10) {
  storage.phase = 'early'
} else if (tick < 50) {
  storage.phase = 'mid'
} else {
  storage.phase = 'late'
  effects.push({ type: 'story', instruction: 'A sense of finality hangs in the air.' })
}
```

### Conditional suppression

```javascript
if (check({ type: 'known-entity', entity: 'Villain', operator: 'equals', value: false })) {
  skip = true  // Don't reveal this plot beat before the villain shows up
}
```

### Derived counters

```javascript
const current = typeof storage.banditsDefeated === 'number' ? storage.banditsDefeated : 0
storage.banditsDefeated = current + 1
if (storage.banditsDefeated === 10) {
  effects.push({ type: 'quest-progress', questId: 'bandit-hunt' })
}
```

### Disable a one-shot sister trigger

```javascript
if (triggers['intro-cutscene']) {
  triggers['intro-cutscene'].recurring = false
  triggers['intro-cutscene'].effects = []
}
```

## Anti-Patterns

- **Don't busy-wait or poll**: the per-phase budget is small and shared. A `while(true)` will exhaust it and suppress other triggers in that phase.
- **Don't rely on exact timing**: scripts may run in either async or sync mode. Don't branch on which one.
- **Don't store functions, BigInts, or non-JSON values** in `storage` — they're lost or cause the whole phase's writes to revert.
- **Don't use `operator: 'regex'` via `check()`** — it returns `undefined`. Use JS regex directly.
- **Don't write huge storage objects**: the 16 MB memory ceiling includes storage copy-in on every script.
- **Don't mutate `triggers` without knowing the limits** — one violation discards every mutation for the phase.

## Size and Placement

The `script` field counts toward the 10 000-char whole-trigger JSON limit enforced at publish time — so scripts longer than roughly 9 KB will fail validation before they ever run.

There's no separate `script`-specific size limit. Keep scripts short; put shared logic in multiple coordinating triggers rather than one giant script.

## Full Trigger Examples

These are complete trigger objects in the JSON shape that goes in `triggers/`. Use them as starting points.

### Skip effects conditionally (only heal when wounded)

```json
{
  "name": "temple_heal",
  "conditions": [
    { "type": "party-location", "operator": "equals", "value": "Temple of Light" }
  ],
  "script": "const hp = check({ type: 'player-resource', resource: 'health' })\nif (!Object.values(hp).some(v => v < 10)) { skip = true }",
  "effects": [
    { "type": "player-resource", "resource": "health", "operator": "add", "value": 15 },
    { "type": "story", "instruction": "The temple's light washes over the wounded." }
  ],
  "recurring": true
}
```

### Replace an effect dynamically

```json
{
  "name": "dynamic_story",
  "conditions": [],
  "script": "const tick = check({ type: 'game-tick' })\neffects[0] = { type: 'story', instruction: 'Turn ' + tick + ': the world shifts.' }",
  "effects": [
    { "type": "story", "instruction": "placeholder" }
  ],
  "recurring": true
}
```

### Complex OR logic (gate by trait OR completed quest)

```json
{
  "name": "enter_noble_district",
  "conditions": [
    { "type": "party-location", "operator": "equals", "value": "Noble District Gate" }
  ],
  "script": "const hasTrait = check({ type: 'player-traits', operator: 'contains', value: 'Noble' })\nconst hasQuest = check({ type: 'quests-completed', operator: 'contains', value: 'Earn the Writ' })\nif (!hasTrait && !hasQuest) { skip = true }",
  "effects": [
    { "type": "known-entity", "entity": "Noble District", "operator": "set", "value": true },
    { "type": "story", "instruction": "The guards step aside." }
  ],
  "recurring": false
}
```

### Nested storage (track visited locations)

```json
{
  "name": "track_progress",
  "conditions": [],
  "script": "if (!storage.progress) { storage.progress = {} }\nstorage.progress.visited = storage.progress.visited || []\nconst loc = check({ type: 'party-location' })\nif (!storage.progress.visited.includes(loc)) {\n  storage.progress.visited.push(loc)\n  log('new location discovered: ' + loc)\n}",
  "effects": [],
  "recurring": true
}
```
