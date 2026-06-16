---
name: build-skill
description: Create or update a skill, agent, and reference file
context: fork
agent: build-skill
---

# Build Skill

Create skills for editing files under a resolved target world's tab directory.

Every generated agent and skill must:

1. require a resolved `TARGET_WORLD_ROOT`;
2. require resolved `TABS_PATH`, `COMPILED_OUTPUT_PATH`, `INSTRUCTIONS_PATH`, and `WORLD_ROLE`;
3. interpret world-source paths through `TABS_PATH` instead of assuming a literal `tabs/` directory;
4. never assume repository-root `tabs`;
5. preserve marker role restrictions and shared build/validation routing.

## File Structure

```
.claude/
├── skills/{name}/
│   ├── SKILL.md           # Curated rules and formats
│   └── references/
│       └── {name}-reference.md  # Complete schema
└── agents/{name}.md       # Agent that uses the skill
```

## Skill Template

```markdown
---
name: {name}
description: Schema and rules for creating {plural}
context: fork
agent: {name}
---

# {Title}

Edit `<TABS_PATH>/{name}.json`.

## Required Fields

| Field | Requirement |
|-------|-------------|
| `field` | What to put here |

## Conditional Fields

| Field | When to Include |
|-------|-----------------|
| `field` | Only when X |

## Never Include

Omit these fields (auto-set or unused):
- `field1`, `field2`, `field3`

## {fieldName} Format

{Brief description of structure}

Format: "{template with [placeholders]}"

## Schema

\`\`\`typescript
interface {Type} {
  field: type
}
\`\`\`

## Reference

For detailed documentation, see [{name}-reference.md](references/{name}-reference.md).
```

## Agent Template

```markdown
---
name: {name}
description: |
  Use this agent when the user wants to add or edit {plural}.
model: haiku
skills:
  - {name}
---

Require `TARGET_WORLD_ROOT` from the parent orchestration context.
Also require `TABS_PATH`, `COMPILED_OUTPUT_PATH`, `INSTRUCTIONS_PATH`, and `WORLD_ROLE`.

You create and edit {plural} in
`<TABS_PATH>/{name}.json`.

## Chaining

If `{cross-reference}` does not exist in `<TABS_PATH>/{other}.json`, spawn **{other}** agent with the same resolved target-world contract.
```

## Reference Template

```markdown
# {Title} Reference

Complete documentation for `<TABS_PATH>/{name}.json`.

## Schema

\`\`\`typescript
interface {Type} {
  field: type                     // ✅ Description
  field?: type                    // ✅ Description with cross-ref to {other}.json
  field?: type                    // ⚠️ Calculated from X if undefined
  field: type                     // ❌ Always set to X
}
\`\`\`

### Legend

- ✅ **Predefine-able**: Can be set in config, preserved via spread
- ⚠️ **Calculated default**: Has fallback logic if not predefined
- ❌ **Always overwritten**: Set by initialization regardless of what exists in config

## {Related Schema if needed}

\`\`\`typescript
interface {RelatedType} {
  field: type                     // Description
}
\`\`\`

{Prose explanation of how it works, stacking rules, etc.}

## {Topic-Specific Section}

| Column | Column | Column |
|--------|--------|--------|
| value | value | value |

Formula: `{formula if applicable}`

## {Task Name}

Only runs when `condition: 'value'` and `otherCondition: true`

Reads `inputField` and generates: outputField1, outputField2, outputField3. Sets `flag` to false when complete.

## Cross-References

| Field | References |
|-------|------------|
| `field` | `<TABS_PATH>/{other}.json` |
```

## Principles

**Skill (SKILL.md)** - Opinionated and curated
- What this user wants
- Formats and templates over examples
- Required/Conditional/Never field tables
- Brief, actionable guidance

**Reference ({name}-reference.md)** - Comprehensive and neutral
- Everything the system supports
- Full schema with all fields
- Edge cases and defaults
- Cross-references and limits

**Agent ({name}.md)** - Minimal orchestration
- One-line description of when to use
- Chaining logic for cross-references (only where invented values are common)
- No duplication of skill content

## Naming

- Skill name = agent name = folder name
- Use kebab-case for multi-word names
- Match the filename under `<TABS_PATH>/` when possible
