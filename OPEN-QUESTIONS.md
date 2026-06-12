# OPEN-QUESTIONS.md — Hunter x Hunter World: Decision Log

A running log of decisions made and questions still open. Updated every phase.
**BUILD COMPLETE 2026-06-12** — see BUILD-REPORT.md. All questions resolved; remaining notes below.
**REVIEW PASS IN PROGRESS 2026-06-12** — see REVIEW-FINDINGS.md. Decisions D-015+ below.

## REVIEW PASS DECISIONS (2026-06-12)

- **D-015: Remediation scope = all six tiers (creator).** Full Phase-2 remediation authorized
  (Tiers 0–5 of REVIEW-FINDINGS.md): bugs/canon, AI-tab tasks, Other-tab + metadata, Zodiac
  de-templating + voice, structural/type fixes, and optional depth polish.
- **D-016: Game modes = four (creator).** Build `gameModes`: **Canon-Faithful** (diff medium),
  **What-If Divergence** (diff medium), **Story-Focused** (diff easy), **Dark/Mature-tone** (tonal,
  leans into D-007 mature content + source cruelty). Hardcore Nen-Crunch declined.
- **D-017: O1 randomNames clobber fixed.** Empty `randomNames` removed from meta.json so the
  archetypes.json 50+50 pool survives the alphabetical build merge. Config now ships 50/50.
  (Root cause: build.js Object.assign in readdir order; meta.json read after archetypes.json.)
- **D-018: Local validator patched for `quests.questType` (creator-approved, 2026-06-12).** The
  remote validator (authority) recommends and accepts `questType`; the local `validate.js` quest
  allowed-keys set was stale and threw 16 false "unknown field" errors. Added `questType` to the set,
  mirroring D-012's `newSkillGenerationEnabled` fix. Both validators now pass with 0 errors.
- **D-019: Greed Island game masters' Nen categories = author-assigned canon-adjacent (N8).** Canon
  barely defines List, Dwun, Eta. Their NPC entries assign **List = Manipulation, Dwun =
  Specialization, Eta = Enhancement** — coherent invention, registered here as canon-adjacent (not in
  the original ROSTER.md). All three are mythic-tier, defensible given Greed Island is a 14-year,
  three-master Nen construct of extraordinary scale.

---

## CLOSING NOTES (2026-06-12)

- **D-014: Portrait harvesting via MediaWiki API.** The fandom wiki blocks page scraping (Cloudflare), but its `api.php` `pageimages` endpoint serves freely. `stuff/harvest-portraits.js` harvested 128/128 image URLs (108 characters + 20 places); applied to all 91 premades, 108 NPCs, 20 locations, 12 regions. Link-rot risk accepted per D-006; re-run the harvester + apply scripts in `stuff/` if links rot.
- **Known advisory state:** remote validator reports 0 errors / 0 warnings / ~137 recommendations (style-level suggestions, e.g. optional per-task AI instruction blocks left on engine defaults — intentional budget choices).
- **Limits during build:** three background agents were killed by session/monthly usage limits mid-batch; all work was salvaged via incremental writes + continuation agents. No content lost.

---

## RESOLVED DECISIONS

### D-001: Schema target
**V33 / heroesVersion 33.** Confirmed in `tabs/meta.json`, repo `.claude/version.json` (synced v2.10.3, schemaVersion V33), and the live wiki (`/api/index.json` describes itself as the V33 reference). All aligned.

### D-002: Canon continuity baseline
**Manga is the source of truth**, through the most recent published chapters (Succession War / Dark Continent voyage, chapter ~410). The 2011 anime is used only for visual/tonal reference where the manga is silent. Dark Continent Story Start is flagged EXTRAPOLATED in its own lore (locked by creator).

### D-003: Multi-start architecture (locked by creator)
One world, eight Story Starts: Hunter Exam, Zoldyck Family, Heavens Arena, Yorknew City, Greed Island, Chimera Ant, 13th Chairman Election, Dark Continent Expedition. Era-correct world state per start; spoiler scoping per start; per-arc power baselines; permadeath OFF.

### D-005: `skillSettings.newSkillGenerationEnabled` = `true` (creator, 2026-06-11)
Live-validator-only field (forward drift, see Q-001 history below). Set `true`: practitioners develop techniques in play, constrained via AI instructions to stay Nen-coherent. Remote validator is final schema authority for the rest of the build.

### D-006: Images = hotlink official/wiki URLs AND strong imagePromptConfiguration (creator, 2026-06-11)
Populate `portraitUrl`/`imageUrl` with the most stable official/wiki image URLs available, AND write strong `imagePromptConfiguration` art direction as fallback for anything ungenerated/rotted. Link-rot risk accepted by creator.

### D-007: Content tone (creator, 2026-06-11)
Sexual content is part of the world's tone — written into the narrator instructions as in-scope, not deferred away. Voyage's own platform filter is the only line of defense for prohibited categories (non-consent, SCIM); our instructions do not re-implement that filter, but also never steer toward it. Graphic violence and dark themes fully in scope (matches source).

### D-004: Image mechanism (recon finding)
The schema supports direct image URLs without generation:
- `npcs[].portraitUrl` (.png portrait URL)
- `premadeCharacters[].portraitUrl` (skips portrait-gen AI task when present)
- `locations[].imageUrl`, `regions[].imageUrl`
- `imagePromptConfiguration` (AI tab) — text templates layered onto Voyage's default image prompts

No Gemini key → image-gen utility will NOT be run. Plan: populate `imagePromptConfiguration` with HxH-style art direction text; leave URL fields empty unless the creator supplies hosted official images (see Q-002).

---

### D-010: Validator conflict on `newSkillGenerationEnabled` (2026-06-11)
Confirmed two-way conflict: local `post-edit-validate.js` flags the field as "Unknown field — not in schema" while the remote validator REQUIRES it. Field kept (remote is authority per D-005); the local hook's complaint is non-fatal noise on every settings edit. **Proposal pending creator OK (per .claude rules, config edits need approval): patch the local validator schema in `.claude/scripts/` to accept the field.**

### D-011: Roster approved (creator, 2026-06-11)
ROSTER.md approved as proposed (87 entries incl. non-combat challenge premades), PLUS era variants: **two versions each of Gon and Killua** (Hunter-Exam-era Unawakened + Chimera-Ant-era Adept) → **91 total**, 9 slots free.

### D-012: Local validator patched (creator-approved, 2026-06-11)
`.claude/scripts/validate.js` allowed-keys set for skillSettings extended with `newSkillGenerationEnabled`. Local + remote validators now both pass with 0 errors.

### D-013: tabs/ and config.json un-gitignored (2026-06-11)
The template's .gitignore excluded `tabs/` and `config.json`, so phase commits 0-3a contained docs only — no world content. Removed those two ignore rules (kept config-backups/, images/, stuff/) and backfilled all content in the phase 3a commit, fulfilling the creator's per-phase checkpoint mandate. Reversible if the creator prefers content unversioned.

## OPEN QUESTIONS (batched for creator)

*Q-001 → D-005. Q-002 → D-006. Q-003 → D-011. Q-004 → D-009.*

### Q-004: NEN-DESIGN.md sign-off — RESOLVED → D-009
**D-009 (creator, 2026-06-11):** NEN-DESIGN.md + WORLD-BIBLE.md signed off. Sub-decisions: tier numbers tunable in P3; Jajanken = 3 abilities; Hatsu trait category visible at creation; En gated both ways (Master any-category OR Adept+Enhancer/Specialist, via sibling ability entries since requirements are AND-only).

### D-008: Era scoping mechanism (design finding, 2026-06-11)
V33 Story Starts carry no traits/known-entities/world-state. Era-correct state is implemented via one mechanical trigger per arc keyed on `game-tick ≤ 1` + the start's unique location → `write-string arc=<id>` + `known-entity` sets + a `story` era-summary effect; AI instructions route spoiler behavior on the arc flag. Documented in NEN-DESIGN.md §8 and WORLD-BIBLE.md.

---

## RECON STATUS (Phase 0, 2026-06-11)

| Check | Result |
|---|---|
| Node | v24.15.0 ✅ |
| Build hook (`build.js`) | rebuilds config.json ✅ |
| Local validator | passes ✅ |
| Remote `POST /api/validate` | reachable, returns structured errors ✅ (1 error: Q-001) |
| Count utility | works; total cap 10,000,000 chars; npcs 1,000,000; premades 100 entries ✅ |
| Wiki API | reachable; 61 sections inventoried ✅ |
| Existing content | tabs essentially empty (fresh world) ✅ |
| Gemini key | absent → image-gen disabled by design ✅ |
