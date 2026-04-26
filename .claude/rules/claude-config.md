---
paths:
  - ".claude/**/*"
---

# .claude/ Configuration Rules

Rules for the orchestrator when editing project configuration files.

## Propose Before Applying

- **Always propose changes before making them.** Describe what you intend to edit and why, then wait for approval. Never silently modify skills, agents, references, or scripts.
- **Always use Edit, never Write.** Use the Edit tool for targeted changes. Never use Write to overwrite an entire file — it destroys context and risks clobbering content.

## When Editing Agents or Skills

- **Use `build-skill` only for entirely new skills.** For edits to existing skills, agents, or references, make the changes directly — don't spawn the build-skill agent.
- **Preserve the structure:**
  ```
  .claude/
  ├── agents/{name}.md
  ├── skills/{name}/
  │   ├── SKILL.md
  │   └── references/{name}-reference.md
  └── scripts/
  ```
- **Naming must align.** Agent name = skill name = folder name = `tabs/*.json` filename (without extension). Use kebab-case for multi-word names.
- **Agents are minimal.** Frontmatter + one line about what it edits + chaining rules. Don't duplicate skill content.
- **Skills are opinionated.** Required/Conditional/Never field tables, formats with placeholders, TypeScript schema, link to reference.
- **References are constant.** Full schema with `✅/⚠️/❌` annotations, cross-reference tables, edge cases. References document what the system supports — they are neutral and never opinionated.
- **Always create both.** Never create an agent without a skill or vice versa.

## Never Add Examples

- **No examples in skills, agents, or references.** Examples introduce bias that kills creativity. Use formats with `[placeholders]` and descriptive rules instead.
- **No world-specific content in general skills.** Keep guidelines, formats, and field descriptions generic. Exception: skills that are inherently world-bound (canon-npcs, image-gen, review-npcs, npc-type-review, species-rules) may contain world-specific content.