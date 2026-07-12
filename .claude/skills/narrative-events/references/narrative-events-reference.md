# Narrative Events Reference

Complete documentation for `tabs/narrative-events.json`.

Narrative events are cinematic, multi-turn scripted sequences the narrator plays out beat by beat. `narrativeEvents` is a required top-level world section; it lives in its own tab file, `tabs/narrative-events.json`.

## Schema

```typescript
interface NarrativeEventDefinition {
  title: string                 // ✅ Display name of the event
  beats: string                 // ✅ The scripted beats/outline the narrator plays out
  targetTurns?: number          // ✅ Optional pacing target; recommended 2-4
  onCompleteEffects?: Effect[]  // ✅ Applied when the event completes; same effect objects as triggers
}
```

## Runtime Schema

```typescript
interface NarrativeEvent {
  // === FROM DEFINITION (preserved via spread) ===
  title: string                 // ✅ From definition
  beats: string                 // ✅ From definition
  targetTurns?: number          // ✅ From definition
  onCompleteEffects?: Effect[]  // ✅ From definition

  // === ENGINE-MANAGED ===
  id: string                    // ❌ Derived from the record key
  status: NarrativeEventStatus  // ❌ Always 'inactive' at creation
  turnsActive: number           // ❌ Always 0 at creation, counts active turns
  completedTick?: number        // ❌ Set when the event completes
  startingLocation?: string     // ❌ Captured when the event starts
}

type NarrativeEventStatus = 'inactive' | 'active' | 'stopped' | 'completed'
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread
- ❌ **Always overwritten**: Set by the engine regardless of what exists in config

## Event Lifecycle

```
inactive -> active -> completed
              ^  \
              |   stopped
              |      |
              +------+  (auto-resume)
```

| Status | Description | How to Reach |
|--------|-------------|--------------|
| `inactive` | Event exists but has never started | Default at creation |
| `active` | Beats are being played out each turn | A trigger's `narrative-event-start` effect fires |
| `stopped` | Player disengaged mid-event; can auto-resume | AI judges disengagement during an active event |
| `completed` | Intended outcome happened, all material beats expressed | AI judges completion, or the hard turn cap is reached |

## Starting an Event

There is exactly one start mechanism: a trigger with effect `narrative-event-start {eventId}`.

- Only ONE event can be active at a time. A start effect that fires while another event is active is **silently ignored** — the start is not queued.
- Starting captures the party's current location as the event's starting location (used to judge disengagement).
- A stopped event resumes rather than restarts (see Resuming and Restarting).

## While Active

Each turn an event is active:

- The event's beats are injected into story generation and NPC behavior
- The story gets extra length allowance
- NO new generated quests are offered until the event ends
- `turnsActive` increments

**Player-agency rule**: the narrator will not force unresolved beats if the player refuses, leaves, or disengages. Beats are an outline, not a railroad.

## Pacing (targetTurns)

With `targetTurns: N`, the narrator is told: "aim to complete within N active turns; this is turn X of N — make steady progress each turn".

- **Hard safety valve**: the event is force-completed after 2×N active turns
- Without `targetTurns` there is no forced cap — the event runs until the AI judges it complete or stopped
- Recommended: 2-4

## Completion vs Stop

The AI judges the event each turn it is active:

| Outcome | When | Result |
|---------|------|--------|
| **Complete** | The intended outcome has clearly happened AND all material beats are expressed | Status `completed`, "Narrative Event Completed" status update shown, `onCompleteEffects` applied |
| **Stop** | The player temporarily disengages — leaves the starting location, defers, shifts focus | Status `stopped`, no effects run, no status update |

- Arguing, fighting, or investigating **within** the event is engagement, not disengagement — the event stays active
- If both completion and stop would apply on the same turn, completion wins

## Resuming and Restarting

- A **stopped** event auto-resumes — preserving its turn count — when the conditions of any trigger carrying its `narrative-event-start` effect become true again with no other event active
- A **completed** event can only be restarted by a `recurring` trigger; restarting resets the turn count

## onCompleteEffects

`onCompleteEffects` takes the same effect objects as trigger effects — every effect type and its fields are documented in the triggers reference. They do NOT count against a trigger's effect cap.

Common uses:

- `quest-objective-reveal` / `quest-objective-complete` — advance a quest as the event resolves
- `quest-next-step-set` / `party-next-step-set` — point the player at what comes next
- `player-resource` / `player-traits` — grant rewards or consequences
- `narrative-event-start` — chain into a follow-up event (only starts if no other event is active)
- `quest-init` — make a follow-up quest available

## Interactions with Quests and Triggers

- **Quests can complete off events**: a quest's completion condition can be `{type: 'narrative-event-completed', eventId}` — the quest's main objective is satisfied when the event completes (see the quests skill)
- **Triggers can branch on event state**: the `narrative-event-status` condition compares the event's status (`inactive | active | stopped | completed`) with string operators

## Recommendations

- At most ~4 events per world; keep beats focused

## Cross-References

| Field | Referenced By |
|-------|---------------|
| Event key (`eventId`) | `narrative-event-start` effects in `tabs/triggers.json` |
| Event key (`eventId`) | `narrative-event-status` conditions in `tabs/triggers.json` |
| Event key (`eventId`) | Quest completion conditions of type `narrative-event-completed` in `tabs/quests.json` |
| `onCompleteEffects[]` fields | Same references as trigger effects — see the triggers reference Cross-References table |
