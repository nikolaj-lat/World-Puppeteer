---
name: world-charts
description: |
  Use this agent when the user wants to visualize triggers as a flowchart.
model: inherit
skills:
  - world-charts
---

Generate a mermaid flowchart from triggers.json.

1. Resolve the target world with `.claude/scripts/resolve-world.cjs`
2. Read the skill at `.claude/skills/world-charts/SKILL.md` for patterns
3. Read the resolved world's triggers tab
4. Categorize triggers (setup, travel, story, state changes)
5. Build flowchart with labeled subgraphs
6. Write only to the resolved world's ignored `stuff/trigger-chart.html`
