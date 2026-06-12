# REVIEW-FINDINGS.md — HxH World Quality Review (Phase 1 Audit)

Date: 2026-06-12. Read-only audit. Validator: **0 errors / 0 warnings / 137 recommendations**.
Severity key: **blocking** (breaks intent or a feature is dead) · **weak** (works but shallow/templated) · **polish** (nice-to-have).

Sources: own depth-audit script (`stuff/audit-depth.js`), remote validator recommendation triage,
required-reading wiki pages (`stuff/wiki/`), manual spot-checks. Three narrative agents
(review-npcs, npc-type-review, charts) were launched but **died on session limit (reset 12:30pm
Berlin) before writing reports** — those deep-read passes are deferred, not done (see §7).

---

## SUMMARY — Systemic Patterns

1. **The AI tab is the headline gap, exactly as briefed.** Six AI tasks run on pure engine
   defaults (3 present-but-empty, 3 absent entirely). Every per-task budget has enormous headroom
   (largest is generateStory at 6,200 / 20,000). This is the single highest-leverage fix area.
2. **`randomNames` is a dead pool — a real build bug.** archetypes.json defines a 50+50 HxH name
   pool; meta.json carries an empty `{male:[],female:[]}`. The build merges files alphabetically,
   so meta.json (read after archetypes.json) **clobbers the populated pool to 0/0 in config.json.**
   The names the build-report claims exist are not reaching the engine.
3. **Location *areas* are the depth weak-spot, not basicInfo.** Location/region/NPC/premade
   *primary* descriptions are all healthy. But **49 of 87 location areas are sub-150-char
   one-liners** ("A high vantage point offering views across the island.") — the thinnest authored
   prose in the world.
4. **`gameModes` and `tipSettings` are empty** — two whole player-facing features unshipped.
5. **NPCs & premades are statistically healthy.** 108 NPCs (basicInfo median 406, hiddenInfo
   median 1,129, all ARC-tagged, voiceTag on 107/108); 91 premades (description median 1,056).
   Bulk metrics are green; the *narrative-quality* read is the deferred item.

---

## 1. AI TAB (priority focus) — `tabs/ai-instructions.json`

| # | Finding | Section | Severity | One-line fix |
|---|---|---|---|---|
| A1 | `generateNPCIntents` absent → engine default; no Nen-aware scene classification, intent gates, or escalation ladder | aiInstructions | **weak** | Add Classifier + Who-Gets-Intents + Escalation + Scene-Integrity keys, Nen-tiered presence (wiki pattern) |
| A2 | `generateNewNPC` absent → no mandatory-fields/naming-by-origin/visualDescription-tag rules for improvised NPCs | aiInstructions | **weak** | Add custom: mandatory fields, HxH naming registers, tag format, tier default `average`, restricted-spawn list (no Ants/Royal Guards ambiently) |
| A3 | `generateNPCUpdates` absent → no evidence-gated damage/death/rename/relationship rules; AI may kill/rename NPCs on math alone | aiInstructions | **weak** | Add custom: "only when Recent Story shows X" gates; death needs 0 HP AND narrative confirm; Nen/era-aware |
| A4 | `generateRegionDetails.custom` empty | aiInstructions | **weak** | HxH geographic identity, faction texture, location-naming, era-routing for the 3 realms |
| A5 | `generateFactionDetails.custom` empty | aiInstructions | **weak** | Public-face-vs-operating-reality; members show loyalty through behavior; era-correct |
| A6 | `generateLocationDetails.custom` empty | aiInstructions | **weak** | Three sensory layers on entry; archetype-as-spine; Nen-residue/era rules |
| A7 | `generateCharacterBackground.prompt` is `""` (engine default prompt, only `custom` appended) | aiInstructions | polish | Author a 2-section HxH prompt (Background 6-8 sent + Appearance 3 sent) per wiki worked example |
| A8 | `generateEncounters.custom` exists but thin (816) — no difficulty/era mix ratio, no Zetsu-wall scaling table | aiInstructions | polish | Add difficulty tiers, dangerous:non-dangerous ratio, non-combat-first conditions |
| A9 | `generateItemGenerationAndUsage` solid but single block; could add Nen-conductor/conjured-item provenance depth | aiInstructions | polish | Optional second labeled section |
| A10 | `gameModes` is `{}` — feature unshipped | gameModes | **weak** | Propose 2–4 modes: Canon-Faithful, What-If Divergence, Hardcore Nen-Crunch, Story-Focused (each a full markdown brief + difficulty preset) |
| A11 | `narratorStyle` at 1,465/2,000 (73%) — earning its budget but lacks explicit NPC-default + prohibition blocks the wiki flags as highest-value | narratorStyle | polish | Tighten; add "strangers are strangers / no exposition dumps / no rescue-from-consequences" if room |
| A12 | `imagePromptConfiguration` is 3 single-paragraph styles — no humanoid/creature split, no scaffold+slot structure | imagePromptConfiguration | polish | Add labeled `Humanoid:` / `Creature:` sections + per-instance slot lists (Ants, beasts need creature anatomy) |
| A13 | `summarization.custom` good; verify it names every load-bearing fact (vow conditions, era flag, aura state) — it does | summarization | ✅ ok | none |

Headroom note: every task is far under the 20k/task and 5k/leaf caps. generateStory (the protected
budget) sits at 6,200 — additions to *other* tasks cost it nothing.

---

## 2. OTHER TAB (priority focus)

| # | Finding | Section | Severity | One-line fix |
|---|---|---|---|---|
| O1 | **`randomNames` clobbered to 0/0 in config** (meta.json empty overwrites archetypes.json 50/50) | meta.json + archetypes.json | **blocking** | Delete the empty `randomNames` block from meta.json so archetypes' pool survives the merge; re-build |
| O2 | `tipSettings.tips` empty, `tipDisplayEnabled:false` — player-facing channel unused | tipSettings | **weak** | Add ~12 HxH tips (Nen cost ladder, vow risk, Water Divination, Zetsu wall, era-spoiler etiquette, Jenny scale); enable display |
| O3 | `encounterElements` = 20 entries (wiki target 15–25) ✅ but several are later-arc-only (Ant-Remnant, Greed Island Remnants, Succession) with no era-gating note | encounterElements | polish | Fine count; rely on generateEncounters era rules to gate — or add 2-3 early-era-safe generic entries |
| O4 | `authorSeeds` = 10 (wiki target 10–20, floor) — adequate but at the low edge | authorSeeds | polish | Optionally add 3–5 HxH-register seeds (e.g. "Hunter Exam Survivor", "Nen Master's Discipline") |
| O5 | `characterArchetypes` = 13 (wiki target 15–25) — under target | characterArchetypes | polish | Add 2–4 archetypes (e.g. Nen Prodigy, Conjurer-Obsessive, Reformed Killer) |
| O6 | `locationArchetypes` = 11, `regionArchetypes` = 23 — both within target ✅ | archetypes | ✅ ok | none |
| O7 | `locationSettings`: `regionLocationCount:0`, `regionFactionCount:0` — engine generates **zero** POIs/factions in any AI-made region | locationSettings | **weak** | Set realistic targets (e.g. 4–6 locations, 2–3 factions) so generated regions aren't barren; verify avgTravelDistance(40) ≤ regionSize(100) ✅ |
| O8 | `otherSettings.npcMinHealth:10` is low vs wiki example (66); fine for civilians but check it doesn't make every street NPC one-shot trivia | otherSettings | polish | Confirm intentional (Zetsu-wall design favors low civilian HP) — likely keep, document |

---

## 3. VALIDATOR RECOMMENDATIONS (137) — Triage

| Group | Count | Verdict |
|---|---|---|
| `npcs.*` "has basicInfo+abilities but detailType unset" | 108 | **Ignore (by design).** detailType defaults to `"detailed"` when omitted, which is exactly what authored NPCs want (prevents engine overwrite). Setting it explicitly is optional noise. |
| `regions.*.npcLevelRange` unset | 12 | **Fix (weak).** Set per-region npcLevelRange to hold the per-arc difficulty curve (early exam zones low, Dark Continent high). |
| `regions.*` "fewer than 3 locations" | 6 | **Partial fix (polish).** Most are intentional (boss-arena / voyage pockets: Lake Mobius, The New Shore, Kakin Empire). Add 1-2 only where it serves play. |
| `aiInstructions.*` empty task | 6 | **Fix (weak)** → see §1 A1–A6. |
| `quests` missing `questType` | 16 (1 agg) | **Fix (polish).** Add questType (main/side/etc.) to all 16; cheap journal-framing win. |
| `locations.*.paths` one-way (Floor 200 Corridor, Woble's Suite) | 2 | **Verify (polish).** Likely intentional sealed/secured entries; confirm and leave, or make bidirectional. |
| `storyStarts.*.startingItems` separate-ID warning (Greed Island, Yorknew) | 2 | **Fix (weak).** Move those startingItems to `itemSettings.startingItems` or a trait loadout so `item-remove` ops work. |

---

## 4. LOCATION AREAS — `tabs/locations.json`

- **49 / 87 areas under 150 chars.** Primary `basicInfo`/`hiddenInfo` are healthy; the *areas* are
  bare one-liners. Worst offenders (all areas thin): Zevil Island, Masadora, Soufrabi, Limeiro,
  Dorias Wastes, Mt. Kabool, Harbview Hospital, World Tree, Kakin Royal Capital, Forbidden Landing,
  Peijin, Arena District, Cemetery Building, Lingon Airport, East Gorteau Royal Palace (3/4 thin).
- **Severity: weak.** Areas feed `generateLocationDetails`; thin areas + empty A6 instructions =
  the narrator improvises blind. Fixing A6 mitigates; deepening the worst ~15 areas is the durable fix.
- Whale Island & Dolle Harbor (the A1/A8 first-impression anchors) each have 1-2 thin areas worth
  raising first.

---

## 5. QUESTS, STORY STARTS, REGIONS — depth OK, metadata gaps

- **Quests (16):** questDesignBrief 408–705 chars (healthy); all wired to triggers. Gaps: no
  `questType` (16), and 5 have no `questGiverNPC`. Severity polish.
- **Story starts (8):** description ~230, storyStart 1,000–2,200 (healthy). Dark Continent A8 is the
  short one (1,041) — trimmed under entry cap per git log; verify it still reads complete. Severity polish.
- **Regions (12):** basicInfo 614–867 (healthy); only the npcLevelRange gap (§3). Severity polish.

---

## 6. NPCs — bulk-healthy, but a narrative read found real defects

**Bulk metrics (all green):** 108 NPCs, basicInfo med 406 / hiddenInfo med 1,129; voiceTag 107/108
(missing **Mike**, the guard-dog — fine for a beast); properName/aliases/visualDescription 0 used
(optional). Premades (91): description med 1,056. Factions (14): hiddenInfo 1,131–1,631. Lore (54):
none thin. Crash-salvaged **Phantom Troupe (13) and Greed Island GMs (3) confirmed complete, not
truncated** — Troupe is the strongest-written cluster in the cast.

**The narrative-quality read (review-npcs agent) found what the scripts can't:**

| # | Finding | NPC(s) | Severity | Fix |
|---|---|---|---|---|
| N1 | **CANON ERROR: hiddenInfo calls Hisoka "a Specialist Nen user and master of the Transmutation ability Bungee Gum." Hisoka is a Transmuter, not Specialist** — highest-profile character in the cast | Hisoka Morow | **blocking** | Delete "Specialist Nen user and"; he is a Transmuter |
| N2 | **Build directive leaked into narrative prose**: hiddenInfo ends "This information is marked explicitly as hidden because it must not appear in basicInfo…" — an author note, not lore | Saiyu | **weak** | Strip the meta sentence |
| N3 | **Zodiac bloc templating**: 7 hiddenInfos share a verbatim skeleton (animal-of-Zodiacs → category-unrevealed → election-background → boards-Black-Whale → hidden-concern-is-X). Swap two names, nothing breaks — the cast's biggest fixable weakness | Kanzai, Pyon, Botobai, Saccho, Ginta, Cluck, Gel | **weak** | Inject one concrete, non-fungible hook per Zodiac |
| N4 | **"X whose Y masks Z" contradiction-opener** repeated ~12× across villains until they read machine-stamped | Genthru, Pariston, Tserriednich, Shalnark, Feitan, Camilla, Cluck, arena trio… | **weak** | Light varying pass on the ~12 worst openers (keep the house style, break the sameness) |
| N5 | Soft canon: Cheetu's death framed as a Silva confrontation (canon: killed in the invasion; Silva only humiliated him) | Cheetu | polish | Soften to "killed during the Hunter invasion" |
| N6 | Soft canon: Nobunaga called "second-ranking member (#1)" — spider numbers aren't a command ladder | Nobunaga | polish | "spider #1", drop "second-ranking" |
| N7 | Redundant twins: arena trio (Gido/Sadaso/Riehlvelt) interchangeable; Bomber pair (Sub/Bara) functionally identical; A8 utility bodyguards (Bill/Theta) low-friction | several | polish | Differentiate role/function per the report's suggestions |
| N8 | Greed Island GMs (List/Dwun/Eta) have **author-assigned Nen categories not in ROSTER.md** — coherent invention, flag only if you want them registered | List, Dwun, Eta | polish | Decide canon-adjacent vs note-as-invented; optionally add to ROSTER |

**Top-10 weakest (revision priority):** Hisoka (canon) → Gel → Cluck → Kanzai → Ginta → Pyon →
Botobai → Saccho → Bill → Sub. Arc-gating, spoiler walls, Troupe numbering and death-gating are
all **clean** — canon fidelity is otherwise excellent. Full table: `stuff/review-npcs-report.md`.

---

## 7. NARRATIVE DEEP-READS — ✅ ALL COMPLETE

- **review-npcs** — ✅ done → §6 (N1–N8). `stuff/review-npcs-report.md`.
- **npc-type-review** — ✅ done → §8 (T1–T6). `stuff/npc-type-review-report.md` (per-type table truncated; systemic set complete).
- **charts** — ✅ done → §9 (G1–G4). `stuff/trigger-chart.html` + `stuff/triggers-chart.md`.

**The Phase 1 audit is now complete. No outstanding reads.**

---

## 8. NPC TYPES (13) — `tabs/npc-types.json` (npc-type-review agent)

| # | Finding | Type(s) | Severity | Fix |
|---|---|---|---|---|
| T1 | **Nen Initiate mirrors Trained Fighter's exact resist/vuln profile** (both resist physical, vuln to all else) — collapses "just opened nodes" into "career non-Nen soldier"; the Zetsu-wall ladder loses a rung | Nen Initiate vs Trained Fighter | **weak** | Give Nen Initiate partial nen-resistance (fledgling Ten) so it sits *above* Trained Fighter on the wall |
| T2 | **Coverage gap**: Ikalgo (Emitter) and Welfin (Manipulator) are Nen-using Ants but type "Chimera Ant Soldier" declares no nen resistance → mechanically defenseless vs nen despite canon aura | Chimera Ant Soldier | **weak** | Add nen resistance to the type, or retype the two Nen-users to Squadron Leader / a sub-type |
| T3 | Tserriednich typed "Nen Professional" but is Master-tier by A8 and billed as among the Black Whale's deadliest | Nen Professional (Tserriednich) | polish | Retype to Nen Master, or document the era-snapshot intent |
| T4 | Alluka/Nanika typed "Civilian" — Nanika is a Dark-Continent Gas-Life entity, not an ordinary auraless human; defensible but unnuanced | Civilian (Alluka) | polish | Acceptable; optionally note the edge case in the type text |
| T5 | Type descriptions read as combat-stat footnotes — lack sensory texture / mannerism / contradiction | Trained Fighter, Nen Initiate, Nen Professional | polish | Add a line of archetype personality to the human-tier types |
| T6 | Game Construct, Manipulated Puppet, Nen Beast have zero NPCs assigned — not a defect (future/arc content); arc-validity confirmed A5–A8 | 3 unused types | ✅ ok | Confirm intentional; no change |
| T7 | **Chimera Ant King type description names "Meruem" directly** — a spoiler visible in type metadata to players in arcs A1–A5 | Chimera Ant King | **weak** | Genericize the type text; keep "Meruem" only in arc-gated NPC hiddenInfo |
| T8 | Civilian type text implies "expendable/no aura," but houses mythic-tier NPCs (Komugi, Alluka) who are anything but | Civilian | polish | Broaden the type text to cover exceptional non-combatants |

(Agent rated T1 and T2 as *blocking* on mechanical grounds — they erase a Zetsu-wall rung and leave
two Nen-users defenseless. Logged here as **weak** under the depth/validity scheme since neither
fails validation, but both are first-priority within Tier 4.)

(Per-type detail table in `stuff/npc-type-review-report.md` was truncated after the systemic
summary; the six issues above are the complete actionable set.)

## 9. TRIGGERS (22) — `tabs/triggers.json` (charts agent)

Chart rendered: `stuff/trigger-chart.html` + `stuff/triggers-chart.md`. No unreachable triggers.

| # | Finding | Severity | Fix |
|---|---|---|---|
| G1 | **No `quest-init` effect fires anywhere** — all 16 quests are seeded only via `startingQuests` in story-starts. Reaching an arc location by *travel* (not its story-start) sets the `arc` flag and reveals entities but **seeds no quests** | **weak** | Add quest-init to each Arc Setup trigger (or accept that quests are start-only by design and document it) |
| G2 | Arc-setup gate is `game-tick <= 2`, looser than the `<=1` the build-report claims; all 8 write the same `arc` key last-write-wins with no guard | polish | Tighten to `<=1`, or add a "arc not yet set" guard to prevent any early double-write |
| G3 | Water Divination triggers don't require awakened Nen — a player can resolve their Nen *category* while still `Nen-Unawakened` (no ordering link to Nen Awakening) | polish | Add an awakened-Nen precondition to the divination triggers |
| G4 | `Vow: Conditional Arsenal` quirk text says "drains 50% of your aura" but its trigger applies `aura ×0.3` (−70%) — flavor/mechanics mismatch | polish | Align the trait text to −70% (or the trigger to −50%) |

Vows: clean 1:1 (8 traits ↔ 8 Vow-Broken triggers, no orphans). Arc-setups: no same-tile double-fire.

---

## PRIORITIZED REMEDIATION PLAN (for approval)

**Tier 0 — bugs & canon defects (do first; small, high-value):**
- O1: un-clobber `randomNames` (remove empty block from meta.json; rebuild → pool restored).
- N1: **Hisoka "Specialist" → Transmuter** (canon error on the marquee character).
- N2: strip the leaked build-directive sentence from **Saiyu**'s hiddenInfo.
- N5/N6: soft canon — Cheetu death attribution; Nobunaga "second-ranking."
*Agents: npcs (N1/N2/N5/N6), direct/meta (O1).*

**Tier 1 — AI tab (highest leverage, the brief's core):**
- A1–A6: author the six engine-default AI tasks (NPC-intents, new-NPC, NPC-updates, region,
  faction, location details) — HxH-specific, era-aware, Nen-aware. *ai-instructions, incremental.*
- A10: build `gameModes` (2–4 modes).

**Tier 2 — Other tab + metadata (player-facing, cheap wins):**
- O2: `tipSettings` (~12 tips + enable). O7: `locationSettings` region/faction density.
- §3: regions `npcLevelRange` (12) + quests `questType` (16). §3 startingItems relocation (2).
*Agents: settings, regions, quests, story-starts.*

**Tier 3 — the cast's weakest cluster (high narrative payoff):**
- N3: de-template the 7-NPC **Zodiac bloc** — one concrete hook each (the single biggest cast lift).
- N4: light varying pass on the ~12 "X-masks-Z" villain openers.
- N7: differentiate the redundant twins (arena trio, Bomber pair, A8 bodyguards).
*Agent: npcs, incremental.*

**Tier 4 — structural & type fixes:**
- T1: lift Nen Initiate above Trained Fighter on the Zetsu wall. T2: fix Ant Soldier nen-resistance
  gap (Ikalgo/Welfin). G1: decide quest-init (add to arc-setups, or document start-only).
- G2/G3/G4: arc-setup tick guard; divination awakened-precondition; Conditional Arsenal text/mechanic align.
*Agents: npc-types, triggers, traits.*

**Tier 5 — depth polish (optional, time-permitting):**
- §4: deepen the worst ~15 location areas. A7/A8/A11/A12: remaining AI polish (background prompt,
  encounters depth, narratorStyle prohibitions, image scaffold/slots). O4/O5: top up
  authorSeeds/characterArchetypes to wiki targets. T3/T4/T5: type retypes + texture. N8: ROSTER
  decision on Greed Island GM Nen categories.

Validation gate after every batch: build.js → validate.js → remote POST → count.js → git commit.
Decisions logged in OPEN-QUESTIONS.md. Closes with a BUILD-REPORT.md "Review pass" section + final validation.
