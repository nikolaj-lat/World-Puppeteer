---
name: world-background
description: Schema and rules for editing world background
context: fork
agent: world-background
---

# World Background

Edit `tabs/world-background.json`.

This is the **main setting description** - the overall tone, context, and foundation of your world. It establishes the mood, genre, and broad context for the AI narrator. This is DISTINCT from `worldLore`, which contains specific discoverable facts.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `worldBackground` | 1-3 paragraphs establishing setting, genre, and core premise |

## Conditional Fields

None - world background has only one field.

## Never Include

This file contains only `storySettings.worldBackground`. Do not add:
- `narratorStyle` (separate config area)
- `worldLore` entries (use world-lore skill instead)
- Character or location details (use appropriate entity configs)

## worldBackground Format

Write 1-3 focused paragraphs covering these elements:

**Paragraph 1: Core Premise**
What kind of world is this? Establish genre, setting type, and the fundamental "hook" that makes this world unique.

**Paragraph 2: Current State**
What is happening now? The political situation, recent events, tensions, or conflicts that players will encounter.

**Paragraph 3: Tone and Atmosphere** (optional)
How should the world feel? Dark and gritty? Whimsical? Morally complex? Guide the AI's narrative voice.

Format: "This is a [genre] world where [unique premise]. [Current situation]. [Atmosphere/tone]."

## Writing Guidelines

**Be Specific, Not Exhaustive**
- Focus on what makes THIS world different from generic settings
- Include key rules that the AI must respect (e.g., "magic is outlawed")
- Skip common fantasy/scifi tropes the AI already knows

**Establish Constraints**
- What CAN'T exist or happen in this world?
- What technologies/magic are unavailable?
- What social structures or taboos define behavior?

**Set Emotional Tone**
- Is hope common or rare?
- Are institutions trustworthy or corrupt?
- Is violence normalized or shocking?

**Avoid These Pitfalls**
- Listing every faction/region (use entity configs for that)
- Long historical timelines (use worldLore for history)
- Mechanical rules (use settings configs)
- Character descriptions (use NPC configs)

## Schema

```typescript
interface StorySettings {
  storySettings: {
    worldBackground: string  // Main world setting description (5,000 char limit)
  }
}
```

## Reference

For detailed documentation, see [world-background-reference.md](references/world-background-reference.md).
