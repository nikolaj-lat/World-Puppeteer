---
name: reflect
description: Learn from a correction by proposing permanent changes to skills, agents, references, or rules. PROACTIVELY invoke this skill whenever the user corrects a mistake, points out something wrong, says "no not that", "that's wrong", "fix it", "think about this", "double check this", or otherwise indicates an agent or the orchestrator did something incorrectly — even if the user doesn't explicitly ask for /reflect. Also performs a thorough audit of the surrounding subsystem to find latent issues the correction reveals.
---

# Reflect

Analyze the current conversation to identify what went wrong, then audit the entire relevant subsystem for related weaknesses. A correction is a signal — it reveals not just one mistake but a class of potential failures. Your job is to trace the thread and find everything it connects to.

## Workflow

### Phase 1: Identify the Correction

Read the **full conversation** to find **every correction** the user made — not just the most recent one. Multiple corrections often share root causes. Distill each one:
- **What happened** — the observable failure
- **What should have happened** — the expected behavior
- **The underlying cause** — why the system allowed this to happen (not just "the rule was missing" but "the skill doesn't address this category of concern at all")

### Phase 2: Audit the Subsystem

This is where /reflect earns its keep. A correction doesn't exist in isolation — it points to a weakness in a subsystem. Audit the full chain that produced the failure:

1. **Map the subsystem.** Identify every file involved in the workflow that failed:
   - The skill that governed the agent's behavior
   - The agent definition that dispatched the work
   - The reference documentation the agent relied on
   - Any rules that constrained the orchestrator
   - Any scripts that ran as part of the flow
   - CLAUDE.md if the orchestrator itself was involved

2. **Read all of them.** Not just the obvious target — read the full subsystem. The correction might point at the skill, but the real gap might be in the agent's chaining rules, or in a reference that's missing a field annotation.

3. **Ask diagnostic questions** as you read each file:
   - Does this file address the *category* of concern the correction revealed, or just adjacent ones?
   - Are there similar gaps? If a field was undocumented, are other fields also undocumented?
   - Are instructions ambiguous in ways that could produce different failures of the same kind?
   - Are there implicit assumptions that should be explicit rules?
   - Does the agent know when to do something but not when *not* to?
   - Are cross-references between files consistent? Does the agent mention capabilities the skill doesn't explain?

### Phase 3: Determine Targets

Classify each file as one of:
- **Skill** (`SKILL.md`) — agent produced wrong output due to missing or unclear rules
- **Agent** (`.claude/agents/*.md`) — delegation, chaining, or agent behavior was wrong
- **Reference** (`references/*.md`) — schema documentation was incorrect or incomplete
- **Rule** (`.claude/rules/*.md`) — orchestrator's own behavior was wrong
- **Script** (`.claude/scripts/*.js`) — hook script has a bug or missing logic
- **CLAUDE.md** — orchestrator's core instructions need adjustment

### Phase 4: Propose Changes

Present findings in two tiers:

**Tier 1 — Direct Fix**
The change that addresses the user's explicit correction. Describe exactly what to change, where, and why.

**Tier 2 — Discovered Improvements**
Issues found during the audit that the user didn't explicitly flag but that the correction revealed. For each:
- What the issue is
- Why the correction made it visible (the connection)
- The proposed change

Both tiers require explicit approval before applying. Present Tier 1 first, then Tier 2 as "While auditing the subsystem, I also found..."

**Display format**: For every proposal, show the old text and new text as a pair of rendered blockquotes so the user can visually compare them. Do not use inline text or markdown code blocks.

**Pre-flight check**: Before presenting proposals, verify each one against the project's configuration rules (no world-specific content in generic skills, no examples, preserve existing conventions). If a proposal violates these rules, rework it before presenting — don't rely on the user to catch it.

### Phase 5: Apply with Approval

Wait for the user to approve changes. Apply approved edits using the Edit tool — never Write to overwrite entire files. The user may approve Tier 1 but want to discuss Tier 2, or approve some Tier 2 items but not others.

## Principles

- **One correction, thorough audit.** The correction is the starting point, not the boundary. Follow the thread through the full subsystem.
- **Precise changes, broad investigation.** Read widely but edit narrowly. Each proposed change should be minimal and targeted, even though the investigation spans multiple files.
- **Keep it generic.** Never encode world-specific content into skills, agents, or references. Frame corrections as universal rules or formats.
- **No examples.** Use formats with `[placeholders]` and descriptive rules, never examples — examples introduce bias.
- **Preserve existing conventions.** Match the style and structure of the file being edited. Read it first.
- **Don't drop what works.** When rewriting a rule, diff the new text against the old. If the original rule correctly required something, the new version must still require it — even if the framing changes.
- **Explain the connection.** For every Tier 2 finding, explain how the original correction led you to it. Unrelated improvements don't belong here — save them for a separate conversation.
