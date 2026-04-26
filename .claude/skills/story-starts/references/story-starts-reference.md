# Story Starts Reference

Complete documentation for `tabs/story-starts.json`.

## Schema

```typescript
interface StoryStart {
  name: string                      // ✅ Identifier, must match object key
  description: string               // ✅ Player-facing selection text
  storyStart: string                // ✅ Opening narrative for AI to expand
  locations: string[]               // ✅ Valid location keys from locations.json
  locationAreas: string[]           // ✅ Valid area keys, or [] for any area
  startingQuests?: string[]         // ✅ Quest names to set as 'available'
  firstQuest?: string               // ✅ Freeform instruction for AI quest generation on turn 0
  startingItems?: InventoryDefinition[]  // ✅ Additional starting items
  startingPartyNPCs?: string[]      // ✅ NPC keys that join party at start
  isDefault?: boolean               // ✅ Pre-selected in character creation
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread

## InventoryDefinition Schema

```typescript
interface InventoryDefinition {
  item: string         // Item name from items.json
  quantity: number     // Number of items to grant
}
```

Used by `startingItems` to specify additional inventory items.

## Initialization Lifecycle

When a game starts with a story start, fields are processed in this order:

### 1. Quest Registration

```
All world config quests -> created with status: 'hidden'
      |
startingQuests quests -> status changed to 'available'
      |
firstQuest -> on turn 0, injects instruction into AI quest generation
```

**Key difference:**
- `startingQuests`: Array of quest names from `tabs/quests.json` - immediately sets their status to `'available'`
- `firstQuest`: Freeform text instruction - forces AI to generate a quest matching this description on turn 0

These are independent systems.

### 2. Location Selection

```
locations array provided?
    |-- Yes -> Pick random location from array
    |          |-- Filter locationAreas to those in chosen location
    |              |-- Pick random area from filtered list
    |-- No -> Pick random region
               |-- Pick random location in region
                   |-- Pick random area in location
```

**locationAreas behavior:**
- Empty `[]` or omitted: ALL areas in the location are valid
- Non-empty array: Only listed areas (that exist in location) are candidates
- One area is randomly selected from valid candidates

### 3. Party NPC Setup

For each NPC key in `startingPartyNPCs`:
1. Find NPC by name in game state
2. Move NPC to starting location/area
3. Add to `partyState.partyMembers`
4. Set `npc.known = true` (appears in journal)

NPCs that don't exist in the config are silently skipped.

### 4. Starting Items

Items are added in priority order (all sources combined):
1. `itemSettings.startingItems` - Global starting items
2. Trait `startingItems` - From selected traits (deduplicated)
3. Story start `startingItems` - Story-specific items
4. Skill `startingItems` - From learned skills

All items are automatically equipped if valid slots are available.

### 5. Party State

After processing, `partyState` is initialized:
```typescript
partyState.currentLocation = location.name
partyState.currentLocationArea = area
partyState.currentRegion = location.region
partyState.currentRealm = region.realm
partyState.currentCoordinates = [location.x, location.y]
partyState.day = 1              // Always 1
partyState.timeOfDay = ''       // Always empty
partyState.musicMood = 'peaceful'     // Always peaceful
```

### 6. Initial Narrative

The `generateInitialStart` AI task uses:
- `storyStart.storyStart` text as the base narrative
- Starting party NPCs included in context
- Current location and area details
- Player character backgrounds
- Narrator style configuration

## Cross-References

| Field | References |
|-------|------------|
| `locations` | `tabs/locations.json` (keys, not names) |
| `locationAreas` | `areas` object within referenced locations |
| `startingQuests` | `tabs/quests.json` (quest names) |
| `firstQuest` | Freeform text (no reference) |
| `startingItems[].item` | `tabs/items.json` (item names) |
| `startingPartyNPCs` | `tabs/npcs.json` (keys, not names) |
