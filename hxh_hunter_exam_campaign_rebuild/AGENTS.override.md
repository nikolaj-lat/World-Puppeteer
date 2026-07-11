# HxH Editable World Override

This is the active editable Hunter x Hunter world. The 287th Hunter Exam is the initial campaign anchor, not a permanent present or a limit on later implemented arcs. Track the current campaign phase explicitly in reasoning, and treat NPC state, placement, relationships, powers, factions, deaths, and events as phase-dependent.

Later-arc facts may remain hidden until relevant, then become available through narrator-facing hidden information or explicit canon timeline notes. Canon is scaffolding, not a railroad: player actions may alter, delay, prevent, or replace canon events. Preserve canon divergence consequences once established; never reset the campaign to canon to repair continuity. "Timeless" means usable across campaign phases, not chronology-free.

Canon source of truth is the manga through the Succession War, approximately chapter 410. The 2011 anime may guide visuals and tone, but do not treat it as higher canon than the manga.

Never assert a fate, power, Nen category, institution, relationship, or timeline fact from memory. Preserve uncertainty as `unrevealed` when the source is not established.

## Repository source hierarchy

- `hxh_hunter_exam_campaign_rebuild/tabs/` is the authoritative editable source for all Hunter x Hunter world content.
- `hxh_hunter_exam_campaign_rebuild/HxH.json` is generated, tracked output built from those authoritative tabs.
- `World-Puppeteer/tabs/` is baseline/reference material only. Never copy, synchronize, or restore it over the HxH repository's `tabs/`.
- `hxh_hunter_exam_campaign_rebuild/_local_reference/snapshot-20260711T112610Z` — mirrored Wiki
- The parent World-Puppeteer checkout supplies shared build and validation tooling; it does not supersede the HxH source files.

For HxH work, edit this repository's `tabs/`, rebuild this repository's `HxH.json`, run validation, and run the maintained suites in `tests/`. The HxH repository tracks its own tabs; parent-repository ignore behavior does not make them disposable.

# You are authoring or editing a Voyage Heroes V35 world JSON.

Reference docs: every wiki section is available as a self-contained
endpoint at https://unofficial.voyage/api/sections/<section>.md
or .json. Fetch only the sections you need, or pull the whole wiki
from /api/wiki.md in one request.

Verification: to verify the world, POST the JSON to
https://unofficial.voyage/api/validate. The response groups issues
by severity:

  - errors: runtime-affecting problems. Fix these. The Voyage editor
    publishes worlds with errors intact, but the engine silently drops
    fields or breaks lookups at runtime.
  - warnings: quality issues. Many are intentional design choices;
    read the "Safe to ignore when..." line in each message before
    acting.
  - recommendations: best-practice suggestions, same rule as warnings.

Validate after each batch of changes. Do not declare work complete
until counts.errors is 0.