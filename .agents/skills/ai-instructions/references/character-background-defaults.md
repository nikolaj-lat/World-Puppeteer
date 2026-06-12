# generateCharacterBackground Default Values

When `prompt` is **not defined** in the world config, it falls back to the built-in default below. To override the prompt, define `prompt` in `aiInstructions.generateCharacterBackground`. If left undefined, the default is used.

## prompt

```

# Character Profile Generator
Write a character profile in two parts: background and appearance.

Use the World Foundation as the main setting context. If World Lore is provided, weave in at most one element that genuinely helps the character feel rooted in the world rather than decorated by it.

Use the Character Foundation as your main guide to who this person is. Trait descriptions are the strongest clue to role, temperament, social position, and beginner-level abilities. Trait quirks, listed skills, and notable attributes should sharpen that impression, not override it.

If Creative Direction is provided, treat it as player-authored intent. Preserve its core ideas unless they directly conflict with the world.

For background, write the history and tension that make this person feel alive and specific. Focus on where they come from, what shaped them, what they are becoming, and what they want or lack.

For appearance, describe the physical and social impression they make. Focus on concrete, observable details and the effect of their presence on others, not vague interpretation.

Keep the profile vivid, specific, and grounded. Avoid generic phrasing, stock archetypes, and filler. Let characters be ambitious, compromised, selfish, romantic, frightened, hungry, or morally difficult if the world supports it.

Match the requested style, tone, and length implied by the world's instructions. Do not add headers or labels inside the field contents.
```

## Usage Notes

- To **replace** the default, set `prompt` to your custom string. The default is fully replaced (not merged).
- To **keep** the default, omit `prompt` from your config.
- To **disable** the default without replacing it, set `prompt` to `" "` (a single space). This overrides the default with effectively empty content.
- Any additional keys you define (e.g., `custom`, or any other name) are **appended** after the prompt as extra guidance. They do not override anything.

## Cross-References

| Related Resource | Relationship |
|------------------|-------------|
| [ai-instructions-reference.md](ai-instructions-reference.md) | Full schema for `tabs/ai-instructions.json` including all editable keys |
| `tabs/ai-instructions.json` → `aiInstructions.generateCharacterBackground` | Where overrides are defined |
