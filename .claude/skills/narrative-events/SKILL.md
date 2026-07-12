---
name: narrative-events
description: Schema and rules for creating narrative events
context: fork
agent: narrative-events
---

# Narrative Events

Edit `tabs/narrative-events.json`.

Narrative events are cinematic, multi-turn scripted sequences — an ambush, a ritual, a dramatic confrontation — that the narrator plays out beat by beat. While an event is active, its beats steer story generation and NPC behavior until the event completes or the player disengages.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `title` | Display name of the event |
| `beats` | The scripted beats/outline the narrator plays out, in order |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `targetTurns` | When the event should resolve within a set pace. Recommended 2-4. Without it, the event has no forced turn cap |
| `onCompleteEffects` | When completing the event should change game state — reveal quest objectives, set next steps, grant resources, or start follow-up content. Same effect objects as triggers |

## Never Include

Omit these fields (engine-managed at runtime):
- `id` (derived from the record key)
- `status` (starts `inactive`; engine moves it through `active`/`stopped`/`completed`)
- `turnsActive` (engine counter, starts 0)
- `completedTick` (set on completion)
- `startingLocation` (captured when the event starts)

## Starting an Event

There is exactly one start mechanism: a trigger with a `narrative-event-start` effect.

```json
{
  "triggers": {
    "ambush_springs": {
      "conditions": [
        { "type": "party-location", "operator": "equals", "value": "Blackwood Pass" }
      ],
      "effects": [
        { "type": "narrative-event-start", "eventId": "bandit-ambush" }
      ]
    }
  }
}
```

Only ONE event can be active at a time — a `narrative-event-start` effect that fires while another event is active is silently ignored.

## While Active

- The event's beats are injected into story generation and NPC behavior each turn
- The story gets extra length allowance
- NO new generated quests are offered until the event ends
- **Player agency rule**: the narrator will not force unresolved beats if the player refuses, leaves, or disengages

## Pacing with targetTurns

With `targetTurns: N`, the narrator is told to aim to complete within N active turns and to make steady progress each turn. Hard safety valve: the event is force-completed after 2×N active turns. Without `targetTurns` there is no forced cap.

## Completion vs Stop

The AI judges each turn:

- **Complete** when the intended outcome has clearly happened and all material beats are expressed. Status becomes `completed`, a "Narrative Event Completed" status update is shown, and `onCompleteEffects` are applied
- **Stop** when the player temporarily disengages — leaves the starting location, defers, shifts focus (NOT while arguing/fighting/investigating within the event). Status becomes `stopped`, no effects run, no status update
- Completion wins if both would apply

## Resuming and Restarting

- A **stopped** event auto-resumes (preserving its turn count) when the conditions of any trigger carrying its `narrative-event-start` effect become true again with no other event active
- A **completed** event can only restart via a `recurring` trigger; restarting resets the turn count

## Important Gotchas

- **One at a time**: a start effect while another event is active is silently ignored — sequence events with `narrative-event-status` conditions
- **Effects only on completion**: a stopped event runs no effects; put must-happen state changes on separate triggers if they can't wait for completion
- **Keep beats focused**: recommended at most ~4 events per world
- **Quests can complete off events**: give a quest a completion condition of type `narrative-event-completed` with the event's `eventId` (see the quests skill)
- **Branch on event state**: triggers can use the `narrative-event-status` condition (`inactive | active | stopped | completed`)

## Schema

```typescript
interface NarrativeEventDefinition {
  title: string
  beats: string
  targetTurns?: number
  onCompleteEffects?: Effect[]
}
```

## Reference

For detailed documentation, see [narrative-events-reference.md](references/narrative-events-reference.md).
