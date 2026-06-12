---
name: archetypes
description: Schema and rules for archetypes configuration
context: fork
agent: archetypes
---

# Archetypes

Edit `tabs/archetypes.json`.

AI generation enhancement through author styles and archetypes.

## Purpose

Provides carousel seeds for the AI to generate more distinctive NPCs, locations, and encounters. These seeds guide the AI's creative process by offering diverse styles and templates to choose from.

## Field Formats

### authorSeeds
Writing style prompts (19 defaults)
- Format: Multi-line strings with "You show/focus/create/build/reveal" pattern
- 10-20 distinct authorial voices
- Specific techniques, not generic advice

### characterArchetypes
Personality templates (22 defaults)
- Format: Drives, Traits, Morality sections
- Cover spectrum from heroic to villainous
- 15-25 distinct archetypes

### locationArchetypes
Place templates (11 defaults)
- Format: One-sentence evocative descriptions
- Imply atmosphere and function
- 10-15 distinct types

### regionArchetypes
Geographical templates (23 defaults)
- Format: One-sentence evocative descriptions
- Large-scale geographical and cultural patterns
- 15-30 distinct types

### encounterElements
Scenario building blocks (21 categories)
- Format: Comma-separated lists by category
- Organized by complication type
- 15-25 distinct categories

## When to Customize

- World has specific cultural/thematic requirements
- You want to emphasize certain narrative tones
- Default archetypes don't fit your setting
- You need period-specific or genre-specific variations

## When to Keep Defaults

- Generic fantasy/modern/sci-fi settings
- You're prototyping and want to move fast
- Default variety is sufficient for your needs
- You haven't identified specific creative gaps

## Usage in AI Generation

Archetypes are used during:
- **NPC Details generation (strong/elite/boss/mythic tier only)** - AI selects random author seed + character archetype
- **Location Details generation** - AI uses location archetypes
- **Region Details generation** - AI uses region archetypes
- **Encounter generation** - AI draws from encounter elements

## Customization Approach

**Option 1: Augment Defaults**
- Keep existing defaults
- Add 5-10 world-specific entries per field
- Good for prototyping or when defaults mostly fit

**Option 2: Replace Entirely**
- Create complete custom set
- Ensure sufficient variety (match default counts)
- Good for highly specific settings

## Validation

- Author seeds use consistent format
- Character archetypes include all three sections (Drives, Traits, Morality)
- Name pools are large enough (50+ each)
- All fields are populated (no empty records)

## Reference

For detailed documentation, see [archetypes-reference.md](references/archetypes-reference.md).
