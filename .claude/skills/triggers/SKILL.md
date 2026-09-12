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
| `phase` | Set to `'planning'` only on a purely mechanical trigger whose effects must land before this turn's story (react to combat damage or skill-check results in the same turn's narration). Omit otherwise |
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

**String conditions** (`party-realm`, `party-region`, `party-location`, `party-area`, `story-text`, `action-text`, `npc-realm`, `npc-region`, `npc-location`, `npc-area`):
```typescript
{ type: '...', operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'regex', value: 'string' }
// For npc-*, also include: npc. An off-stage or unresolved NPC matches no operator, notEquals/notContains included
```

**Number conditions** (`player-level`, `game-tick`, `player-resource`, `npc-relationship`, `skill-value`, `npc-health`, `npc-health-percent`):
```typescript
{ type: '...', operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual', value: number }
// For player-resource, also include: resource: 'resourceName'
// For npc-relationship, npc-health, npc-health-percent, also include: npc
// For skill-value, also include: skill (id or display name). Compares skill level; a character without the skill matches nothing
// npc-health is absolute current HP (equals 0 = the death check); npc-health-percent is current/max as 0-100, unrounded
```

**Action outcome condition** (`action-success-level`):
```typescript
{ type: 'action-success-level', operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual', value: 'impossible' | 'critical failure' | 'failure' | 'mixed results' | 'basic success' | 'success' | 'great success' | 'critical success' }
// Ordinal over that worst-to-best order, per player, this turn's action. Simple actions and players with no evaluated action match nothing, notEquals included. Rejected alongside story / story-text conditions: put the story check on a separate trigger
```

**NPC relationship stage condition** (`npc-relationship-stage`):
```typescript
{ type: 'npc-relationship-stage', npc: 'npcName', operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'regex', value: 'stage name' }
// Compares against the NPC's current stage name from the world's relationshipStages; a score matching no stage reads as 'Neutral'
```

**Boolean conditions** (`known-entity`, `npc-in-scene`, `npc-in-party`):
```typescript
{ type: 'known-entity', operator: 'equals' | 'notEquals', value: boolean, entity: 'entityName' }
{ type: 'npc-in-scene' | 'npc-in-party', operator: 'equals' | 'notEquals', value: boolean, npc: 'npcName' }
```

**NPC selectors:** every `npc` field takes an authored NPC name, or `anySceneNPC` / `anyPartyNPC` in conditions (passes if any NPC in the set matches) and `allSceneNPCs` / `allPartyNPCs` in effects (fans out; `npc-portrait` takes a name only). A wrong-slot selector resolves to nothing; avoid giving NPCs those four names.

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
// Quest statuses: hidden | planned | available | expired | accepted | completed | abandoned | rejected
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
{ type: 'quest-init', operator: 'set', value: 'Quest Name' }  // Makes a hidden or planned quest available
{ type: 'quest-accept', operator: 'set', value: 'Quest Name' }  // Accepts an authored quest (hidden/planned/available) as the party's active quest
{ type: 'quest-plan', operator: 'set', value: 'Quest Name' }  // Moves a hidden quest to planned: invisible, reserved against AI quest generation
{ type: 'quest-objective-reveal', questId: 'questKey', objectiveId: 'objectiveKey' }  // Activates an authored objective, makes it the active objective
{ type: 'quest-objective-complete', questId: 'questKey', objectiveId: 'objectiveKey' }  // Completes the objective, advances next step
```

### Next-Step Effects

```typescript
{ type: 'quest-next-step-set', questId: 'questKey', text: 'guidance', source: 'objective' | 'narrative-event' }
{ type: 'quest-next-step-clear', questId: 'questKey' }
{ type: 'party-next-step-set', text: 'guidance', source: 'objective' | 'narrative-event' }  // Party-wide guidance; with source 'objective' it only applies when there is an accepted active quest
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
// Healing a living near-death or dying player clears that state. In permadeath games a dead player cannot be revived this way (health is forced back to 0)
```

### Entity Knowledge Effects

```typescript
{ type: 'known-entity', entity: 'entityName', operator: 'set' | 'toggle', value?: boolean }
```

### Trait Effects

```typescript
{ type: 'player-traits', operator: 'set' | 'add' | 'remove', value: 'traitName' | ['trait1', 'trait2'] }
// Optional: target: 'allPlayers' | 'satisfyingPlayers' — which players the effect applies to
// Applies the trait's modifiers and abilities, but does NOT grant the trait's startingItems
```

### Player Progression Effects

```typescript
{ type: 'player-level' | 'player-experience', operator: 'add' | 'subtract' | 'set', value: number }
{ type: 'player-skill', skill: 'skillIdOrName', operator: 'add' | 'subtract' | 'set', value: number }
{ type: 'player-attribute', attribute: 'attributeName', operator: 'add' | 'subtract' | 'set', value: number }
// value: whole number >= 0. Optional: target: 'allPlayers' | 'satisfyingPlayers'
// Levels/skills/attributes clamp to the world's ranges; player-skill updates a skill the character already has; player-attribute applies as a bonus to existing attributes
```

### NPC Relationship Effect

```typescript
{ type: 'npc-relationship', npc: 'npcName', operator: 'set' | 'add' | 'subtract' | 'multiply' | 'divide', value: number }
// Result clamps to -100..100 and rounds to a whole number; a missing NPC is a silent no-op
```

### NPC State Effects

```typescript
{ type: 'npc-health', npc: 'npcName', operator: 'set' | 'add' | 'subtract' | 'multiply' | 'divide', value: number }  // Clamps 0..max HP; healing revives the downed; set 0 kills
{ type: 'npc-in-party', npc: 'npcName', operator: 'set' | 'toggle', value?: boolean }  // set without value means true; a downed or dead NPC stays out
{ type: 'npc-portrait', npc: 'npcName', operator: 'set', value: 'httpsImageUrl' }  // Latitude-hosted https image URL only; named NPC only
{ type: 'npc-placement', npc: 'npcName', operation: 'moveHere' | 'moveAway' }  // Into the party's scene / off-stage (last-seen recorded)
{ type: 'npc-placement', npc: 'npcName', operation: 'moveTo', location: 'name', area: 'name' }  // moveTo requires both location and area
```

### Music Effects

```typescript
{ type: 'music-track-set', trackId: 'trackId' }  // Overrides music with a track from gameplayMusicSettings.tracks
{ type: 'music-track-clear' }  // Clears the override, returning music to AI selection
```

### Game Ending Effects

```typescript
{ type: 'win-game' | 'lose-game' | 'end-game', endScope?: 'game' | 'players', othersOutcome?: 'won' | 'lost' | 'ended' }
// Ends the game with outcome won/lost/ended. endScope 'players' ends only the players who satisfy the trigger; default 'game' ends the whole game
// othersOutcome (game scope only): outcome for everyone who did NOT satisfy the trigger
// With endScope 'players', players whose game already ended are skipped and the trigger's fire count is not used up, so it can still fire for other players later
```

### Write Effects (to triggerWritable)

```typescript
{ type: 'write-string' | 'write-number' | 'write-boolean' | 'write-array', key: 'keyName', operator: '...', value: '...' }
```

## Phase Partitioning

Each trigger evaluates in exactly one phase; first matching row wins:

| Trigger has | Phase |
|-------------|-------|
| `action` or `action-text` condition | Planning (with the actions, before story) |
| `story` or `story-text` condition | State (after story) |
| `action-success-level` condition | Planning (mechanics: after outcomes and combat damage, before story) |
| `phase: 'planning'` | Planning (mechanics, before story) |
| Anything else | State (after story) |

Planning-phase `story` effects reach this turn's narration; State effects shape the next turn. `phase: 'planning'` requires a purely mechanical trigger (`story-text` / `action-text` count as mechanical); mixing it with semantic `story` / `action` conditions is rejected. Details in the reference.

## Per-Player Scoping

Omitting `scope` (or setting `'party'`) keeps the legacy behavior: effects apply to every player. With `scope: 'player'`:

- The engine works out which players individually satisfy the player-scoped mechanical conditions (`player-level`, `player-resource`, `player-traits`, `action-success-level`); for semantic conditions the AI attributes which players the story text supports
- `player-resource` / `player-traits` and the player progression effects apply only to those players (unless `target: 'allPlayers'` is set); story effects address them by name
- If the trigger fired but no players are targetable, it is suppressed — no effects run and a one-shot trigger keeps its slot

Firing itself is unchanged: a mechanical player condition still fires when at least one player satisfies it.

## Important Gotchas

- **Turn 0**: `story` effects on tick 0 do NOT affect initial story. Use `storyStart` text or tick 1+ triggers
- **Recurring**: Without `recurring: true`, triggers fire only once ever
- **Identical story instructions deduplicate**: two triggers firing with the same `story` instruction text produce ONE instruction to the AI — duplicating an effect for emphasis does not work
- **Host / DM input**: `action` and `action-text` conditions only evaluate real player inputs — host and DM story directions are ignored
- **Missing subjects match nothing**: an NPC condition whose NPC is absent, off-stage, or unresolved, a `skill-value` check on a character without the skill, and `action-success-level` on a simple or unevaluated action all match no operator, `notEquals` included
- **Reserved names**: trigger names starting `__generated_quest_progress__/` belong to engine-generated quest progress and cannot be authored

## Schema

```typescript
interface Trigger {
  name: string
  conditions: TriggerCondition[]
  effects: TriggerEffect[]
  recurring?: boolean
  scope?: 'party' | 'player'
  phase?: 'planning' | 'state'
  script?: string
}
```

## Reference

For detailed documentation, see [triggers-reference.md](references/triggers-reference.md).
