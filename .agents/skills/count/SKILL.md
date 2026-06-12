---
name: count
description: Check character counts and limits for Voyage World config files. Use when checking how much space is used, before adding large content, or when approaching size limits.
context: fork
agent: count
---

# Count

Run `node .Codex/scripts/count.js` to check character counts and limits.

## Usage

```bash
node .Codex/scripts/count.js              # defaults to tabs/
node .Codex/scripts/count.js ./tabs/      # explicit path
node .Codex/scripts/count.js --json       # JSON output for programmatic use
```

## Output

Shows usage for each section with limits:
- 🟢 OK - Under limit
- 🟡 WARNING - Approaching limit (>80%)
- 🔴 OVER - Exceeds limit

## Reference

For detailed limits, see [count-reference.md](references/count-reference.md).
