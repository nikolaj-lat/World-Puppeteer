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
| `completionCondition` | Semantic query text for auto-trigger completion detection |
| `questDesignBrief` | 2-4 sentence internal design guidance for the AI — drives NPC, location, and trigger generation for this quest |
| `detailType` | `basic` for AI-generated locations, `detailed` for specific locations |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `spatialRelationship` | Required when `detailType: 'basic'` - defines where quest takes place |
| `questLocation` | Required when `detailType: 'detailed'` - key from locations.json |
| `questGiverNPC` | Only when a specific NPC gives the quest |

## Never Include

Omit these fields (auto-set or runtime-only):
- `id`, `creationTick`, `status`, `detectionTick`, `acceptedTick`
- `expiryTick`, `completedTick`, `abandonedTick`
- `startingArea`, `connectingAreaName`, `questAreas`
- `questStepPhase`, `hasVisitedLocation`, `hasVisitedStartingArea`, `objectiveCompleted`
- `pendingAcceptance`
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

The semantic text the trigger system matches against the story to detect quest completion. Write as a natural-language description of what "done" looks like.

If left empty, no auto-trigger is generated.

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
                                        |
                                   abandoned/expired
```

Detailed quests auto-generate a completion trigger from `completionCondition`. Basic quests need manual triggers. If `completionCondition` is empty, no auto-trigger is created for either type.

## Schema

```typescript
interface QuestDefinition {
  name: string
  questSource: string
  questStatement: string
  mainObjective: string
  completionCondition: string
  questDesignBrief?: string
  detailType: 'basic' | 'detailed'
  spatialRelationship?: SpatialRelationship  // Required for basic
  questLocation?: string                      // Required for detailed
  questGiverNPC?: string
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
