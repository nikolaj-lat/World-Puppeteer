# World Puppeteer

World Puppeteer is a Voyage world tooling repository with shared Claude and Codex frontends. It uses marker-based world resolution, world-local profiles, validation hooks, safe build publication, and read-only reference packs.

## Repository

Clone this fork:

```bash
git clone https://github.com/NobodyIsUgly/World-Puppeteer.git
cd World-Puppeteer
npm install
```

Upstream attribution is preserved in repository history and source material, but this fork is the authoritative setup target for the tooling documented here.

## Worlds

Each world is declared by `.world-puppeteer.json`.

- `role: "editable"`: ordinary content edits are allowed when requested and validated.
- `role: "reference"`: source/reference worlds are protected from ordinary content edits.
- `role: "template"`: starter/template worlds are protected unless template maintenance is explicit.

World source lives in the marker-declared `paths.tabs` directory. Compiled output is the marker-declared `paths.compiledOutput`. Do not assume repository-root `tabs/` is the active world.

The current tracked markers are:

- `.`: reference world, output `HxH-Full-Canon-Reference.json`
- `hxh_hunter_exam_campaign_rebuild`: editable HxH world, output `HxH.json`
- `templates`: minimal template world, output `minimal-world.json`

## Shared Tooling

Claude and Codex are thin adapters over the same Node core:

- neutral world resolver
- changed-path classifier
- hook routing and validation
- deterministic tab merge with safe disjoint nested object merges and duplicate JSON-path collision rejection
- validate-before-publish build pipeline
- marker/profile/reference-pack metadata validation

SessionStart hooks are read-only. They emit context and must not create `tabs/`, checklists, compiled outputs, or other world files.

## Commands

```bash
npm install
npm test
npm run test:experimental-git-hooks
npm run validate:metadata
node .claude/scripts/build-world.cjs --world hxh_hunter_exam_campaign_rebuild
node .claude/scripts/validate.js --world hxh_hunter_exam_campaign_rebuild --json
node .claude/scripts/count.js --world hxh_hunter_exam_campaign_rebuild --json
```

`npm test` is the supported non-experimental gate. It runs tooling architecture, CLI contract, AI instruction limits, build safety, reference-pack architecture, world-path containment, transactional tooling, Voyage tooling, and repository metadata validation.

`npm run test:experimental-git-hooks` is informational only. Git-hook enforcement remains experimental and is not part of the supported completion gate.

Supported compatibility wrappers:

- `node .claude/scripts/build.js --world <world-root>` delegates to `build-world.cjs`.
- `node <world-root>/build.cjs` delegates to `build-world.cjs --world <world-root>` for world-local workflows.

All build, validate, resolve, and inspection scripts reject unknown flags and malformed arguments.

## Safe Build Publication

`build-world.cjs` resolves the intended world, merges source tabs in memory, allows disjoint nested object ownership, rejects duplicate JSON-path collisions or incompatible value collisions, writes a unique candidate file beside the destination, validates the exact candidate, then creates a backup and atomically replaces the compiled output. Failed validation or candidate generation leaves the existing compiled output unchanged.

## Profiles

Profiles are world-local under `<world>/.world-puppeteer/profiles/`.

- Every local profile file is schema-validated.
- Required local profiles must be listed in that world's `activeProfiles`.
- Optional profiles may remain inactive.
- Active profile IDs must resolve locally.
- Profiles from one world are not scanned for another world.

## Reference Packs

Reusable source material lives under `.world-puppeteer/reference-packs/`.

Reference packs are read-only evidence and inspiration. They may be inspected, inventoried, summarized, and reported, but they do not apply themselves, mutate world tabs, mutate markers, record provenance, or write compiled output. Later adaptation requires explicit approval and the relevant ordinary domain specialist.

Generated reference-pack reports are allowed only under `.world-puppeteer/reports/reference-packs/`.

## Validation Model

World-Puppeteer metadata is closed and schema-backed: markers, profiles, reference-pack manifests, and registries reject unknown fields.

Voyage content is selectively extensible. Known required fields, types, counts, limits, references, and closed nested structures are enforced; arbitrary AI instruction task names and documented object-form instruction sections are traversed and validated without treating every unknown content key as a hard schema failure.

Frontend validation is path-dependent, and arbitrary shell writes are outside frontend hook guarantees. Git hooks remain experimental. The authoritative checks are `npm test` plus the explicit world build and validation commands for each affected editable world.
