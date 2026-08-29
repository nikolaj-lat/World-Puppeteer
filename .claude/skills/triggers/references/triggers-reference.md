# Triggers Reference

Complete documentation for `tabs/triggers.json`.

## Schema

```typescript
interface Trigger {
  name: string                      // ✅ Display name, must match object key
  conditions: TriggerCondition[]    // ✅ All must pass for trigger to fire
  effects: TriggerEffect[]          // ✅ Applied when all conditions pass
  recurring?: boolean               // ✅ If true, can fire every turn; if false/undefined, fires once
  scope?: 'party' | 'player'        // ✅ 'player' targets only the players who satisfy the conditions; omitted = 'party' (legacy behavior). See Per-Player Trigger Scoping
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

### Status Conditions

```typescript
interface QuestStatusCondition {
  type: 'quest-status'
  questId: string                   // Quest key; resolves by key first, then by unique quest name
  operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'regex'
  value: string                     // Compared against: 'hidden' | 'available' | 'expired' | 'accepted' | 'completed' | 'abandoned' | 'rejected'
}

interface NarrativeEventStatusCondition {
  type: 'narrative-event-status'
  eventId: string                   // Key from narrative-events.json
  operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'regex'
  value: string                     // Compared against: 'inactive' | 'active' | 'stopped' | 'completed'
}
```

Status conditions compare the quest's or narrative event's **current status** as a string, using the same operators as other string conditions. Use them to gate content on quest progression (`quest-status equals 'completed'`) or to branch on whether a narrative event has played out (`narrative-event-status equals 'completed'`).

### Number Conditions

```typescript
interface NumberCondition {
  type: 'player-level' | 'game-tick' | 'player-resource'
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual'
  value: number
  resource?: string                 // Required for player-resource type
}
```

### NPC Relationship Conditions

```typescript
interface NpcRelationshipCondition {
  type: 'npc-relationship'
  npc: string                       // NPC name from tabs/npcs.json
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual'
  value: number
}

interface NpcRelationshipStageCondition {
  type: 'npc-relationship-stage'
  npc: string                       // NPC name from tabs/npcs.json
  operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'regex'
  value: string                     // Compared against the NPC's current relationship stage NAME
}
```

`npc-relationship` compares the NPC's numeric relationship score. An NPC with no score yet reads as `0`; naming an NPC that doesn't exist never matches. `npc-relationship-stage` compares the stage name the NPC's score currently resolves to from the world's `relationshipStages` names (or the engine's default ladder when the world doesn't author one); a score that matches no stage falls back to `Neutral`.

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

Identical instruction text is deduplicated: when two triggers fire with the same `story` instruction, the AI receives it once. Duplicating an effect for emphasis does not work — write a stronger instruction instead.

### Quest Effects

```typescript
interface QuestProgressEffect {
  type: 'quest-progress'
  questId: string                   // Marks the quest's main objective as satisfied, with a player-visible status line
}

interface QuestCompleteEffect {
  type: 'quest-complete'
  questId: string                   // Marks the quest's main objective as satisfied with NO player-visible status line
}

interface QuestInitEffect {
  type: 'quest-init'
  operator: 'set'
  value: string                     // Quest name to make available
}
```

`quest-progress` and `quest-complete` are siblings: both mark the quest's main objective as satisfied, so the quest completes on the same turn if it is accepted. The difference is presentation — `quest-progress` shows a player-visible status line; `quest-complete` is silent. Use `quest-complete` when a narrative event or other effect already communicates the completion.

### Quest Objective Effects

```typescript
interface QuestObjectiveRevealEffect {
  type: 'quest-objective-reveal'
  questId: string
  objectiveId: string               // Key of an authored objective on the quest
}

interface QuestObjectiveCompleteEffect {
  type: 'quest-objective-complete'
  questId: string
  objectiveId: string
}
```

- `quest-objective-reveal` sets the authored objective active, makes it the quest's active objective, and sets the quest's next step to the objective's text. A status update is shown if the quest is visible to the player.
- `quest-objective-complete` marks the objective completed and advances the quest's next step to the next active objective (or clears it if none remains).

### Next-Step Effects

```typescript
interface QuestNextStepSetEffect {
  type: 'quest-next-step-set'
  questId: string
  text: string                      // The next-step guidance to show
  source: 'objective' | 'narrative-event'
}

interface QuestNextStepClearEffect {
  type: 'quest-next-step-clear'
  questId: string
}

interface PartyNextStepSetEffect {
  type: 'party-next-step-set'
  text: string
  source: 'objective' | 'narrative-event'
}

interface PartyNextStepClearEffect {
  type: 'party-next-step-clear'
}
```

- `quest-next-step-set` / `quest-next-step-clear` directly set or clear a quest's next-step guidance. Setting also updates the party-wide next step when that quest is the accepted active quest.
- `party-next-step-set` / `party-next-step-clear` set or clear the party-wide guidance shown when no quest is active — useful for steering the player before any quest is visible. With `source: 'objective'`, `party-next-step-set` writes only to the accepted active quest and is a no-op when there is none; use `source: 'narrative-event'` for guidance that should show before any quest is accepted.

### Narrative Event Effects

```typescript
interface NarrativeEventStartEffect {
  type: 'narrative-event-start'
  eventId: string                   // Key from narrative-events.json
}
```

Starts (or resumes) a narrative event — the only way an event can begin. Silently ignored if another event is already active. A completed event can only be restarted by a recurring trigger. See the narrative-events skill for full event behavior.

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
  target?: 'allPlayers' | 'satisfyingPlayers'  // Which players the effect applies to. See Per-Player Trigger Scoping
}
```

Resource effects interact with the death model: positive healing on a living near-death or dying player clears that state. In permadeath games a dead player cannot be revived by a resource effect; health is forced back to 0. Outside permadeath, a resource effect that raises health above 0 counts as explicit healing and revives the player.

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
  target?: 'allPlayers' | 'satisfyingPlayers'  // Which players the effect applies to. See Per-Player Trigger Scoping
}
```

When adding/removing traits, the trait's attribute/skill/resource modifiers are automatically applied/removed. If a granted trait has skill modifiers for a skill the player doesn't have yet, that skill is created on the player so the bonus always takes effect. Trigger-granted traits do NOT grant the trait's `startingItems`; only permanent acquisition paths (character creation, level-up picks) hand out starting items, so trigger traits can be toggled freely. Modifiers are reconciled as net deltas, so repeated add/remove never double-applies.

### NPC Relationship Effect

```typescript
interface NpcRelationshipEffect {
  type: 'npc-relationship'
  npc: string                       // NPC name from tabs/npcs.json
  operator: 'set' | 'add' | 'subtract' | 'multiply' | 'divide'
  value: number
}
```

Adjusts the NPC's relationship score. The result is clamped to -100..100 and rounded to a whole number. Naming an NPC that doesn't exist is a silent no-op. Pair with `npc-relationship` / `npc-relationship-stage` conditions to gate content on the resulting score or stage.

### Music Effects

```typescript
interface MusicTrackSetEffect {
  type: 'music-track-set'
  trackId: string                   // Track id from the world's gameplay music settings
}

interface MusicTrackClearEffect {
  type: 'music-track-clear'
}
```

`music-track-set` sets a music override to that track family from the world's gameplay music settings. The override beats AI-selected music until cleared — by `music-track-clear` or by another `music-track-set`. The effect only applies when `trackId` exists in `gameplayMusicSettings.tracks`; an unknown id is ignored.

### Game Ending Effects

```typescript
interface GameEndingEffect {
  type: 'win-game' | 'lose-game' | 'end-game'
  endScope?: 'game' | 'players'     // Default 'game'
  othersOutcome?: 'won' | 'lost' | 'ended'
}
```

Terminal effects that end the game with outcome `won` (`win-game`), `lost` (`lose-game`), or `ended` (`end-game`).

- **Game scope** (default): the whole game ends. With `othersOutcome`, the players satisfying the trigger get the effect's outcome and everyone else gets `othersOutcome`; without it, everyone shares the effect's outcome.
- **Player scope** (`endScope: 'players'`): only the players satisfying the trigger end; the rest keep playing. When every party player has a personal outcome, the game auto-ends — with the shared outcome if unanimous, otherwise `ended`.
- **First to land wins**: once a terminal effect has applied, later ending effects are ignored.
- **Player-scoped ending triggers** skip players who already ended, don't fire at all if no eligible player remains, and do NOT consume the trigger's global fire count — so a non-recurring per-player ending trigger can still fire for remaining players on later turns.
- **After ending**: ended players can't act, can't be resurrected, and don't block others' turns. A game-wide ending stops the world accepting turns.
- **Closing narration** is guided by the world's authored win/lose/end game instructions — paraphrased, not quoted verbatim. If story generation fails, a terse one-line fallback is shown.

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
Write-string operators: `set`. Write-boolean operators: `set`, `toggle`

## Phase Partitioning

Triggers evaluate in exactly one phase based on their conditions:

| Has `action` or `action-text` condition? | Phase | Timing |
|------------------------------------------|-------|--------|
| Yes | Planning | After player acts, before story generation |
| No | State | After story is generated |

`action` / `action-text` conditions only evaluate real player inputs. Host and DM story directions are ignored by them.

## Evaluation Flow

1. **Filter**: Remove already-fired non-recurring triggers
2. **Mechanical check**: All mechanical conditions must pass
3. **Semantic check**: If has semantic conditions, AI evaluates them
4. **Fire**: If all conditions pass, effects are applied. Effects are filtered through the Effect schema and excess effects beyond the per-trigger cap are dropped at apply time — defense for malformed effects produced by trigger script writeback. Trigger count/size limits are enforced at both publish time and runtime, so scripts that grow the trigger set past the limits have all of their mutations discarded for the phase.

## Per-Player Trigger Scoping

Triggers are party-wide by default: they fire for the party and their effects apply to every player. Setting `scope: 'player'` makes the trigger target only the specific players its conditions point at.

### Which players a player-scoped trigger targets

- **Mechanical eligibility**: the player-scoped mechanical conditions are exactly `player-level`, `player-resource`, and `player-traits`. The engine computes which players individually satisfy ALL of the trigger's player-scoped mechanical conditions. A trigger with none of these treats all players as eligible.
- **Semantic attribution**: for semantic (`story` / `action`) conditions, the AI attributes which players the story text clearly supports, per condition. Attributions are intersected across conditions.
- **Final target** = eligible ∩ attributed.
- **Suppression**: if the trigger's conditions passed but no players are targetable, the trigger is suppressed entirely — it does not consume its one-shot slot, and no effects run.

### How effects apply

- On a **player-scoped** trigger, `player-resource` and `player-traits` effects apply to the satisfying players by default; `target: 'allPlayers'` forces everyone.
- On a **party-scoped** trigger, effects apply to everyone unless `target: 'satisfyingPlayers'` is set on the effect.
- `story` effects on a fired player-scoped trigger are annotated so narration addresses the specific players.

### Firing is unchanged

Whether the trigger fires at all works the same as before: a mechanical player condition still fires when at least one player satisfies it. Scoping only changes who the effects target.

## Quest Trigger Naming

Triggers named `{questId}_objective` or `{questId}_objective_N` are automatically filtered out if the quest is abandoned or not accepted.

## Cross-References

| Field | References |
|-------|------------|
| `conditions[].entity` (known-entity) | `tabs/npcs.json`, `tabs/factions.json`, `tabs/realms.json`, `tabs/regions.json`, `tabs/locations.json` |
| `conditions[].value` (party-*) | `tabs/realms.json`, `tabs/regions.json`, `tabs/locations.json` |
| `conditions[].npc` (npc-relationship, npc-relationship-stage) | `tabs/npcs.json` |
| `conditions[].resource` | `resourceSettings.resources` in `tabs/settings.json` |
| `conditions[].value` (player-traits) | `tabs/traits.json` |
| `conditions[].value` (quests-completed) | `tabs/quests.json` |
| `conditions[].questId` (quest-status) | `tabs/quests.json` |
| `conditions[].eventId` (narrative-event-status) | `tabs/narrative-events.json` |
| `effects[].questId` | `tabs/quests.json` |
| `effects[].objectiveId` (quest-objective-*) | Authored objectives on the quest in `tabs/quests.json` |
| `effects[].eventId` (narrative-event-start) | `tabs/narrative-events.json` |
| `effects[].value` (quest-init) | `tabs/quests.json` |
| `effects[].entity` | `tabs/npcs.json`, `tabs/factions.json`, `tabs/realms.json`, `tabs/regions.json`, `tabs/locations.json` |
| `effects[].value` (party-*) | `tabs/realms.json`, `tabs/regions.json`, `tabs/locations.json` |
| `effects[].npc` (npc-relationship) | `tabs/npcs.json` |
| `effects[].trackId` (music-track-set) | `gameplayMusicSettings.tracks` in `tabs/settings.json` (validated) |
| `effects[].resource` | `resourceSettings.resources` in `tabs/settings.json` |
| `effects[].value` (player-traits) | `tabs/traits.json` |
