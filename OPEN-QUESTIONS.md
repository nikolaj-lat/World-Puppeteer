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

### D-004: Image mechanism (recon finding)
The schema supports direct image URLs without generation:
- `npcs[].portraitUrl` (.png portrait URL)
- `premadeCharacters[].portraitUrl` (skips portrait-gen AI task when present)
- `locations[].imageUrl`, `regions[].imageUrl`
- `imagePromptConfiguration` (AI tab) — text templates layered onto Voyage's default image prompts

No Gemini key → image-gen utility will NOT be run. Plan: populate `imagePromptConfiguration` with HxH-style art direction text; leave URL fields empty unless the creator supplies hosted official images (see Q-002).

---

## OPEN QUESTIONS (batched for creator)

### Q-001: Schema drift — `skillSettings.newSkillGenerationEnabled`
The **remote validator** (version 2026-06-10, newer than the repo's v2.10.3 sync) requires `skillSettings.newSkillGenerationEnabled`; the repo's local validator, settings skill, and template `tabs/settings.json` do not know this field (zero grep hits in `.claude/`).
- **Flagged per instructions** (repo vs wiki disagreement). This is forward drift, not a conflict of meaning: the live schema added a field the repo hasn't synced yet.
- **Proposed resolution:** add the field; recommend `true` (Nen practitioners plausibly develop new skills in play, guided by AI instructions). Mitigation for further drift: treat the remote validator as final authority and run it after every phase.

### Q-002: Official image URLs
`portraitUrl`/`imageUrl` accept arbitrary URLs, but hotlinking fan-wiki/official images is brittle (CDN blocks, takedowns) and of unclear licensing. Options: (a) leave all URL fields empty + rich `imagePromptConfiguration` text (current plan), (b) creator supplies a hosted image set later. Defaulting to (a) unless told otherwise.

### Q-003: Premade roster of ≤100
Roster proposal will be submitted for approval before authoring (per locked instructions) — see build plan phase 6.

### Q-004: NEN-DESIGN.md sign-off
Required before any abilities are authored — see build plan phase 2.

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
