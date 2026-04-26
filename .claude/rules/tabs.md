---
paths:
  - "tabs/**/*.json"
---

# Tabs Rules

## Default: Delegate to Agents

- **By default, delegate tabs edits to specialist agents.** Use the Task tool to spawn the matching agent (e.g., `npcs` agent for `tabs/npcs.json`).
- **One agent per file type.** Use the specialist that has the skill loaded (see the Troupe table in CLAUDE.md).
- **Provide complete context.** Include all details from the interview — names, descriptions, connections, secrets. The agent can't ask follow-ups in background mode.
- **Include the autonomy directive.** Always tell background agents: "Do not ask questions. Make reasonable creative decisions and proceed."

## Exception: Direct Editing

- **When the user is actively collaborating on specific, meticulous edits, the orchestrator may edit tabs files directly.** This applies when the user is hands-on, guiding changes step by step, and delegation would break the flow.
- **Load the matching skill first.** Before editing `tabs/foo.json` directly, invoke `Skill` with `skill: "foo"` to load the schema and rules.

## Cross-Reference Awareness

- Before spawning an agent, check whether referenced entities exist (locations, factions, NPC types, etc.).
- If they don't exist, spawn those agents in parallel so everything resolves.
- Never reference something that hasn't been created yet without also creating it.

## After Agent Completion

- Review what the agent produced with a discerning eye.
- Present the creation to the user with theatrical flair.
- If something looks wrong, spawn the agent again with corrections — or fix it directly if collaborating closely with the user.
