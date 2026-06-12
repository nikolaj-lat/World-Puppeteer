# Random Selection Mechanism

A technique for random outcomes using area numbers as selection seeds.

## How It Works

The game randomly assigns a `locationArea` from the story start's `locationAreas` array. This randomness can be "hijacked" to determine outcomes unrelated to physical location.

## Components

### 1. Location with Areas

The location must have areas defined that match the story start's `locationAreas`:

```json
{
  "Some Location": {
    "name": "Some Location",
    "basicInfo": "...",
    "region": "Some Region",
    "areas": {
      "1": { "description": "", "paths": [] },
      "2": { "description": "", "paths": [] },
      "3": { "description": "", "paths": [] },
      "4": { "description": "", "paths": [] },
      "5": { "description": "", "paths": [] }
    }
  }
}
```

The area descriptions can be empty - they exist purely as random seeds, not meaningful spaces.

### 2. Story Start Configuration

```json
{
  "name": "Example Start",
  "storyStart": "Scene description...",
  "locations": ["Some Location"],
  "locationAreas": ["1", "2", "3", "4", "5"],
  "startingQuests": []
}
```

The `locationAreas` array defines the random pool. Game picks one randomly on start. These must match keys in the location's `areas` object.

### 2. Area Tracker Triggers

One trigger per possible area, setting a boolean flag:

```json
{
  "a1": {
    "name": "a1",
    "conditions": [
      { "type": "party-area", "operator": "equals", "value": "1" }
    ],
    "effects": [
      { "type": "write-boolean", "key": "a1", "operator": "set", "value": true }
    ]
  },
  "a2": {
    "name": "a2",
    "conditions": [
      { "type": "party-area", "operator": "equals", "value": "2" }
    ],
    "effects": [
      { "type": "write-boolean", "key": "a2", "operator": "set", "value": true }
    ]
  }
}
```

These fire immediately when the game starts, capturing which area was randomly assigned.

### 3. Selection Triggers

Triggers that check the area flags and apply the actual outcome:

```json
{
  "outcome_a": {
    "name": "outcome_a",
    "conditions": [
      { "type": "action-text", "operator": "contains", "value": "" },
      { "type": "read-boolean", "key": "a1", "operator": "equals", "value": true },
      { "type": "read-boolean", "key": "selected", "operator": "notEquals", "value": true }
    ],
    "effects": [
      { "type": "write-boolean", "key": "selected", "operator": "set", "value": true },
      { "type": "write-string", "key": "outcome", "operator": "set", "value": "a" },
      { "type": "story", "instruction": "Outcome A happens..." }
    ]
  },
  "outcome_b": {
    "name": "outcome_b",
    "conditions": [
      { "type": "action-text", "operator": "contains", "value": "" },
      { "type": "read-boolean", "key": "a2", "operator": "equals", "value": true },
      { "type": "read-boolean", "key": "selected", "operator": "notEquals", "value": true }
    ],
    "effects": [
      { "type": "write-boolean", "key": "selected", "operator": "set", "value": true },
      { "type": "write-string", "key": "outcome", "operator": "set", "value": "b" },
      { "type": "story", "instruction": "Outcome B happens..." }
    ]
  }
}
```

## Key Techniques

### Empty Action-Text Condition

```json
{ "type": "action-text", "operator": "contains", "value": "" }
```

An empty string matches *any* action text. This causes the trigger to fire on the player's first action.

### Lock Flag Pattern

```json
{ "type": "read-boolean", "key": "selected", "operator": "notEquals", "value": true }
```

Prevents the selection from firing multiple times. The first matching trigger sets `selected: true`, blocking all others.

### Storing the Selection (Optional)

```json
{ "type": "write-string", "key": "outcome", "operator": "set", "value": "a" }
```

Only needed if later triggers must check which outcome was selected. Omit if the selection is a one-time effect with no downstream dependencies.

## Timing

1. **Game Start**: Random area assigned from `locationAreas`
2. **Immediately**: Area tracker trigger fires, sets boolean flag (e.g., `a2: true`)
3. **First Player Action**: Selection trigger fires based on which flag is set
4. **Lock**: Selection flag prevents re-firing

## Coordinating Story Start and Selection

The `storyStart` text and selection trigger's `story` instruction must work together:

**Story Start**: Sets up the scene, creates anticipation, but does NOT reveal the random outcome. Ends by prompting the player to take an action that will trigger the selection.

**Selection Trigger**: Delivers the actual outcome when the player acts.

Example flow:

```json
// Story Start
"storyStart": "You kneel in the summoning chamber, ritual circle glowing. The incense smoke thickens. You need only speak the words to call forth your Servant. END SCENE HERE. Wait for player to begin the ritual."

// Selection Trigger (fires on first action)
"instruction": "The circle erupts with light. Your Servant materializes - it is [specific character]. They regard you with [specific demeanor]..."
```

The story start creates the moment *before* the reveal. The selection trigger delivers the reveal itself. This ensures:
- The random selection hasn't happened yet when the scene opens
- The player's action triggers the outcome
- The narrative flows naturally from setup to payoff

## Use Cases

- **Random starting scenario**: Different opening situations from same story start
- **Random companion**: Which NPC joins the player
- **Random mission**: Which of several missions is assigned
- **Random enemy**: Which antagonist targets the player

## Multiple Selection Groups

For independent random selections, use different prefixes:

```json
// Master selection
{ "type": "read-boolean", "key": "master_a1", ... }

// Mission selection
{ "type": "read-boolean", "key": "mission_a1", ... }
```

## Delayed Selection

To trigger selection on a specific action rather than the first action:

```json
{ "type": "action", "query": "player begins the ritual" }
```

This delays selection until the semantic condition matches.

## Example: Random NPC Assignment

**Story Start:**
```json
{
  "name": "The Assignment",
  "storyStart": "You receive orders to report to your new commanding officer...",
  "locations": ["Headquarters"],
  "locationAreas": ["1", "2", "3"]
}
```

**Area Trackers:**
```json
"cmd1": { "conditions": [{ "type": "party-area", "operator": "equals", "value": "1" }], "effects": [{ "type": "write-boolean", "key": "cmd1", "operator": "set", "value": true }] },
"cmd2": { "conditions": [{ "type": "party-area", "operator": "equals", "value": "2" }], "effects": [{ "type": "write-boolean", "key": "cmd2", "operator": "set", "value": true }] },
"cmd3": { "conditions": [{ "type": "party-area", "operator": "equals", "value": "3" }], "effects": [{ "type": "write-boolean", "key": "cmd3", "operator": "set", "value": true }] }
```

**Selection Triggers:**
```json
"assign_stern": {
  "conditions": [
    { "type": "action-text", "operator": "contains", "value": "" },
    { "type": "read-boolean", "key": "cmd1", "operator": "equals", "value": true },
    { "type": "read-boolean", "key": "assigned", "operator": "notEquals", "value": true }
  ],
  "effects": [
    { "type": "write-boolean", "key": "assigned", "operator": "set", "value": true },
    { "type": "write-string", "key": "commander", "operator": "set", "value": "stern" },
    { "type": "story", "instruction": "Your commanding officer is Commander Tanaka, a stern veteran..." }
  ]
}
```

## Combining with Location Changes

Selection can also change the player's location:

```json
"effects": [
  { "type": "party-location", "operator": "set", "value": "New Location" },
  { "type": "story", "instruction": "..." }
]
```

This teleports the player to match the narrative outcome.
