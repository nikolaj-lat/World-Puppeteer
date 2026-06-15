---
name: platform-evidence
description: Read-only evidence workflow for Voyage platform behavior, schema claims, source freshness, and documentation conflicts.
---

# Platform Evidence

Use when current platform behavior is unknown, sources disagree, a claim appears stale, or a tooling audit needs provenance.

## Workflow

1. Check local validators and references.
2. Check the evidence registry at `docs/platform-evidence/sources.json`.
3. Compare source kind, retrieval date, update date, and affected domains.
4. Prefer reproducible behavior and controlled tests over unsourced claims.
5. Record conflicts and uncertainty.
6. Propose reference or validator updates; do not directly edit canonical references without approval.

Do not represent community documentation as official.
