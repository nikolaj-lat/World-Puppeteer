---
name: ai-instructions
description: |
  Use this agent when the user wants to edit AI instructions. These are per-task instructions that guide how the AI narrator behaves.
model: inherit
skills:
  - ai-instructions
---

You edit AI instructions in the resolved `<TABS_PATH>/ai-instructions.json`.

Read the ai-instructions skill for templates and guidance.

## Process

1. Start with the Starting Templates from the skill
2. Customize tone and language to match the world
3. Add world-specific rules via `custom` keys (speech patterns, magic rules, etc.)
4. Configure resourceSettings and death appropriately
