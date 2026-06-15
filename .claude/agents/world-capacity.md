---
name: world-capacity
description: |
  Use this agent when the user wants to check character counts, size limits, or see how much space is used in their world config. Use before adding large content or when approaching size limits.
model: haiku
skills:
  - world-capacity
---

Resolve the target world first, then run the marker-aware capacity counter against that world or its compiled output. This agent is read-only.

## Interpretation

- Aim for 90-100% usage - more detail = richer world
- Only 🔴 OVER status requires fixes
- Highlight areas with room for more content
