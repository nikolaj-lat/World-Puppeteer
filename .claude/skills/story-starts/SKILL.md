---
name: story-starts
description: Schema and rules for creating story starts
context: fork
agent: story-starts
---

# Story Starts

Edit `tabs/story-starts.json`.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `description` | One compelling sentence shown during character creation |
| `storyStart` | Opening narrative prompt for the AI (see format below) |
| `locations` | Array of valid location keys - use one for specific starts, multiple for variety |
| `locationAreas` | Array of area keys, or `[]` to allow any area in the location |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `startingQuests` | When the story has immediate objectives for the player |
| `firstQuest` | When you want AI-generated quest details on turn 0 |
| `startingPartyNPCs` | When the player begins with companions |
| `isDefault` | Set `true` on exactly one story start to pre-select it |

## Never Include

Omit these fields (auto-managed):
- `startingItems` (handled by traits and settings - keep story starts narrative-focused)

## description Format

One sentence that helps players choose this starting scenario. Focus on the hook, not mechanics.

Format: "[Situation] - [what makes this start interesting]"

## storyStart Format

The opening narrative prompt passed to the AI. This sets the scene and establishes the player's immediate situation. The AI expands this into the full opening story.

Three-part structure:
1. **Scene** - Where are we? What's the atmosphere?
2. **Situation** - What's happening right now?
3. **Hook** - What pulls the player forward?

## Location Selection Guidance

**Single location** - Use when the story demands a specific starting point:
```json
"locations": ["thornhaven"]
```

**Multiple locations** - Use for variety or "wanderer" style starts:
```json
"locations": ["thornhaven", "riverside-camp", "mountain-pass"]
```

## Quest Integration

**startingQuests vs firstQuest:**
- `startingQuests`: Array of quest names from `tabs/quests.json` - sets them to `'available'` status at game start
- `firstQuest`: Freeform text instruction - on turn 0, forces AI to generate a quest matching this description

These are independent systems. Use `startingQuests` for predefined quests, use `firstQuest` for AI-generated opening quests.

## Schema

```typescript
interface StoryStart {
  name: string
  description: string
  storyStart: string
  locations: string[]
  locationAreas: string[]
  startingQuests?: string[]
  firstQuest?: string
  startingPartyNPCs?: string[]
  isDefault?: boolean
}
```

## Reference

For detailed documentation, see [story-starts-reference.md](references/story-starts-reference.md).
