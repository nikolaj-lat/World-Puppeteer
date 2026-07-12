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
  completionCondition: QuestCompletionCondition  // ✅ How quest completion is detected (see below)
  questGiverNPC?: string          // ✅ Key from npcs.json
  questDesignBrief?: string       // ✅ Free-form design guidance for AI quest generation
  conclusive?: boolean            // ⚠️ Whether completing this quest concludes its parent arc (default: false)
  objectives?: Record<string, QuestObjective>  // ✅ Authored objective ladder, keyed by objective id
  activeObjectiveId?: string      // ✅ Currently highlighted objective (normally managed by trigger effects)
  nextStep?: QuestNextStep        // ✅ Short guidance shown on the quest UI (normally managed by trigger effects)
}

type QuestCompletionCondition =
  | { type: 'story'; query: string }                        // ✅ Semantic query matched against the story
  | { type: 'narrative-event-completed'; eventId: string }  // ✅ Completes when the referenced narrative event completes

interface QuestObjective {
  id: string                      // ✅ Must match the objectives record key
  text: string                    // ✅ Imperative objective text shown to the player
  status: 'hidden' | 'active' | 'completed'  // ✅ Typically authored 'hidden' and revealed via triggers
}

interface QuestNextStep {
  text: string                    // ✅ Short imperative guidance
  source: 'objective' | 'narrative-event'  // ✅ What is driving this next step
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

## Completion Conditions

`completionCondition` is an object with one of two forms:

| Form | Meaning |
|------|---------|
| `{ "type": "story", "query": "..." }` | The query is a natural-language description of what "done" looks like, matched semantically against the story. Drives the auto-generated completion trigger (see below). |
| `{ "type": "narrative-event-completed", "eventId": "..." }` | The quest completes (if accepted) when the referenced narrative event reaches completed status. `eventId` references the `narrativeEvents` world section (see the narrative-events skill). |

Legacy plain-string completion conditions are auto-converted to the `story` form (`{ "type": "story", "query": "<the string>" }`).

## Quest Runtime Schema

```typescript
interface Quest {
  // === FROM DEFINITION (preserved via spread) ===
  name: string                    // ✅ From definition
  questSource: string             // ✅ From definition
  questStatement?: string         // ✅ From definition
  mainObjective?: string          // ✅ From definition
  completionCondition: QuestCompletionCondition  // ✅ From definition (legacy strings auto-converted to story form)
  questGiverNPC?: string          // ✅ From definition
  spatialRelationship?: SpatialRelationship  // ✅ From definition (basic only)
  questDesignBrief?: string       // ✅ From definition
  conclusive?: boolean            // ⚠️ From definition (default: false)
  objectives?: Record<string, QuestObjective>  // ✅ From definition; advanced only via trigger effects
  activeObjectiveId?: string      // ✅ From definition; dropped at load if it matches no objective
  nextStep?: QuestNextStep        // ✅ From definition; normally managed by objective/next-step trigger effects

  // === CONDITIONALLY SET ===
  questLocation: string           // ⚠️ From definition if detailed, else '' for basic

  // === ALWAYS OVERWRITTEN ===
  id: string                      // ❌ Always generated UUID
  creationTick: number            // ❌ Always current tick
  detailType: 'basic' | 'detailed'  // ❌ Always set from definition
  status: QuestStatus             // ❌ Always 'hidden' at creation
  contentOrigin: 'authored' | 'generated'  // ❌ 'authored' for world-defined quests, 'generated' for engine-created quests

  // === ARC FIELDS (auto-generated for engine quests, survives spread if set) ===
  arcId?: string                  // ✅ Links quest to an Arc (auto-generated for engine quests)
  arcEscalationAtCreation?: number  // ✅ Arc escalation level snapshot at quest creation (auto-generated for engine quests)

  // === RUNTIME STATE (set during gameplay) ===
  questType?: 'acquire' | 'rescue' | 'combat' | 'assassination' | 'social' | 'investigate'  // Quest category (never read by engine)
  detectionTick?: number          // Set when quest becomes available
  acceptedTick?: number           // Set when player accepts
  expiryTick?: number             // Set if quest can expire
  completedTick?: number          // Set when quest completed
  abandonedTick?: number          // Set when quest abandoned
  rejectedTick?: number           // Set when player rejects
  startingArea?: string           // Generated for basic quests
  connectingAreaName?: string     // Area connecting to quest location
  questAreas?: string[]           // Areas created for the quest
  questStepPhase?: 'goToLocation' | 'goToArea' | 'completeObjectives'
  hasVisitedLocation?: boolean    // Tracks if party reached quest location
  hasVisitedStartingArea?: boolean  // Tracks if party reached starting area
  objectiveCompleted?: boolean
  offeredAtLocation?: string      // Location where the quest was offered (engine-set)
  questGiverNPCKey?: string       // Runtime NPC key reference (engine-set)
  arcQuestOrdinal?: number        // Quest's position within its arc (engine-set)
}

type QuestStatus = 'hidden' | 'available' | 'expired' | 'accepted' | 'completed' | 'abandoned' | 'rejected'

type SpatialRelationship =
  | 'existingLocalArea'
  | 'newLocalArea'
  | 'nearbyNewLocation'
  | 'distantNewLocation'
  | 'existingLocationNewAreas'
```

**`contentOrigin`** is a pure label shown on the quest card ("Authored Quest" vs "Generated Quest"). It gates no engine behavior and is always stamped by the engine: quests defined in the world config get `'authored'`, quests the engine generates during play get `'generated'`.

## Quest Lifecycle

```
Definition -> hidden -> available -> accepted -> completed
                            |  \         |
                            |   rejected |
                            |       abandoned
                            |
                         expired
```

| Status | Description | How to Reach |
|--------|-------------|--------------|
| `hidden` | Quest exists but invisible to player | Default at creation |
| `available` | Quest can be discovered/offered | Story start or trigger |
| `accepted` | Player actively pursuing | Player accepts the offer |
| `rejected` | Player declined the offer | Player rejects the offer |
| `completed` | Objectives achieved | Completion trigger fires, or the referenced narrative event completes |
| `abandoned` | Player gave up | Player abandons quest |
| `expired` | Time limit exceeded, party left, or giver gone | See expiry conditions below |

### Quest Acceptance

When an `available` quest is offered, the player either accepts or rejects it as a single step. Acceptance and rejection are immediate (no separate "pending" state).

### Expiry Conditions

An `available` quest expires when any of these become true:

- The expiry tick is reached (3 ticks after the quest was offered)
- The party leaves the location where the quest was offered
- The quest giver dies, becomes incapacitated, or is no longer near the party

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

## Objectives and Next Steps

`objectives` is an authored objective ladder. Objectives advance **exclusively through trigger effects** — no AI decides when an objective is revealed or completed:

- `quest-objective-reveal` sets an objective to `active`, makes it the quest's active objective, and sets the quest's next step to the objective's text.
- `quest-objective-complete` marks the objective `completed` and advances the next step to the next `active` objective (or clears it if none remains).

Revealing or completing an objective produces a player-visible status update when the quest is visible.

**Typical authoring pattern:** author objectives with `status: 'hidden'` and reveal them via triggers as the story progresses. An objective authored with `status: 'active'` is live from the start.

**`activeObjectiveId`** points at the currently highlighted objective. It is normally managed by the reveal/complete effects; set it yourself only to point at an objective you authored as initially `active`. If it matches no objective, it is dropped at load.

**`nextStep`** is short imperative guidance shown on the quest UI and injected into story and NPC prompts ("Next Step: ..."). It is normally managed by the objective effects and the `quest-next-step-set` / `quest-next-step-clear` trigger effects. Next steps with `source: 'narrative-event'` are auto-cleared when the driving narrative event completes or stops. An authored `nextStep` with `source: 'objective'` whose text matches no objective is dropped at load.

**Player-facing next-step display resolution order:** quest `nextStep` text → current objective text → travel-phase fallback → `mainObjective`.

## Detail Types

| Type | Location Handling | Auto-Trigger |
|------|-------------------|--------------|
| `basic` | AI generates via `spatialRelationship` | No - needs manual triggers |
| `detailed` | Uses exact `questLocation` | Yes - from a `story`-type `completionCondition` |

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

For `detailed` quests with a `story`-type `completionCondition`, the system auto-generates a hidden completion trigger:

```typescript
{
  name: `${questId}_objective`,
  recurring: false,
  conditions: [{
    type: 'story',
    query: completionCondition.query,  // Used directly as the semantic trigger query
  }],
  effects: [{
    type: 'quest-progress',
    questId,
  }],
}
```

If the query is empty or whitespace, no trigger is generated — the world creator must create triggers manually in `tabs/triggers.json`.

`narrative-event-completed` conditions build no trigger. Instead, the quest completes (if accepted) once the referenced narrative event completes.

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

## Trigger Effects and Conditions for Quests

Triggers can manipulate quests through these effects (full semantics in the triggers reference — see the triggers skill):

| Effect | Parameters | What it does |
|--------|------------|--------------|
| `quest-objective-reveal` | `questId`, `objectiveId` | Sets the objective `active`, makes it the quest's active objective, sets the quest's next step to its text |
| `quest-objective-complete` | `questId`, `objectiveId` | Marks the objective `completed`, advances the next step to the next active objective (or clears it) |
| `quest-next-step-set` | `questId`, `text`, `source` | Sets the quest's next step directly |
| `quest-next-step-clear` | `questId` | Clears the quest's next step |
| `quest-complete` | `questId` | Silently marks the quest's main objective done — same as `quest-progress` but with no player-visible status line; the quest then completes on the same turn if accepted |
| `party-next-step-set` | `text`, `source` | Party-level guidance shown before any quest is visible |
| `party-next-step-clear` | — | Clears party-level guidance |

The `quest-status` condition (`questId`, `operator`, `value`) compares against the quest's status (`hidden`, `available`, `expired`, `accepted`, `completed`, `abandoned`, `rejected`).

`questId` references resolve by quest key first, then by unique quest name.

## Interaction with Narrative Events

While a narrative event is active, generated-quest creation is fully suppressed — the engine will not offer new generated quests mid-event. Authored quest triggers still fire normally.

## AI Task Usage

| Task | Reads | Writes |
|------|-------|--------|
| Game initialization | quests (definitions) | quests (instances) |
| `generateProblemDetails` | spatialRelationship, questDesignBrief | questLocation, questAreas, startingArea |
| `generateNewQuests` | - | Creates new Quest instances |
| Trigger effects | status | status, objectives, next-step changes |
| UI | All fields for quest log | - |

## Cross-References

| Field | References |
|-------|------------|
| `questLocation` | `tabs/locations.json` |
| `questGiverNPC` | `tabs/npcs.json` |
| `completionCondition.eventId` | Keys in the `narrativeEvents` world section (see the narrative-events skill) |
| `startingQuests` | Keys in `tabs/quests.json` (from story-starts.json) |
| `firstQuest` | Freeform text instruction (NOT a quest key) |
| Quest keys | Referenced by trigger effects `quest-objective-reveal`, `quest-objective-complete`, `quest-next-step-set`, `quest-next-step-clear`, `quest-complete` and condition `quest-status` (see the triggers skill) |
