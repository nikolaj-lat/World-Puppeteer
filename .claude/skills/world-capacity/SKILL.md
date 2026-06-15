---
name: world-capacity
description: Check character counts and limits for Voyage World config files. Use when checking how much space is used, before adding large content, or when approaching size limits.
context: fork
agent: world-capacity
---

# World Capacity

Resolve the target world first, then run `node .claude/scripts/count.js <world-root>/tabs --json` or count the marker-declared compiled output.

## Usage

```bash
node .claude/scripts/count.js hxh_hunter_exam_campaign_rebuild/tabs --json
node .claude/scripts/count.js templates/tabs --json
```

## Output

Shows usage for each section with limits:
- 🟢 OK - Under limit
- 🟡 WARNING - Approaching limit (>80%)
- 🔴 OVER - Exceeds limit

## Reference

For detailed limits, see [count-reference.md](references/count-reference.md).
