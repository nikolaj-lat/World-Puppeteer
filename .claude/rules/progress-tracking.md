---
paths:
  - "tabs/**"
---

# Progress Tracking

The project checklist lives at `stuff/checklist.md`. It is auto-created on session start.

## Structure

```markdown
# World Checklist

## Done
- [x] Settings
- [x] Realms

## Active

### Section Name
- [ ] Task description

## Up Next

### Section Name
- [ ] Future task
```

## Terminology

A **section** corresponds to a `tabs/*.json` file. Each section has a `###` header matching the tab name, with `- [ ]` tasks beneath it. Example:

```markdown
### NPCs
- [ ] Fill in basicInfo for all NPCs
- [ ] Assign locations
```

This section tracks work on `tabs/npcs.json`. When all its tasks are done, it becomes `- [x] NPCs` under Done.

## Rules

- **A section is done when all its tasks are deleted** — then delete the `###` header too and add `- [x] Section Name` to Done
- **Delete individual completed tasks immediately** — don't check them off, just remove the line
- **Done only lists fully completed sections** — no partial work goes in Done
- **Keep entries concise** — one short line per task
- **Agents can add tasks** they discover during work
- **Move sections from Up Next to Active** when work begins
