# World Background Reference

Complete documentation for `tabs/world-background.json`.

## Schema

```typescript
interface StorySettings {
  storySettings: {
    worldBackground: string   // ✅ Core world premise, included in all AI prompts
  }
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread

## How worldBackground is Used

The `worldBackground` string is injected into AI prompts for most generation tasks. It provides essential context that shapes:

- **Narrative tone**: How the AI writes story text
- **World rules**: What exists or doesn't exist
- **Setting boundaries**: Genre expectations and constraints
- **Atmospheric cues**: Mood and emotional register

Unlike `worldLore` entries (which are retrieved via semantic search when relevant), `worldBackground` is **always included** in prompts.

## Relationship to Other Settings

| Setting | Purpose | When to Use |
|---------|---------|-------------|
| `worldBackground` | Core premise, always in context | Essential setting facts the AI needs constantly |
| `narratorStyle` | Voice/tone override | Specific narrative style requirements |
| `worldLore` | Detailed background info | History, lore, details retrieved when relevant |
| `aiInstructions` | Per-task behavior | Fine-tuning specific AI task outputs |

## Tasks That Use worldBackground

| Task | How It's Used |
|------|---------------|
| `generateStory` | Main narrative generation context |
| `generateNPCIntents` | Understanding NPC motivations in context |
| `generatePlayerIntents` | Understanding player action options |
| `generateNPCDetails` | Creating NPC personalities fitting the world |
| `generateQuestDetails` | Creating quests appropriate to setting |
| Most generation tasks | General world context |

## Cross-References

| Field | References |
|-------|------------|
| `storySettings.worldBackground` | Used by all AI generation tasks |
| Related: `narratorStyle` | Separate top-level field |
| Related: `worldLore` | Separate config section for detailed lore |
| Related: `aiInstructions` | Separate config section for task customization |
