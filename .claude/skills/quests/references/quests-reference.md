# Quests Reference

Complete documentation for `tabs/quests.json`.

## QuestDefinition Schema

```typescript
type QuestDefinition = BasicQuestDefinition | DetailedQuestDefinition

interface QuestBaseDefinition {
  name: string                    // ✅ Quest display name, must match object key
  questSource: string             // ✅ Where quest originates (NPC, location, etc.)
  questStatement: string          // ✅ One-sentence quest description
  mainObjective: string           // ✅ Primary goal text shown in quest log
  completionCondition: string     // ✅ Semantic trigger query for quest completion detection
  questGiverNPC?: string          // ✅ Key from npcs.json
  questDesignBrief?: string       // ✅ Free-form design guidance for AI quest generation
  conclusive?: boolean            // ⚠️ Whether completing this quest concludes its parent arc (default: false)
}

interface BasicQuestDefinition extends QuestBaseDefinition {
  detailType: 'basic'             // ✅ AI generates location details
  spatialRelationship: SpatialRelationship  // ✅ Where to generate location
}

interface DetailedQuestDefinition extends QuestBaseDefinition {
  detailType: 'detailed'          // ✅ Uses predefined location
  questLocation: string           // ✅ Key from locations.json
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread
- ⚠️ **Calculated default**: Has fallback logic if not predefined
- ❌ **Always overwritten**: Set by initialization regardless of what exists in config

## Quest Runtime Schema

```typescript
interface Quest {
  // === FROM DEFINITION (preserved via spread) ===
  name: string                    // ✅ From definition
  questSource: string             // ✅ From definition
  questStatement?: string         // ✅ From definition
  mainObjective?: string          // ✅ From definition
  completionCondition: string     // ✅ From definition
  questGiverNPC?: string          // ✅ From definition
  spatialRelationship?: SpatialRelationship  // ✅ From definition (basic only)
  questDesignBrief?: string       // ✅ From definition
  conclusive?: boolean            // ⚠️ From definition (default: false)

  // === CONDITIONALLY SET ===
  questLocation: string           // ⚠️ From definition if detailed, else '' for basic

  // === ALWAYS OVERWRITTEN ===
  id: string                      // ❌ Always generated UUID
  creationTick: number            // ❌ Always current tick
  detailType: 'basic' | 'detailed'  // ❌ Always set from definition
  status: QuestStatus             // ❌ Always 'hidden' at creation

  // === ARC FIELDS (auto-generated for engine quests, survives spread if set) ===
  arcId?: string                  // ✅ Links quest to an Arc (auto-generated for engine quests)
  arcEscalationAtCreation?: number  // ✅ Arc escalation level snapshot at quest creation (auto-generated for engine quests)

  // === RUNTIME STATE (set during gameplay) ===
  detectionTick?: number          // Set when quest becomes available
  acceptedTick?: number           // Set when player accepts
  expiryTick?: number             // Set if quest can expire
  completedTick?: number          // Set when quest completed
  abandonedTick?: number          // Set when quest abandoned
  startingArea?: string           // Generated for basic quests
  connectingAreaName?: string     // Area connecting to quest location
  questAreas?: string[]           // Areas created for the quest
  questStepPhase?: 'goToLocation' | 'goToArea' | 'completeObjectives'
  hasVisitedLocation?: boolean    // Tracks if party reached quest location
  hasVisitedStartingArea?: boolean  // Tracks if party reached starting area
  objectiveCompleted?: boolean
  pendingAcceptance?: {
    acceptedByPlayer: string
    acceptedTick: number
  }
}

type QuestStatus = 'hidden' | 'available' | 'expired' | 'accepted' | 'completed' | 'abandoned'

type SpatialRelationship =
  | 'existingLocalArea'
  | 'newLocalArea'
  | 'nearbyNewLocation'
  | 'distantNewLocation'
  | 'existingLocationNewAreas'
```

## Quest Lifecycle

```
Definition -> hidden -> available -> accepted -> completed
                             |           |
                             |      abandoned
                             |
                          expired
```

| Status | Description | How to Reach |
|--------|-------------|--------------|
| `hidden` | Quest exists but invisible to player | Default at creation |
| `available` | Quest can be discovered/offered | Story start or trigger |
| `accepted` | Player actively pursuing | Player accepts quest |
| `completed` | Objectives achieved | Completion trigger fires |
| `abandoned` | Player gave up | Player abandons quest |
| `expired` | Time limit exceeded | Expiry tick reached |

## Quest Step Phases

Once accepted, quests track progress through phases:

| Phase | Description |
|-------|-------------|
| `goToLocation` | Player must reach the quest's location (any area within it) |
| `goToArea` | Player must reach a specific area within the location |
| `completeObjectives` | Player is at the correct location/area, working on objectives |

Phase auto-advances when the player reaches the required location or area.

**Tracking fields:**
- `hasVisitedLocation`: Boolean tracking if party ever reached the quest location
- `hasVisitedStartingArea`: Boolean tracking if party ever reached the starting area within that location

**Phase initialization logic:**
- **Local quests** (`existingLocalArea`, `newLocalArea`): Start at `goToArea` phase (player already at location)
- **Remote quests with area navigation** (`existingLocationNewAreas`): Start at `goToLocation`, then transition to `goToArea` once at location
- **Other remote quests** (`nearbyNewLocation`, `distantNewLocation`): Start at `goToLocation`, then skip directly to `completeObjectives` once at location

**Note:** Quest phases and tracking fields are runtime-only. Do not manually set `questStepPhase`, `hasVisitedLocation`, or `hasVisitedStartingArea` in quest definitions - the game engine initializes these automatically based on the quest's `spatialRelationship`.

## Detail Types

| Type | Location Handling | Auto-Trigger |
|------|-------------------|--------------|
| `basic` | AI generates via `spatialRelationship` | No - needs manual triggers |
| `detailed` | Uses exact `questLocation` | Yes - from `completionCondition` |

## Spatial Relationships

For `basic` quests, defines where the AI generates the quest location:

| Relationship | Description |
|--------------|-------------|
| `existingLocalArea` | Current location, existing area |
| `newLocalArea` | Current location, new area created |
| `nearbyNewLocation` | New location generated nearby |
| `distantNewLocation` | New location generated far away |
| `existingLocationNewAreas` | Existing location, new areas added |

## Auto-Generated Triggers

For `detailed` quests, the system auto-generates a completion trigger using the `completionCondition` field:

```typescript
{
  name: `${questId}_objective`,
  recurring: false,
  conditions: [{
    type: 'story',
    query: completionCondition,  // Used directly as the semantic trigger query
    embeddingId: getHeroesUuid(),
  }],
  effects: [{
    type: 'quest-progress',
    questId,
  }],
}
```

If `completionCondition` is empty or whitespace, no trigger is generated — the world creator must create triggers manually in `tabs/triggers.json`.

Basic quests never get auto-generated triggers regardless of `completionCondition`.

## Making Quests Available

Quests start as `hidden`. Two ways to make them `available`:

**Via Story Start:**
```json
{
  "storyStarts": {
    "adventure": {
      "startingQuests": ["rescue-princess", "investigate-ruins"]
    }
  }
}
```

Note: `firstQuest` is a separate freeform text field for AI quest generation - it doesn't reference predefined quests.

**Via Trigger Effect:**
```json
{
  "triggers": {
    "unlock-quest": {
      "conditions": [{ "type": "story", "query": "Player speaks to the king" }],
      "effects": [{ "type": "quest-init", "operator": "set", "value": "rescue-princess" }]
    }
  }
}
```

## AI Task Usage

| Task | Reads | Writes |
|------|-------|--------|
| Game initialization | quests (definitions) | quests (instances) |
| `generateProblemDetails` | spatialRelationship, questDesignBrief | questLocation, questAreas, startingArea |
| `generateNewQuests` | - | Creates new Quest instances |
| Trigger effects | status | status changes |
| UI | All fields for quest log | - |

## Cross-References

| Field | References |
|-------|------------|
| `questLocation` | `tabs/locations.json` |
| `questGiverNPC` | `tabs/npcs.json` |
| `startingQuests` | Keys in `tabs/quests.json` (from story-starts.json) |
| `firstQuest` | Freeform text instruction (NOT a quest key) |
