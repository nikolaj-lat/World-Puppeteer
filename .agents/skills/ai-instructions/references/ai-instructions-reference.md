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
    regions?: string
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
3. For editable keys: use override if provided, otherwise use default
4. Add any custom keys from world config (appended to defaults)
5. Concatenate all non-empty instructions

### Editable Keys

| Task | Editable Keys |
|------|---------------|
| `generateStory` | `Victory and Downtime`, `Character Behavior`, `Style Principles`, `custom` |
| `generateInitialStart` | `Opening Structure`, `Style Principles`, `custom` |
| `generateActionInfo` | `custom` |
| `generateCharacterBackground` | `prompt`, `custom` |
| `generateNPCDetails` | `custom` |
| `generateLocationDetails` | `custom` |
| `generateRegionDetails` | `custom` |
| `generateFactionDetails` | `custom` |
| `generateEncounters` | `custom` |
| `generateNPCIntents` | `custom` |
| `generateNewNPC` | `custom` |
| `ItemGenerationAndUsage` | `custom` |

Keys are case-sensitive and must match exactly.

### generateStory

Main story narration for game turns.

| Key | Purpose |
|-----|---------|
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

### generateActionInfo

Assesses action difficulty and determines skill checks.

### generateCharacterBackground

Generates character backstory and appearance during character creation. An undefined `prompt` falls back to the built-in default. Set `prompt` to `" "` (single space) to disable the default without replacing it.

| Key | Purpose |
|-----|---------|
| `prompt` | The full character profile generator prompt — covers overall guidance, background, appearance, style, structure, context use, and any final notes in one block. Replaces the built-in default when set. |
| `custom` | World-specific additions (appended after `prompt`) |

### generateNPCDetails

Generates NPC personality, abilities, and hidden info.

### generateLocationDetails

Generates location descriptions, areas, and paths.

### generateRegionDetails

Generates region descriptions, factions, and locations.

### generateFactionDetails

Generates faction details including leader, base, and secrets.

### generateEncounters

Generates wilderness encounter options.

### generateNPCIntents

Generates NPC intent decisions for what NPCs do on their turns.

### generateNewNPC

Generates new NPCs dynamically during gameplay.

### ItemGenerationAndUsage

World-specific guidance on items — how they are discovered, generated, obtained, used, consumed, equipped, transformed, and removed. Appended to the engine's item-update and item-definition prompts so the AI honors the world's economy, magic system, and item conventions when handling player inventory and creating new items mid-game. Custom-only.

## storySettings

Story-level configuration that applies across all narrative tasks.

```typescript
storySettings: {
  worldBackground: string           // World background description (required)
  questGenerationGuidance?: string  // Guidance for AI quest and arc generation (optional, max 5000 chars)
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
}
```

`gameModes` is keyed by an id you choose (e.g. `"classic"`).

**What a game mode does to narration:** when the player has a mode selected and that mode has `instructions`, those instructions are added to the narrator's prompt as an extra guidance block on top of the base narration and `narratorStyle`. Defining and selecting a mode therefore *adds* instructions that wouldn't otherwise be present.

**Default behavior (no game mode):** if a world defines no game modes, or the player has none selected, the narrator runs on its base narration instructions plus `narratorStyle` only — no extra mode block is added. When the player asks the narrator for help and no `askTheNarratorPrompt` is set, a built-in default help message is shown.

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
    "instructions": "Emphasize dialogue, relationships, and introspection. Let scenes breathe. Avoid forcing combat."
  }
}
```

## imagePromptConfiguration

Optional per-entity-type instructions that steer how Voyage generates images for your world. Each entry is a free-text instruction block (like `narratorStyle`, but for images) that is injected into the image-generation task for that entity type:

```typescript
imagePromptConfiguration?: {
  npcs?: string        // ✅ Art-direction instructions for NPC portraits
  locations?: string   // ✅ Art-direction instructions for location images
  regions?: string     // ✅ Art-direction instructions for region map images
}
```

Use it to lock a consistent art style, framing, palette, or rendering technique across all generated images of a given type. Leave a field blank or omit it to fall back to the default image instructions for that type.

Example:
```json
{
  "npcs": "Painterly oil-portrait style, warm candlelit lighting, head-and-shoulders framing, muted earth tones.",
  "locations": "Wide establishing shots, moody atmospheric fog, cinematic depth of field."
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
