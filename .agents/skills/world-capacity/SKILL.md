---
name: world-capacity
description: Read-only capacity and character-count reporting for a resolved World-Puppeteer world. Use for limits, usage, remaining capacity, and over-limit warnings.
---

# World Capacity

This skill is read-only. It reports capacity; it does not recommend adding content merely to fill unused space.

## Workflow

1. Resolve the target world with `.claude/scripts/resolve-world.cjs`.
2. Run `.claude/scripts/count.js` against the resolved compiled output or explicit tabs/config path.
3. Report limits, current usage, remaining capacity, category counts, over-limit entries, and warnings.
4. Treat unused space as headroom, not a defect.

## Escalation

Stop if the target world cannot be resolved or if the compiled output does not exist and the task did not approve a build.
