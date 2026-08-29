# AI Instructions Reference

Complete documentation for `tabs/ai-instructions.json`.

## Schema

```typescript
interface AIInstructionsTab {
  aiInstructions: Record<string, Record<string, string>>
  narratorStyle: string
  gameModes: Record<string, GameMode>
  imagePromptConfiguration?: {
    npcs?: string
    locations?: string
    areas?: string
    regions?: string
    items?: string
  }
  resourceSettings: Record<string, Resource>
  death: {
    permadeath: boolean
    instructions: string
  }
}
```

## aiInstructions

Task-keyed object where each task contains instruction key-value pairs.

```typescript
aiInstructions: {
  [taskKey]: {
    [instructionKey]: string
  }
}
```

### Processing Order

1. Load base instructions for the task
2. Load world config overrides for the task
3. For editable keys: use the override if the key is present (an empty string `""` blanks that section; it does not fall back), otherwise use the default
4. Keys whose name matches an engine-owned (non-editable) section are stripped on save and ignored
5. Add any remaining keys from world config as custom sections (appended after the built-in ones)
6. Concatenate all non-empty instructions

### Editable Keys

| Task | Editable Keys |
|------|---------------|
| `generateStory` | `How to Use the Narrator`, `Turn Structure`, `Turn Boundaries and Endings`, `Player Agency`, `Combat Narration`, `Victory and Downtime`, `Character Behavior`, `Style Principles`, `custom` |
| `generateInitialStart` | `Opening Structure`, `Style Principles`, `custom` |
| `generateActionInfo` | `custom` |
| `generateCharacterBackground` | `prompt`, `custom` |
| `generateNPCIntents` | `core_principles`, `when_to_generate`, `what_is_not_action`, `description_economy`, `summary_established_beats`, `action_format`, `story_driver`, `custom` |
| `generateNewNPC` | `custom` |
| `generateNPCDetails` | `character_creator_instructions`, `personality_archetype_information`, `style`, `cliche_avoidance`, `hidden_info`, `personality`, `faction_affiliation`, `abilities`, `basic_info`, `custom` |
| `generateNPCUpdates` | `relationship_change_updates`, `party_management`, `custom` |
| `generateLocationDetails` | `custom` |
| `generateRegionDetails` | `custom` |
| `generateEncounters` | `custom` |
| `ItemGenerationAndUsage` | `custom` |
| `summarization` | `custom` |
| `generateLearnedAbilities` | `custom` |

Keys are case-sensitive and must match exactly. Setting an editable key to `""` blanks that section rather than restoring the default. Keys that collide with an engine-owned section name are stripped on save; any other key is appended as a custom section.

### Reserved section names

Each task also has prompt sections the engine writes itself; only the keys in the table above are editable. The engine-owned names are reserved: a config key that happens to use one is stripped on save and never reaches the prompt. If a custom key disappears after saving, it collided with a reserved name; rename it.

### generateStory

Main story narration for game turns.

| Key | Purpose |
|-----|---------|
| `How to Use the Narrator` | What Narrator lines are for — setting the scene, describing new elements and outcomes, then getting out of the way |
| `Turn Structure` | How a turn is built: which beats it covers, how much happens, and how Narrator and Character lines alternate |
| `Turn Boundaries and Endings` | Where a turn stops and hands control back to the player; no resolving the player's next move for them |
| `Player Agency` | Respecting player intent: never overriding the player's stated action, speech, or decisions |
| `Combat Narration` | How to narrate attacks, hits, misses, and outcomes using the resolved mechanics |
| `Victory and Downtime` | How to handle scene resolution after combat or major story beats — pacing of cooldown, recovery, and transition |
| `Character Behavior` | How characters act, speak, and interact |
| `Style Principles` | Writing style, tone, and formatting |
| `custom` | World-specific additions (speech patterns, magic rules, etc.) |

### generateInitialStart

Opening scene for new games.

| Key | Purpose |
|-----|---------|
| `Opening Structure` | How to structure the opening narrative |
| `Style Principles` | Writing style for the opening |
| `custom` | World-specific additions |

The engine keeps the opening calm on its own (it will not raise the stakes or force problems into a quiet starting situation); write `Opening Structure` with that in mind rather than trying to override it.

### generateActionInfo

Assesses action difficulty and determines skill checks.

### generateCharacterBackground

Generates character backstory and appearance during character creation. An undefined `prompt` falls back to the built-in default. Set `prompt` to `""` (empty string) to blank the default without replacing it.

The generated `appearance` is a portrait-only prompt: it exists to feed the image generator (face, build, clothing, palette), not to carry story facts. Anything about a character's look that should matter in play (a missing hand, a faction brand, a famous scar) belongs in the background text, where the narrator reads it.

| Key | Purpose |
|-----|---------|
| `prompt` | The full character profile generator prompt — covers overall guidance, background, the portrait-only appearance, style, structure, context use, and any final notes in one block. Replaces the built-in default when set. |
| `custom` | World-specific additions (appended after `prompt`) |

### generateNPCDetails

Generates NPC personality, abilities, and hidden info. Every built-in section is editable:

| Key | Purpose |
|-----|---------|
| `character_creator_instructions` | Overall role and goal of the NPC detail writer |
| `personality_archetype_information` | How to pick and blend personality archetypes |
| `style` | Prose style for the generated fields |
| `cliche_avoidance` | Patterns and tropes to avoid |
| `hidden_info` | What `hiddenInfo` must contain (background, personality, combat) |
| `personality` | How to write the personality summary |
| `faction_affiliation` | How faction membership shapes the NPC (factions are read-only context; the task never invents one) |
| `abilities` | How many abilities to generate and how to format them |
| `basic_info` | How to write the public-facing basic info |
| `custom` | World-specific additions |

### generateNPCUpdates

Applies NPC state changes after each turn: relationship shifts, party joins and departures, status changes.

| Key | Purpose |
|-----|---------|
| `relationship_change_updates` | When and how far relationship values move in response to what happened |
| `party_management` | When NPCs join, follow, or leave the party |
| `custom` | World-specific additions |

### generateLocationDetails

Generates location descriptions, areas, and paths.

### generateRegionDetails

Generates region descriptions and locations.

### generateEncounters

Generates wilderness encounter options.

### generateNPCIntents

Generates NPC intent decisions for what NPCs do on their turns.

### generateNewNPC

Generates new NPCs dynamically during gameplay.

### ItemGenerationAndUsage

World-specific guidance on items — how they are discovered, generated, obtained, used, consumed, equipped, transformed, and removed. Appended to the engine's item-update and item-definition prompts so the AI honors the world's economy, magic system, and item conventions when handling player inventory and creating new items mid-game. Custom-only.

### summarization

Condenses past story into the running summary the narrator reads. Custom-only; use it to name what must never be dropped from summaries (standing oaths, faction standing, unresolved debts).

### generateLearnedAbilities

Defines abilities characters learn mid-game. Custom-only; use it for world rules on what can be learned and how learned abilities should be named and scoped.

## storySettings

Story-level configuration that applies across all narrative tasks.

```typescript
storySettings: {
  worldBackground: string           // World background description (required)
  questGenerationGuidance?: string  // Guidance for AI quest and arc generation (optional)
}
```

### questGenerationGuidance

Optional free-form text injected into `generateProblemDetails` and `generateNewQuests` AI tasks as "Creator quest generation guidance". Use this to steer the themes, tone, or constraints of AI-generated quests and arcs.

## narratorStyle

Single string defining the overall narrator voice. Applies to all narrative output.

```typescript
narratorStyle: string
```

Example:
```
- Prioritize plot and dialogue over description
- Show story through what characters say and do
- Keep scenes dialogue-heavy but natural
- Describe what characters DO, not how well they do it
```

## gameModes

Player-selectable modes that re-shape how the story is told. The player picks one at character creation, and its `instructions` are injected into the narrator's storytelling for the whole game — layered on top of `narratorStyle`. Use game modes for distinct ways to experience the same world (e.g. "Classic Adventure", "Pure Roleplay", "Hardcore Survival"), where each mode wants a different narrative emphasis or tone.

```typescript
interface GameMode {
  name: string                 // ✅ Display name shown in the mode picker
  description: string          // ✅ One-line summary shown under the name
  instructions: string         // ✅ Storytelling guidance injected into narration for this mode
  difficulty?: string          // ✅ Optional. Sets the DEFAULT mechanical difficulty for players who pick this mode. Use one of: "very easy" | "easy" | "medium" | "hard" | "very hard". The player can still override it in Advanced Settings
  askTheNarratorPrompt?: string // ✅ Optional message shown when the player asks the narrator for help. Falls back to a default help message if omitted
  npcIntentInstructions?: string // ✅ Optional guidance layered onto NPC intent generation while this mode is selected, the intent-side counterpart of `instructions`
}
```

`gameModes` is keyed by an id you choose (e.g. `"classic"`).

**What a game mode does to narration:** when the player has a mode selected and that mode has `instructions`, those instructions are added to the narrator's prompt as an extra guidance block on top of the base narration and `narratorStyle`. Defining and selecting a mode therefore *adds* instructions that wouldn't otherwise be present.

**Default behavior (no game mode):** if a world defines no game modes, or the player has none selected, the narrator runs on its base narration instructions plus `narratorStyle` only — no extra mode block is added. When the player asks the narrator for help and no `askTheNarratorPrompt` is set, a built-in default help message is shown.

**What `npcIntentInstructions` does:** while the mode is selected, this text is added to the NPC intent prompt on top of the base intent instructions and any `generateNPCIntents` overrides, so a mode can change how NPCs behave (aggression, how often bystanders act, how quickly scenes escalate) without touching the world-wide intent instructions. Omit it and NPC intents run on the world-wide instructions alone.

**What `difficulty` does:** it presets the game's mechanical difficulty for players who pick the mode. The five valid values are `very easy`, `easy`, `medium`, `hard`, and `very hard`, which scale NPC health and damage (e.g. `very easy` ≈ half NPC HP, `very hard` ≈ 1.5× NPC HP). Selecting the mode fills in this difficulty automatically; the player can still change it in Advanced Settings before starting. Use one of the five values — other strings are passed through but won't map to the difficulty display.

Example:
```json
{
  "classic": {
    "name": "Classic Adventure",
    "description": "Balanced storytelling with action, exploration, and dialogue.",
    "instructions": "Balance combat, exploration, and character moments. Keep momentum toward the player's goals.",
    "difficulty": "medium"
  },
  "roleplay": {
    "name": "Pure Roleplay",
    "description": "Slow-burn, character-driven scenes with minimal combat.",
    "instructions": "Emphasize dialogue, relationships, and introspection. Let scenes breathe. Avoid forcing combat.",
    "npcIntentInstructions": "NPCs favor conversation over confrontation. Bystanders rarely act unless addressed."
  }
}
```

## imagePromptConfiguration

Optional per-entity-type instructions that steer how Voyage generates images for your world. Each entry is a free-text instruction block (like `narratorStyle`, but for images) that is injected into the image-generation task for that entity type:

```typescript
imagePromptConfiguration?: {
  npcs?: string                  // ✅ Art-direction instructions for NPC portraits
  locations?: string             // ✅ Art-direction instructions for location images
  areas?: string                 // ✅ Art-direction instructions for area images
  regions?: string               // ✅ Art-direction instructions for region map images
  items?: string                 // ✅ Art-direction instructions for item images
}
```

Use it to lock a consistent art style, framing, palette, or rendering technique across all generated images of a given type. Leave a field blank or omit it to fall back to the default image instructions for that type. Which model renders the images is a separate choice, set by `imageModelSource` in the settings tab.

Example:
```json
{
  "npcs": "Painterly oil-portrait style, warm candlelit lighting, head-and-shoulders framing, muted earth tones.",
  "locations": "Wide establishing shots, moody atmospheric fog, cinematic depth of field.",
  "items": "Single object on a plain dark background, soft studio lighting, no hands or characters."
}
```

## resourceSettings

Character resources like health, mana, stamina. Keys must be lowercase.

```typescript
resourceSettings: Record<string, Resource>

interface Resource {
  name: string                    // Display name
  initialValue: number            // Starting value (usually 0, traits add to this)
  maxValue: number                // Level-1 maximum (usually 0, traits add to this)
  gainPerLevel: number            // Amount added to max per character level
  rechargeRate: number            // Amount restored per tick
  restRechargeMultiplier: number  // Multiplier when resting
  color: string                   // Hex color for UI
  isHealth?: boolean              // Only ONE resource should have this
  usageInstructions?: string      // AI guidance for modifications
}
```

### isHealth

Exactly one resource must have `isHealth: true`. This resource:
- Determines death/unconsciousness when at 0
- Receives damage from combat
- Displays as the health bar
- Uses special NPC calculation

### usageInstructions

AI guidance for when/how to modify each resource:

```
### Health Changes
- Small injuries: -1 to 15% player health
- Medium injuries: -5 to 25% player health
- Massive injuries: -15 to 50% player health
- Healing potions: +30 to +40
```

### Example

```typescript
resourceSettings: {
  "health": {
    name: "Health",
    initialValue: 0,
    maxValue: 0,
    gainPerLevel: 10,
    rechargeRate: 1,
    restRechargeMultiplier: 1,
    color: "#ef4444",
    isHealth: true,
    usageInstructions: "..."
  }
}
```

## death

Character death and resurrection configuration.

```typescript
death: {
  permadeath: boolean    // true = permanent death
  instructions: string   // Resurrection narrative (if permadeath: false)
}
```

### permadeath: true

- Character death is permanent
- Game ends when all party members die
- `instructions` field is ignored

### permadeath: false

- Characters can be resurrected
- `instructions` guide the resurrection narrative

Example instructions:
```
Death is not the end, but the resurrection comes with a price. The character returns changed—perhaps they've lost a memory, gained a scar, or made a deal with something dark. Make the return dramatic and consequential.
```

## Cross-References

| Field | References |
|-------|------------|
| `resourceSettings` keys | Used in triggers, abilities, trait modifiers |
| `resourceSettings[].isHealth` | Used by death system, combat |
