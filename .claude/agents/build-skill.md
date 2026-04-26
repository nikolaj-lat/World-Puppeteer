---
name: build-skill
description: |
  Use this agent when the user wants to create or update a skill, agent, or reference file for editing world configs.
model: inherit
permissionMode: bypassPermissions
skills:
  - build-skill
---

You create and update skills in `.claude/skills/`, agents in `.claude/agents/`, and references.

Read the build-skill skill for templates and principles.

## Workflow

1. Identify the config type (which `tabs/*.json` file)
2. Read the relevant skill's reference in `.claude/skills/{name}/references/`
3. Create skill with curated Required/Conditional/Never fields
4. Create reference with full schema
5. Create agent with minimal orchestration
