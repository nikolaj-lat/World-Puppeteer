---
name: world-lore
description: Schema and rules for creating world lore
context: fork
agent: world-lore
---

# World Lore

Edit `tabs/world-lore.json`.

World lore entries are **specific discoverable knowledge** - facts, history, legends, and secrets that the AI knows and can gradually reveal during gameplay. This is distinct from `worldBackground` (overall setting description).

## Required Fields

| Field | Requirement |
|-------|-------------|
| Object key | Unique Proper Case identifier describing the lore topic (e.g., "The Great Forgetting", "Ancient Bloodlines") |
| `text` | Self-contained, semantically rich paragraph (see format below) |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `embeddingId` | Only when using pre-computed embeddings (rare) |

## Never Include

Omit these fields (auto-generated at runtime):
- `type`, `gameTick`, `lastUsedTick`, `embedding`

## text Format

Write self-contained, semantically rich paragraphs that will match relevant player queries.

Structure: **What + When/Where + Why it matters + Consequences or current state**

Include multiple keywords to improve semantic retrieval during gameplay.

Format: "[Topic] [happened/exists/works]. [Context and details]. [Impact or current relevance]. [Any secrets or implications]."

## Lore Categories

Different types of lore serve different narrative purposes:

**Historical Events** - Past events that shaped the world
- Wars, plagues, catastrophes, founding moments
- Include dates/timeframes and lasting consequences

**World Rules** - How things work in this world
- Magic systems, technology, social customs, laws
- Include costs, limitations, and exceptions

**Faction Secrets** - Hidden knowledge about organizations
- Internal structures, secret goals, recognition signs
- Frame as narrator-only information

**Geographic Knowledge** - Information about places
- Hidden locations, dangerous areas, lost treasures
- Include clues for discovery

## Writing for Retrieval

Lore is retrieved via semantic search based on what's happening in the story. Write entries that will match relevant queries.

**Include keywords** - Multiple synonyms and related terms help retrieval:
- "Healing magic draws from nature. Healers, priests, and druids can channel this power. Healing spells require contact."

**Be specific** - Concrete details are more searchable than vague descriptions:
- Good: "The Dragon Wars of 1180 killed one third of the population"
- Avoid: "A big war happened long ago"

**Self-contained** - Each entry should make sense on its own without requiring other entries.

## Narrator-Only Secrets

For information the AI should know but not reveal directly, frame it explicitly:

"Lord Aldric is secretly working for the enemy. He passes information through his servant Marcus. The party should not learn this until they discover evidence themselves."

The AI uses this for consistent behavior but won't reveal prematurely.

## Schema

```typescript
interface WorldLoreEntry {
  text: string           // The lore content (max 4,000 chars)
  embeddingId?: string   // Reference to pre-computed embedding
}
```

## Species Lore

When creating world lore for a **species**, there must also be corresponding NPC Type and Trait entries. The `text` uses a narrative prose format with skills woven into flowing sentences, distinct from the NPC Type and Trait formats. The lore paragraphs are shared but the skill presentation differs.

See [Species Consistency Rules](../species-rules.md) for the full requirements.

## Faction Lore

When creating world lore for a **faction**, there must also be a corresponding Faction entry. The world lore key must match the faction key exactly. The `text` must be **identical** to the faction's `basicInfo` (same text, two retrieval pathways: semantic search for lore, exact key match for faction).

## Reference

For detailed documentation, see [world-lore-reference.md](references/world-lore-reference.md).
