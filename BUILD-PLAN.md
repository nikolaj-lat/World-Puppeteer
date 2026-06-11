# BUILD-PLAN.md — Hunter x Hunter: Complete World (V33)

Eight-arc multi-start world. Permadeath off, per-arc power baselines, per-start spoiler scoping. Mature content matching source. Validate (local + remote) and git-commit after every phase.

## Toolkit inventory (Phase 0)
- **Agents/skills (1:1, 19 content + 4 utility):** abilities, ai-instructions, archetypes, factions, items, locations, name-filter-settings, npc-types, npcs, premade-characters, quests, realms, regions, settings, skills, story-starts, traits, triggers, world-background, world-lore + count, charts, maps, review-npcs (and canon-npcs workflow, japanese-romanization).
- **Hooks:** post-edit validation + auto-rebuild of config.json fire on every tabs edit. Local `validate.js`, remote `POST /api/validate` (newer than repo sync — final authority).
- **Caps (count.js):** total 10M chars; npcs 1M; worldLore 500k; npcTypes 500k; regions 500k; locations 1M; items/factions/traitCategories 100k; premades 100 entries × 20k chars; abilities ≤1000; semantic triggers ≤200; mechanical ≤500; storyStarts ≤100.

## Phases

**P1 — World Bible + NEN-DESIGN.md** ⟵ creator sign-off gate
- `WORLD-BIBLE.md` (repo root, not tabs): canon state matrix per arc — who is alive, Troupe roster, org leadership, Gon/Killua status, known secrets per era. Drives spoiler scoping later.
- `NEN-DESIGN.md`: aura as resource; Ten/Zetsu/Ren/Hatsu + advanced applications (Gyo, In, En, Shu, Ko, Ken, Ryu) as skills/abilities; six Nen categories as trait category with hexagon-affinity penalties; Water Divination as character-creation step; Vows & Limitations as conditional mechanical buffs; per-arc power baselines. Mapped concretely onto V33 primitives.
- **STOP for approval of both.**

**P2 — Settings + world background + world lore**
- settings agent: attributes, resources (Aura), skill/combat/death/location/item/other settings incl. `newSkillGenerationEnabled` (pending Q-001 answer).
- world-background + world-lore agents: core setting, Hunter Association, Nen lore, per-arc lore entries (Dark Continent marked EXTRAPOLATED).

**P3 — Mechanics**
- traits + trait categories (Nen category system, origins), skills (Nen basics + applications + mundane), abilities (canon Hatsu library + generic), triggers (vow enforcement, arc-state flags), combat/death numbers per NEN-DESIGN.
- Chart triggers with charts utility as sanity check.

**P4 — Geography**
- realms: the known world (six continents map), Greed Island, Dark Continent as separate realms.
- regions + locations per arc needs (Zaban City, Kukuroo Mountain, Heavens Arena, Yorknew, Greed Island zones, NGL/East Gorteau, election HQ, Black Whale...). Map utility render.

**P5 — Factions + NPC types + NPCs**
- factions: Hunter Association, Phantom Troupe, Zoldyck Family, Chimera Ants, Mafia community, Zodiacs, Kakin princes' camps, etc.
- npc-types: Human, Nen-user tiers, Chimera Ant castes, Royal Guard, Magical Beasts.
- npcs: broad supporting cast within 1M budget (count utility polices).

**P6 — Premade characters** ⟵ creator approval gate for roster
- Propose ≤100 marquee roster first; on approval, author via premade-characters agent.

**P7 — Items + quests**
- Canon items (Ben's knife, fishing rod, yo-yos, Greed Island cards as items, etc.); arc questlines via quests + triggers.

**P8 — Story Starts + AI instructions**
- 8 starts with era-correct state, spoiler scoping, power baselines, starting gear/abilities.
- ai-instructions: narrator voice, content rules (mature; sexual content deferred to Voyage's filter), per-start spoiler scoping rules, Nen adjudication guidance, summarization memory rules. Name filters for HxH naming conventions.

**P9 — Full validation + playtest sanity**
- count + local validator + remote validate on compiled config.json; fix all errors; review warnings.
- Sanity walkthrough of 2–3 starts (Hunter Exam, Yorknew, Chimera Ant) checking state/spoiler logic.
- Build report + final OPEN-QUESTIONS.md state. Final commit.

## Working rules
- All tabs edits go through the troupe agents (orchestrator never edits tabs directly).
- Background-mode agents get the "do not ask questions" directive.
- Remote validator is schema authority when it disagrees with repo skills — but every disagreement gets logged in OPEN-QUESTIONS.md first.
- Commit message per phase: `hxh: phase N — <summary>`.
