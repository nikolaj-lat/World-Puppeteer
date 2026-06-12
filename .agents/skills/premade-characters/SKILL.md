---
name: premade-characters
description: Schema and rules for creating premade characters
context: fork
agent: premade-characters
---

# Premade Characters

Edit `tabs/premade-characters.json`.

Premade characters are ready-to-play character options shown during character creation. They give players a curated on-ramp into the world — attributes, traits, and backstory pre-filled — versus rolling their own from scratch.

Unlike every other tab, `premadeCharacters` is a **JSON array** (not a keyed object), because display order matters in character creation.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `name` | Character name — also serves as the identifier |
| `gender` | Character gender (normalized to `"male"`, `"female"`, or `"non-binary"`) |
| `description` | The character's full background. Shown in the selection UI and sent verbatim to the story AI as the character's `Background:` every turn |
| `traits` | Trait names from `tabs/traits.json`. Traits are how you shape the character's stats — attribute modifiers, skills, resource maxes, abilities, and starting items all come through traits |
| `portraitUrl` | Image URL for the character portrait. Always provide — avoids the cost and latency of a portrait generation on first play |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `replacesNpc` | Name of an NPC in `tabs/npcs.json` — when this premade is selected, that NPC is removed from the world |

## Never Include

- `backstory` — redundant with `description`. Everything goes in `description`. See "Why only `description`" below.
- `attributes` — shape the character through `traits` instead. Trait `attributes` modifiers stack on top of the world's default baseline, so a well-designed trait set gives the same result without hard-coding numbers that can drift from world settings.

## replacesNpc Guidance

Use `replacesNpc` when a premade character *is* one of the world's existing NPCs — so selecting "Lyra the Ranger" removes the Lyra NPC from the world rather than leaving two copies of her running around.

- The value is the NPC's identifier in `tabs/npcs.json` (the object key, which by convention matches the NPC's `name`).
- The NPC is removed at game start (filtered during initialization) and at mid-game join (removed from live state, party, and scene).
- If the NPC doesn't exist in the config, `replacesNpc` is silently ignored.

Only set `replacesNpc` for premades that are *canonically the same character* as the NPC. Don't use it to hide thematically similar NPCs.

## Why only `description`

`backstory` exists in the schema but adds nothing `description` can't already do:

- **Selection UI**: shows `description` to the player.
- **Story AI `Background:`**: uses `description` when `backstory` is absent.
- **Turn-1 lore retrieval**: always uses `description`.

If you set both, `backstory` overrides `description` in the `Background:` slot — but since `description` is required anyway, the only reason to split is if you want the UI blurb and the AI background text to be literally different strings. Don't. Put everything in `description` and skip `backstory`.

## description Format

Write in third person. Any length. This is both the selection-UI text AND the character's ongoing `Background:` in story generation, so it needs to give the story AI enough grounding for how the character speaks, thinks, and fits the world. Lead with a hook (the first sentence or two is what sells the character in the selection list), then expand into history, motivation, and voice.

## Schema

```typescript
interface PremadeCharacter {
  name: string                           // Character name + identifier
  gender: string                         // Normalized to "male" | "female" | "non-binary"
  description: string                    // Full background — shown in selection UI and sent to story AI as Background:
  attributes?: Record<string, number>    // See "Never Include" — shape via traits instead
  traits?: string[]                      // Trait names from tabs/traits.json
  backstory?: string                     // See "Never Include" — redundant with description
  portraitUrl?: string                   // Image URL; player generates if absent
  replacesNpc?: string                   // NPC name from tabs/npcs.json
}
```

## Reference

For detailed documentation, see [premade-characters-reference.md](references/premade-characters-reference.md).
