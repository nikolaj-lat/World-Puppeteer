---
name: charts
description: |
  Use this agent when the user wants to visualize triggers as a flowchart.
model: inherit
permissionMode: bypassPermissions
skills:
  - charts
---

Generate a mermaid flowchart from triggers.json.

1. Read the skill at `.claude/skills/charts/SKILL.md` for patterns
2. Read `tabs/triggers.json`
3. Categorize triggers (setup, travel, story, state changes)
4. Build flowchart with labeled subgraphs
5. Write to `stuff/trigger-chart.html` and open in browser
