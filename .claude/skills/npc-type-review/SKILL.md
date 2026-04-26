---
name: npc-type-review
description: Guidelines for reviewing and refining NPC type definitions
context: fork
agent: npc-type-review
---

# NPC Type Review

Review and refine NPC type definitions in `tabs/npc-types.json`.

## Review Process

Work through NPC types systematically, one at a time:

1. **Read the current definition** - Understand what exists
2. **Assess quality** - Identify strengths and gaps
3. **Propose refinements** - Suggest specific improvements
4. **Collaborate with user** - Discuss and iterate together
5. **Update when approved** - Apply changes to the config

## Key Review Questions

### Description Clarity

- Is the physical appearance vivid and specific?
- Can you visualize this archetype immediately?
- Does it avoid generic fantasy tropes?

### Thematic Consistency

- Does this fit the world's tone and setting?
- Is it unique compared to other types?
- Does it surprise in interesting ways?

### Missing Details

- What sensory details are absent (smell, sound, texture)?
- What behaviors or mannerisms define this type?
- What emotions or atmosphere do they evoke?

### Cultural/Spiritual Depth

For yokai and supernatural types:
- How do they relate to kegare (spiritual pollution)?
- What is their relationship to the natural/spirit world?
- What makes them alien vs humanlike?

For human types:
- What moral framework guides them?
- What motivations drive their archetype?
- What contradictions make them complex?

## Important Notes

**Resistances/Vulnerabilities/Immunities**: These fields exist on the schema but should typically be empty `[]`. Focus on narrative descriptions rather than mechanical attributes when reviewing NPC types.

**Avoid Combat-Focused Language**: Emphasize personality, appearance, role in society, and narrative potential over combat capabilities.

## Refinement Guidelines

### Strong Descriptions

- Concrete sensory details (not abstract qualities)
- Specific behaviors or speech patterns
- Contradictions that create depth
- Cultural context that grounds them in the world
- Emotional resonance or thematic weight

### Weak Descriptions

- Generic traits ("strong warrior", "wise elder")
- Lists of abilities without personality
- No distinctive appearance details
- Interchangeable with similar archetypes
- Purely mechanical focus

## Review Format

When reviewing each type:

```markdown
## [NPC Type Name]

**Current Description**: [quote it]

**Strengths**: What works well

**Gaps**: What's missing or unclear

**Proposed Refinements**: Specific suggestions

**Questions for Creator**: Clarifications needed
```

## Reference

For best practices and examples, see [npc-type-review-reference.md](references/npc-type-review-reference.md).
