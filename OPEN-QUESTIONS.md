# OPEN-QUESTIONS.md — Hunter x Hunter World: Decision Log

A running log of decisions made and questions still open. Updated every phase.

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

## OPEN QUESTIONS (batched for creator)

*Q-001 resolved → D-005. Q-002 resolved → D-006.*

### Q-003: Premade roster of ≤100
Roster proposal will be submitted for approval before authoring (per locked instructions) — see build plan phase 6.

### Q-004: NEN-DESIGN.md sign-off
Drafted 2026-06-11 (with WORLD-BIBLE.md). Awaiting creator sign-off, including four sub-decisions listed at the bottom of NEN-DESIGN.md (tier numbers, Jajanken as 3 abilities, visible Hatsu category, En gating).

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
