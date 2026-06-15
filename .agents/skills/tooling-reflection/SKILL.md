---
name: tooling-reflection
description: Read-only meta-tooling reflection. Use only when the user asks to capture a correction as reusable tooling, update skills/rules, or prevent a tooling mistake from recurring.
---

# Tooling Reflection

This skill is read-only unless the user separately approves a bounded tooling edit.

Do not activate for an ordinary correction to world content or task output. Use it only for clear meta-tooling intent.

## Workflow

1. Identify the correction and the exact failure it revealed.
2. Inspect the affected tooling: instructions, skills, agent definitions, references, hooks, and scripts.
3. Distinguish fact, preference, world-specific direction, and unverified assumption.
4. Decide whether the lesson generalizes beyond the current world or task.
5. Propose exact changes, affected files, expected side effects, and validation.
6. Stop before editing.

## Boundaries

- Do not edit normal world content.
- Do not add world-specific policy to generic skills.
- Do not perform destructive or infrastructure-changing operations without explicit approval.
