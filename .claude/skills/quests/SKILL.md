---
name: quests
description: Schema and rules for creating quests
context: fork
agent: quests
---

# Quests

Edit `tabs/quests.json`.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `questSource` | Where the quest originates (NPC name, location, object) |
| `questStatement` | One-sentence description of the situation |
| `mainObjective` | What the player must accomplish (shown in quest log) |
| `questDesignBrief` | 2-4 sentence internal design guidance for the AI — drives NPC, location, and trigger generation for this quest |
| `detailType` | `basic` for AI-generated locations, `detailed` for specific locations |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `completionCondition` | When the quest should complete off story matching or a narrative event: `{ "type": "story", "query": "..." }` or `{ "type": "narrative-event-completed", "eventId": "..." }`. Omit for trigger-driven quests that complete only through explicit `quest-progress` / `quest-complete` effects |
| `initialStatus` | When the quest should start the story as `planned`, `available`, or `accepted` instead of the default `hidden` |
| `spatialRelationship` | Required when `detailType: 'basic'` - defines where quest takes place |
| `questLocation` | For `detailed` quests with a specific location - key from locations.json. Omit for a locationless detailed quest that starts directly in objective mode |
| `questGiverNPC` | Only when a specific NPC gives the quest |
| `objectives` | Only when the quest has an authored objective ladder, revealed/completed via trigger effects |
| `activeObjectiveId` | Only to point at an objective authored with status `active` |
| `nextStep` | Only for initial guidance - normally managed by objective and next-step trigger effects |
| `onCompleteEffects` | When completing the quest should change game state. Same effect objects as triggers, applied once when the quest completes |

## Never Include

Omit these fields (auto-set or runtime-only):
- `questType`
- `id`, `definitionKey`, `creationTick`, `status`, `detectionTick`, `acceptedTick`
- `expiryTick`, `completedTick`, `abandonedTick`, `rejectedTick`
- `startingArea`, `connectingAreaName`, `questAreas`
- `questStepPhase`, `hasVisitedLocation`, `hasVisitedStartingArea`, `objectiveCompleted`
- `offeredAtLocation`, `questGiverNPCKey`, `arcQuestOrdinal`, `contentOrigin`
- `conclusive`, `arcId`, `arcEscalationAtCreation`

## detailType Selection

| Type | Use When | Location Handling |
|------|----------|-------------------|
| `basic` | Quest location should be AI-generated | Uses `spatialRelationship` to generate dynamically |
| `detailed` | Quest has a specific predefined location | Uses exact `questLocation` from locations.json |

Use `detailed` for hand-crafted narrative quests. Use `basic` for procedural or emergent quests.

A `basic` quest whose `questLocation` is blank counts as "already at the location" and advances straight to objectives instead of waiting for travel. A `detailed` quest without a `questLocation` skips travel the same way: it starts directly in objective mode with its `mainObjective` as the current step, and no location is revealed on accept.

## Gating Travel to Quest Locations

Travel to a quest location is treated as simple by default. The narrator only makes it **impossible** when the destination's text explicitly establishes a lock: a boss guarding it, sealed access, a required access item, or authority clearance. A destination that is merely unestablished or dangerous costs at most a skill check. If a quest is meant to gate an area, write the lock into the location or area text (and the quest's `questDesignBrief`) rather than relying on the quest alone.

## spatialRelationship Values

For `basic` quests only - defines where the AI generates the quest location:

| Value | Description |
|-------|-------------|
| `existingLocalArea` | Current location, existing area |
| `newLocalArea` | Current location, new area created |
| `nearbyNewLocation` | New location generated nearby |
| `distantNewLocation` | New location generated far away |
| `existingLocationNewAreas` | Existing location, new areas added |

## mainObjective Format

Write as a player action in imperative form. Shown in the quest log UI.

Format: "[Verb] the [target]" or "[Verb] [what] from/in/at [where]"

## completionCondition Format

An optional object with one of two forms:

- `{ "type": "story", "query": "..." }` — the query is a natural-language description of what "done" looks like; the trigger system matches it semantically against the story. If the query is left empty, no auto-trigger is generated. (Legacy plain-string conditions are auto-converted to this form.)
- `{ "type": "narrative-event-completed", "eventId": "..." }` — the quest completes when the referenced narrative event completes. No auto-trigger is generated. See the narrative-events skill.

Omitting `completionCondition` is a first-class choice for trigger-driven quests: the quest then completes only through explicit effects (`quest-progress` reaching completion, or `quest-complete`) fired by triggers, narrative events, or another quest's `onCompleteEffects`.

## Objectives and Next Steps

Author `objectives` as a record keyed by objective id, typically with `status: 'hidden'`, and reveal/complete them via the `quest-objective-reveal` and `quest-objective-complete` trigger effects — objectives never advance on their own. An objective authored `active` is live from the start; point `activeObjectiveId` at it. `nextStep` is short imperative guidance shown on the quest UI and injected into prompts; it is normally managed automatically by objective effects and the `quest-next-step-set` / `quest-next-step-clear` effects, so only author it for initial guidance. See the reference doc and the triggers skill for full semantics.

## questStatement Format

One sentence describing the situation that creates the quest.

Format: "[Subject] [situation that creates urgency or motivation]"

## Starting Statuses and Making Quests Available

Quests start `hidden` unless `initialStatus` sets a different starting status, applied at world start:

| `initialStatus` | At world start |
|-----------------|----------------|
| `hidden` (default) | Invisible; activate later via story start or triggers |
| `planned` | Invisible, but reserves its storyline against duplicate AI quest generation |
| `available` | On offer from turn 0 |
| `accepted` | Fully accepted at turn 0 (location revealed, party guidance active) |

The AI quest generator avoids duplicating `planned` and `available` quests. To reserve a future quest's storyline, author it `planned` (via `initialStatus` or a `quest-plan` effect); `hidden` keeps it purely invisible.

**Via Story Start** (recommended for starting quests):
```json
"storyStarts": {
  "adventure": {
    "startingQuests": ["rescue-princess", "investigate-ruins"]
  }
}
```

`startingQuests` entries resolve by quest file id or unique name. Hidden quests are promoted to `available` at start; quests already accepted are skipped.

Note: `firstQuest` is a separate freeform text field for AI quest generation - it doesn't reference predefined quests. See the story-starts skill for details.

**Via Trigger** (for unlockable quests):
```json
"triggers": {
  "unlock-quest": {
    "conditions": [{ "type": "story", "query": "Player speaks to the king" }],
    "effects": [{ "type": "quest-init", "operator": "set", "value": "rescue-princess" }]
  }
}
```

Status-moving effects: `quest-plan` (hidden to planned), `quest-init` (hidden or planned to available), `quest-accept` (hidden, planned, or available to accepted; predefined quests only). See the reference doc and the triggers skill.

## Quest Lifecycle

```
Definition -> hidden -> planned -> available -> accepted -> completed
                                       |  \         |
                                       |   rejected |
                                       |       abandoned
                                       |
                                    expired
```

`quest-accept` can move a `hidden` or `planned` quest straight to `accepted`. Re-accepting a concluded quest (`completed`, `abandoned`, `rejected`, `expired`) starts a fresh run: objectives reset to hidden and the previous outcome is cleared, while progress made before first acceptance is kept. Hidden and planned quests can accumulate objective progress silently.

When an `available` quest is offered, the player accepts or rejects it as a single step. An `available` quest with an expiry lapses to `expired` when its expiry tick is reached, the party leaves the location where the quest was offered, or the quest giver dies/leaves the scene. A standing offer without an expiry stays valid indefinitely and keeps discouraging duplicate AI generation.

Detailed quests with a `story`-type `completionCondition` auto-generate a completion trigger from the query. Basic quests need manual triggers. If the query is empty, no auto-trigger is created for either type. Quests with a `narrative-event-completed` condition get no auto-trigger — they complete (if accepted) when the referenced narrative event completes.

## Schema

```typescript
interface QuestDefinition {
  name: string
  questSource: string
  questStatement: string
  mainObjective: string
  completionCondition?: QuestCompletionCondition
  initialStatus?: 'hidden' | 'planned' | 'available' | 'accepted'
  questDesignBrief?: string
  detailType: 'basic' | 'detailed'
  spatialRelationship?: SpatialRelationship
  questLocation?: string
  questGiverNPC?: string
  objectives?: Record<string, QuestObjective>
  activeObjectiveId?: string
  nextStep?: QuestNextStep
  onCompleteEffects?: Effect[]
}

type QuestCompletionCondition =
  | { type: 'story'; query: string }
  | { type: 'narrative-event-completed'; eventId: string }

interface QuestObjective {
  id: string
  text: string
  status: 'hidden' | 'active' | 'completed'
}

interface QuestNextStep {
  text: string
  source: 'objective' | 'narrative-event'
}

type SpatialRelationship =
  | 'existingLocalArea'
  | 'newLocalArea'
  | 'nearbyNewLocation'
  | 'distantNewLocation'
  | 'existingLocationNewAreas'
```

## Reference

For detailed documentation, see [quests-reference.md](references/quests-reference.md).
