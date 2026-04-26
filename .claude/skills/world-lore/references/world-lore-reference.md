# World Lore Reference

Complete documentation for `tabs/world-lore.json`.

## Schema

```typescript
interface WorldLoreEntry {
  text: string                    // ✅ The lore content itself
  embeddingId?: string            // ✅ Reference to embeddings record (auto-generated if omitted)
}

// Converted to Memory at runtime
interface Memory {
  text: string                    // ✅ Copied from WorldLoreEntry.text
  embeddingId: string             // ⚠️ Generated if not predefined
  gameTick: number                // ✅ Can be set; worldLore entries identified by gameTick === 0
  lastUsedTick: number            // ⚠️ Set when memory is retrieved
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved at runtime
- ⚠️ **Calculated default**: Generated automatically if not predefined
- ❌ **Always overwritten**: Set by initialization regardless of config

## How Lore is Retrieved

World lore is retrieved via semantic search during story generation.

```
Current Context (player action, story text)
    ↓
Generate embedding for query
    ↓
Compare query embedding to all worldLore embeddings
    ↓
Return top matches by similarity score
    ↓
Inject into AI prompt as "SETTING INFORMATION (NARRATOR-ONLY)"
```

The AI receives matching lore entries as context but treats them as narrator-only knowledge - it won't reveal them directly to players without narrative justification.

## Memory Injection

Retrieved lore is injected as narrator-only context in several AI tasks (character creation, the player's ask-DM helper, action assessment, region detail generation). Each task wraps the lore with a short header before passing it to the model.

## Embedding Generation

Embeddings are 768-dimensional vectors for semantic search.

**Auto-generation (recommended):**
- If `embeddingId` is omitted, embeddings are generated automatically
- No action required from config authors

**Pre-computed (rare):**
```typescript
worldLore: {
  "ancient-history": {
    text: "The kingdom fell 1000 years ago...",
    embeddingId: "ancient-history-emb"
  }
},
embeddings: {
  "ancient-history-emb": [0.123, -0.456, ...]  // 768 numbers
}
```

## Region Filtering

During retrieval, NPC and location memories are filtered by current region. However, **worldLore is not region-filtered** - it's always available for retrieval regardless of player location.

This makes worldLore ideal for:
- Global world rules and history
- Information relevant across multiple regions
- Secrets that should be accessible anywhere

## Cross-References

| Field | References |
|-------|------------|
| `embeddingId` | `embeddings` record in merged config |

## Used By Tasks

| Task | How Used |
|------|----------|
| `generateStory` | Retrieves relevant lore for context |
| `getRelevantMemories` | Searches worldLore via embeddings |
| `embedText` | Generates embeddings if not predefined |
