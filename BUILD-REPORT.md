# BUILD-REPORT.md — Hunter x Hunter: Complete World (V33)

Built 2026-06-11 → 2026-06-12. Compiled `config.json` passes the **remote validator (0 errors, 0 warnings)** and the **local validator (0 errors)**; all size caps green (total 1.10M / 10M chars, 11%).

## What was built

| Section | Contents |
|---|---|
| Settings | 6 attributes (willpower→aura, endurance→health scaling), Jenny economy, 7 damage types, bounded canon geography, `newSkillGenerationEnabled: true` (D-005) |
| Resources | `health` (isHealth) + `aura` with the full Ten/Zetsu/Ren/Hatsu/Ko/En cost ladder in usage instructions |
| Skills | 25 — 10 Nen (4 principles + 6 categories) + 15 mundane |
| Traits | 84 in 5 visible categories + 45 uncategorized canon-Hatsu markers; tier ladder (Unawakened→Master) doubles as per-arc power baseline; hexagon affinity as graded skill modifiers; 8 vow traits with real buffs |
| Abilities | 71 — advanced applications (Gyo/Shu/In/Ken/Ko/Ryu/En×3 paths per D-009), 6 Nascent Hatsu seeds, 50 canon signature abilities with conditions as law |
| Triggers | 24 — Nen awakening, 6 Water Divination outcomes, aura exhaustion, 8 vow-violation enforcers, 8 arc-state triggers (era briefing + spoiler walls + arc flag) |
| Geography | 3 realms (Known World, Greed Island, Dark Continent), 12 regions, 34 locations with areas/paths; 8 unique story-start anchors |
| Factions | 14 (8 major, 6 minor) with public faces and hidden truths |
| NPC types | 13 implementing the Zetsu wall (Civilian → Chimera Ant King) |
| NPCs | 108, every entry with ARC VALIDITY era-tagging in hiddenInfo |
| Premades | **91 / 100 cap** — approved roster (D-011) incl. era variants of Gon/Killua, full Troupe, Zodiacs, Royal Guards, and non-combat challenge runs (Komugi, Oito, Tonpa, Zepile); attributes uniform-total (60), thematic spreads |
| Items | 22 (licenses, canon weapons, Greed Island gear, valuables) |
| Quests | 16 (2 per arc), wired via story-start startingQuests |
| Story starts | 8 — one per arc, era-correct, power-baseline guidance, Dark Continent flagged EXTRAPOLATED |
| AI instructions | Era discipline (arc-flag routing), Nen law, hexagon adjudication, canon voice, D-007 content rules, summarization memory, narratorStyle, questGenerationGuidance, Madhouse-style imagePromptConfiguration |
| World lore | 54 entries (era-neutral + arc-tagged + EXTRAPOLATED-flagged DC material) |
| Name filters | 38 rules (overused AI names → Togashi-register coinages, phrase deletions) |
| Archetypes | 10 author seeds, 12 character archetypes, 20 encounter elements, 11+23 location/region archetypes, 100 random names |
| Images | Official wiki URLs on 91 premades, 108 NPCs, 20 locations, 12 regions (harvested via MediaWiki API — D-014) |

## Architecture highlights

- **One world, eight eras**: each Story Start anchors a unique location; a turn-1 trigger writes the `arc` flag, sets era-known entities, and injects a ≤1000-char era briefing with the WORLD-BIBLE spoiler wall. `generateStory` treats the briefing as law; NPC ARC VALIDITY lines keep the dead dead and the unborn unborn.
- **Nen as mechanics, not flavor**: aura is a real bar with real costs; the hexagon is graded skill modifiers + adjudication rules; vows are buff-traits with semantic tripwires that strip the trait and gut aura at 30% on violation; canon Hatsu are trait-gated abilities whose written conditions the narrator enforces (Chain Jail only binds Spiders; Emperor Time burns lifespan; the Rock requires its chant).
- **Permadeath off, consequence on**: death instructions guarantee survival-at-a-cost in the canon register.

## Validation & playtest sanity

- Remote `POST /api/validate`: **0 errors / 0 warnings** / 137 advisory recommendations (intentional engine-default choices).
- Local validator + count: all green, all caps respected.
- Chain audit (scripted): every start → location → arc trigger → quests resolves; every premade → traits → abilities → replacesNpc → portraitUrl resolves; every ability trait-requirement exists. **Zero dangling references.**
- Spoiler audit (manual): A1/A4/A6 start texts and era briefings leak nothing — Nen unnamed in A1, Meruem phase-gated in A6, the Rose sealed until deployed.

## Known caveats

1. **Schema drift**: live validator requires `skillSettings.newSkillGenerationEnabled`, which the repo skills don't document; the local validator was patched (creator-approved, D-012). Watch future repo syncs.
2. **Link rot**: portrait/image URLs hotlink the fandom CDN per D-006; re-run `stuff/harvest-portraits.js` + the apply scripts if they rot.
3. **Dark Continent content beyond manga ch. ~410** is explicitly EXTRAPOLATED in lore, the A8 start, and the era briefing.
4. **Build interruptions**: three agents died to usage limits mid-batch; work was salvaged incrementally — verify nothing reads oddly in the affected sections (Troupe NPCs, Greed Island NPCs, story starts 5-8) during play.

## How to verify / iterate

- `node .claude/scripts/validate.js` (local), POST `config.json` to `https://voyagewiki.pages.dev/api/validate` (authority), `node .claude/scripts/count.js` (budgets).
- Decision history: OPEN-QUESTIONS.md. Canon reference: WORLD-BIBLE.md. Mechanics blueprint: NEN-DESIGN.md. Roster: ROSTER.md. Geography registry: GEOGRAPHY.md.
