# AI Instructions Reference

Complete documentation for `tabs/ai-instructions.json`.

## Schema

```typescript
interface AIInstructionsTab {
  aiInstructions: Record<string, Record<string, string>>
  narratorStyle: string
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
| `generateStory` | `Character Behavior`, `Style Principles`, `custom` |
| `generateInitialStart` | `Opening Structure`, `Style Principles`, `custom` |
| `generateActionInfo` | `custom` |
| `generateCharacterBackground` | `character_profile_generator`, `character_profile_background`, `character_profile_appearance`, `do_not_include`, `style`, `structure`, `context`, `final_notes`, `custom` |
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

Generates character backstory and appearance during character creation. Undefined keys fall back to built-in defaults. Set a key to `" "` (single space) to disable a default without replacing it.

| Key | Purpose |
|-----|---------|
| `character_profile_generator` | Overall character profile generation guidance |
| `character_profile_background` | Background/history generation (3-4 sentences) |
| `character_profile_appearance` | Physical appearance generation (2 sentences) |
| `do_not_include` | Things to exclude from profiles |
| `style` | Writing style for profiles |
| `structure` | Output structure requirements |
| `context` | How to use world/character context |
| `final_notes` | Final guidance notes |
| `custom` | World-specific additions |

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
