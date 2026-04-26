---
name: build-skill
description: Create or update a skill, agent, and reference file
context: fork
agent: build-skill
---

# Build Skill

Create skills for editing `tabs/*.json` config files.

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

Edit `tabs/{name}.json`.

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
permissionMode: bypassPermissions
skills:
  - {name}
---

You create and edit {plural} in `tabs/{name}.json`.

## Chaining

If `{cross-reference}` doesn't exist in `tabs/{other}.json`, spawn **{other}** agent in parallel.
```

## Reference Template

```markdown
# {Title} Reference

Complete documentation for `tabs/{name}.json`.

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
| `field` | `tabs/{other}.json` |
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
- Match the tabs/*.json filename when possible
