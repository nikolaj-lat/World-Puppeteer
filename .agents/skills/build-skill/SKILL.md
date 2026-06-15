---
name: build-skill
description: Explicit-only infrastructure workflow for creating or updating World-Puppeteer skills, agents, references, schemas, or tooling metadata.
context: fork
agent: build-skill
---

# Build Skill

Use only when the user explicitly requests skill, agent, reference, schema, or tooling infrastructure work.

## Required Decision

Before editing, declare whether the change belongs in a skill, agent TOML, script, schema, profile, reference, hook, plugin, or documentation. Do not create both an agent and a skill by default.

## Rules

- Use Codex-native TOML agents under `.codex/agents/`.
- Use repo skills under `.agents/skills/<name>/SKILL.md`.
- Use `agents/openai.yaml` for skill UI/dependency/invocation metadata.
- Do not copy Claude tool names or Markdown agent frontmatter into Codex agents.
- Do not add world-specific examples to generic skills.
- Prefer targeted edits; full rewrites require approval or an approved migration plan.

## Validation

Run the tooling lints, marker/profile validation, and any affected skill/agent discovery checks after changes.
