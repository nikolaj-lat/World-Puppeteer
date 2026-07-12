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
| `completionCondition` | Object: `{ "type": "story", "query": "..." }` or `{ "type": "narrative-event-completed", "eventId": "..." }` |
| `questDesignBrief` | 2-4 sentence internal design guidance for the AI — drives NPC, location, and trigger generation for this quest |
| `detailType` | `basic` for AI-generated locations, `detailed` for specific locations |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `spatialRelationship` | Required when `detailType: 'basic'` - defines where quest takes place |
| `questLocation` | Required when `detailType: 'detailed'` - key from locations.json |
| `questGiverNPC` | Only when a specific NPC gives the quest |
| `objectives` | Only when the quest has an authored objective ladder, revealed/completed via trigger effects |
| `activeObjectiveId` | Only to point at an objective authored with status `active` |
| `nextStep` | Only for initial guidance - normally managed by objective and next-step trigger effects |

## Never Include

Omit these fields (auto-set or runtime-only):
- `questType`
- `id`, `creationTick`, `status`, `detectionTick`, `acceptedTick`
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

An object with one of two forms:

- `{ "type": "story", "query": "..." }` — the query is a natural-language description of what "done" looks like; the trigger system matches it semantically against the story. If the query is left empty, no auto-trigger is generated. (Legacy plain-string conditions are auto-converted to this form.)
- `{ "type": "narrative-event-completed", "eventId": "..." }` — the quest completes when the referenced narrative event completes. No auto-trigger is generated. See the narrative-events skill.

## Objectives and Next Steps

Author `objectives` as a record keyed by objective id, typically with `status: 'hidden'`, and reveal/complete them via the `quest-objective-reveal` and `quest-objective-complete` trigger effects — objectives never advance on their own. An objective authored `active` is live from the start; point `activeObjectiveId` at it. `nextStep` is short imperative guidance shown on the quest UI and injected into prompts; it is normally managed automatically by objective effects and the `quest-next-step-set` / `quest-next-step-clear` effects, so only author it for initial guidance. See the reference doc and the triggers skill for full semantics.

## questStatement Format

One sentence describing the situation that creates the quest.

Format: "[Subject] [situation that creates urgency or motivation]"

## Making Quests Available

Quests always start as `hidden`. To make them available:

**Via Story Start** (recommended for starting quests):
```json
"storyStarts": {
  "adventure": {
    "startingQuests": ["rescue-princess", "investigate-ruins"]
  }
}
```

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

## Quest Lifecycle

```
Definition -> hidden -> available -> accepted -> completed
                            |  \         |
                            |   rejected |
                            |       abandoned
                            |
                         expired
```

When an `available` quest is offered, the player accepts or rejects it as a single step. An `available` quest expires when its expiry tick is reached (3 ticks after offer), the party leaves the location where the quest was offered, or the quest giver dies/leaves the scene.

Detailed quests with a `story`-type `completionCondition` auto-generate a completion trigger from the query. Basic quests need manual triggers. If the query is empty, no auto-trigger is created for either type. Quests with a `narrative-event-completed` condition get no auto-trigger — they complete (if accepted) when the referenced narrative event completes.

## Schema

```typescript
interface QuestDefinition {
  name: string
  questSource: string
  questStatement: string
  mainObjective: string
  completionCondition: QuestCompletionCondition
  questDesignBrief?: string
  detailType: 'basic' | 'detailed'
  spatialRelationship?: SpatialRelationship
  questLocation?: string
  questGiverNPC?: string
  objectives?: Record<string, QuestObjective>
  activeObjectiveId?: string
  nextStep?: QuestNextStep
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
