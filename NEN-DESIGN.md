# NEN-DESIGN.md — Mapping Nen onto V33 Primitives

Target: medium-heavy crunch. Every Nen concept below names the exact V33 primitive that carries it. Requires creator sign-off before any mechanics authoring (P3).

---

## 1. Attributes (`attributeSettings`)

Six attributes, HxH-flavored:

| Attribute | Covers | Mechanical hooks |
|---|---|---|
| `strength` | Raw power, Enhancer physicality | `attributeDamageModifiers: { strength: 1 }` (+1% outgoing damage/pt) |
| `agility` | Speed, reflexes, evasion | `attributeEvasionModifiers: { agility: 1 }` (-1% incoming damage/pt) |
| `endurance` | Toughness, pain tolerance | `attributeStatModifiers`: +4 health max per point |
| `intellect` | Strategy, analysis, Conjurer/Manipulator finesse | drives knowledge/tactics skills |
| `willpower` | Aura capacity, focus, killing intent resistance | `attributeStatModifiers`: +5 aura max per point — **the Nen stat** |
| `presence` | Social force, intimidation, deception | drives social skills |

Creation: `startingAttributeValue: 8`, `startingAttributePoints: 12`, `maxStartingAttribute: 15`. `lowAttributeTraits` for flavor weaknesses (e.g. low willpower → "Leaky Aura").

## 2. Resources (`resourceSettings`)

| Key (lowercase) | Role |
|---|---|
| `health` | `isHealth: true`. maxValue 80, gainPerLevel 10 (engine-balanced numbers). |
| `aura` | **The centerpiece.** maxValue 0 at base — granted by Nen Training traits + willpower via `attributeStatModifiers`. `rechargeRate` low (2/tick — aura recovers slowly in the field), `restRechargeMultiplier` high (5× — meditation/sleep restores it). Color: white-violet `#b39ddb`. |

`aura.usageInstructions` (narrator-facing) encodes the cost ladder:
- Maintaining **Ten**: free (default state for trained users; untrained leak constantly).
- **Zetsu**: costs nothing, *suppresses* recharge while active; grants stealth, removes all aura defense (incoming damage treated as vs. defenseless).
- **Ren**: small drain per combat turn (~2-5%) while amplifying output.
- **Hatsu** abilities: each ability description states its cost band; default 10-20% of max per activation.
- **Ko**: huge spike (25-40%) for one decisive strike; **En**: severe sustained drain (10%+/turn, Specialist/Enhancer masters only).
- Aura at 0 = Zetsu-state exhaustion: no Nen abilities, defenseless against Nen, narrator imposes fatigue.

## 3. Nen Training Tiers (trait category, `maxSelections: 1`)

Power baselines as a creation-time tier ladder. Category name: **"Nen Training"**.

| Trait | Grants | Intended arcs |
|---|---|---|
| `Nen-Unawakened` | +0 aura (aura bar stays ~0 until awakening; see §8 triggers) | Hunter Exam, Zoldyck |
| `Nen Initiate` | +30 aura, Ten skill +2 | Heavens Arena onward |
| `Nen Practitioner` | +60 aura, Ten +4, Ren +3, category skill +3 | Yorknew, Greed Island |
| `Nen Adept` | +100 aura, Ten +6, Ren +5, category skill +5, one advanced-application ability unlocked | Chimera Ant, Election |
| `Nen Master` | +150 aura, Ten +8, Ren +7, category skill +7, two advanced applications | Dark Continent, top-tier premades |

Tier traits are also the **per-arc power baseline lever**: each Story Start's description and its arc-setup trigger (§8) tell the narrator which tier is era-appropriate; premades carry their canonical tier explicitly. (V33 cannot hard-restrict trait choices per start — this is narrator-guided, logged as a soft constraint.)

## 4. The Six Categories (trait category, `maxSelections: 1`) + Hexagon

Category name: **"Nen Category (Water Divination)"**. Selecting one IS the Water Divination result — each trait's `description` opens with what the player's divination showed (water overflowed = Enhancer, taste changed = Transmuter, impurities = Conjurer, leaf moved = Manipulator, color changed = Emitter, "something else entirely" = Specialist).

Six **category skills** exist (`Enhancement`, `Transmutation`, `Conjuration`, `Emission`, `Manipulation`, `Specialization`). Each category trait encodes the **hexagon proximity ladder** (100/80/60/40% canon efficiency) as additive skill modifiers:

| Trait | +4 (native) | +3 (adjacent) | +2 (two steps) | +1 or 0 (opposite/special) |
|---|---|---|---|---|
| `Enhancer` | Enhancement | Transmutation, Emission | Conjuration, Manipulation | Specialization +0 |
| `Transmuter` | Transmutation | Enhancement, Conjuration | Emission, Specialization +1 | Manipulation +1 |
| `Conjurer` | Conjuration | Transmutation, Specialization +2 | Enhancement, Manipulation | Emission +1 |
| `Manipulator` | Manipulation | Emission, Specialization +2 | Conjuration, Enhancement | Transmutation +1 |
| `Emitter` | Emission | Enhancement, Manipulation | Transmutation, Specialization +1 | Conjuration +1 |
| `Specialist` | Specialization | Conjuration, Manipulation | — | others +1 |

(Exact ladder values tuned at authoring; the table encodes adjacency.) The `quirk` field on each trait restates the hexagon rule so the narrator penalizes off-category attempts narratively too. A `generateActionInfo` instruction enforces: *"Hatsu used outside native/adjacent categories suffers efficiency loss; opposite-category conjuration-by-an-enhancer should visibly strain or fail."*

Water Divination for undecided players: an `Undivined` trait (no modifiers) + a semantic trigger — when the story shows the player performing Water Divination, the trigger swaps `Undivined` for the AI-chosen category trait via `player-traits` effects and narrates the glass.

## 5. Skills (`skills` tab)

**Nen principles** (type `"nen"`, attribute `willpower` unless noted): `Ten`, `Zetsu` (agility), `Ren`, `Hatsu`, plus the six category skills above.
**Advanced applications are abilities, not skills** (they're techniques you fire, not tracks you grind) — see §6.
**Mundane skills** (type `"none"` or `"combat"`/`"social"`/`"knowledge"`): Martial Arts, Weapon Mastery, Stealth, Acrobatics, Perception, Tracking, Survival, First Aid, Tactics, Negotiation, Intimidation, Deception, Gambling, Engineering, Assassination Techniques.
`skillTypeDifficultyBonus`: `{ "none": 0, "nen": 0, "combat": 0, "social": 0, "knowledge": 0 }` (tuned later if needed).
`newSkillGenerationEnabled: true` (D-005), constrained by `generateLearnedAbilities`/AI instructions to keep inventions Nen-coherent.

## 6. Abilities (`abilities` tab)

**Tier A — Advanced applications** (universal, gated by Nen skill levels):

| Ability | Requirements | bonus / cooldown sketch |
|---|---|---|
| `Gyo` (eyes) | Ten ≥2, Ren ≥1 | small bonus, cd 0 — perception of hidden aura/In |
| `Shu` (object coat) | Ten ≥3, Ren ≥2 | medium, cd 0 |
| `In` (conceal) | Zetsu ≥3, Ren ≥2 | medium, cd 1 |
| `Ken` (full guard) | Ten ≥4, Ren ≥3 | defensive bonus, cd 1 |
| `Ko` (all-in strike) | Ren ≥5, category skill ≥4 | large bonus, cd 3, big aura cost in description |
| `Ryu` (flow) | Ko unlocked, Ren ≥6 | large, cd 1 |
| `En` (aura field) | Ren ≥7, trait `Enhancer` or `Specialist` (canon-flavored gate) | utility, cd 2, severe drain |

**Tier B — Canon Hatsu** (one or more per marquee character): gated by `requirements: [{type:'trait', variable:'Hatsu: <Name>'}]`. Each premade's `traits` array includes their personal `Hatsu: …` trait(s) (zero-modifier marker traits in a hidden-from-creation category with `maxSelections: 0` is impossible — instead a "Hatsu" trait category with `maxSelections: 1` lets original characters take a generic developable Hatsu while premades carry canon ones). Examples: Jajanken (Rock/Paper/Scissors as three abilities), Bungee Gum, Godspeed, Chain Jail, Skill Hunter, Emperor Time, Royal Guard techniques. Descriptions carry exact costs, conditions, and vow text — the narrator enforces conditions; `bonus`/`cooldown` carry the crunch.

**Tier C — Generic Hatsu seeds** for original characters: one per category (e.g. `Hatsu: Enhancer's Edge`), explicitly described as a developing personal ability the player names and shapes in play (supported by `generateLearnedAbilities` instructions).

Ability cap is 1000 — comfortable. `combatSettings.abilityCooldown: 1` (cooldowns real), `abilityBonus: 1`.

## 7. Vows & Limitations (traits + triggers)

A **"Vows & Limitations"** trait category (`maxSelections: 2`) holds creation-time vows; play-time vows are added by triggers via `player-traits`.

- Each vow trait = real mechanical buff (skill/attribute/resource modifiers) + `quirk` stating the binding condition. Examples: `Vow: One Target Only` (+3 to a named skill vs. sworn target, narrator-enforced uselessness elsewhere), `Vow: Conditional Arsenal` (ability only under stated condition, +aura max), `Vow: Death Pact` (huge buffs; breaking it = death narration — permadeath is off, so the death system's `instructions` handle the consequence).
- **Enforcement**: one semantic trigger per authored vow — `query` matching "the player violates/abandons <condition>" → effects: `player-traits remove` (vow trait), `player-resource subtract aura 50%`, `story` instruction narrating the backlash. Semantic trigger cap is 200; budget ~12-20 for vows.
- `generateActionInfo` instruction: vows are absolute; the narrator never lets a vow-broken ability fire.

## 8. Arc State & Spoiler Scoping (triggers + storage)

Story Starts can't set state, so each of the 8 starts gets a unique starting **location**, and one mechanical trigger per arc fires on turn 1:
`conditions: [game-tick ≤ 1, party-location equals <arc start location>]` → effects: `write-string arc = <arc-id>`, `known-entity` sets for era-known NPCs/factions, `story` instruction summarizing era state (who is alive, Troupe roster, public knowledge).
Narrator-side: `aiInstructions` carry a per-arc routing block (*"Read the arc flag from trigger context; never reveal later-arc facts: if arc=hunter-exam, Ging's location, Troupe membership, Kite's fate, and Nen itself beyond rumor are unknown..."*). World lore entries are written era-neutral with explicit "revealed only in arc ≥ X" tags the instructions respect.

Awakening recipe (Exam/Zoldyck starts): player starts `Nen-Unawakened` with ~0 aura; a semantic trigger ("the player's aura nodes are forcibly or gently opened / completes Ten initiation") swaps the trait for `Nen Initiate` (+30 aura) — the Hatsu-baptism moment.

## 9. Combat & Death

- `damageTypes`: `physical`, `nen`, `fire`, `lightning`, `ice`, `poison`, `psychic`. NPC types use these for resist/immune walls (e.g. post-Rose Meruem resists physical; Zetsu users vulnerable to everything).
- **The Zetsu wall**: NPC-type immunity — Nen users' `nen`-coated defense resists `physical` from non-users; AI instruction: *"A Nen user in Ten cannot be meaningfully harmed by an unawakened attacker."*
- `death.permadeath: false` (locked). `instructions`: survival-at-a-cost in HxH register — crippling injury, lost limb (Gon's arm, Kurapika's lifespan), a Nen beast's bargain, or waking under medical Hunters; *never* a clean reset, always a scar or debt.
- `otherSettings`: maxCharacterLevel 999; npcHealthPerLevel ~12 (Nen-tier NPCs run strong/elite/boss/mythic tiers for Royal Guards/Meruem).

## 10. What stays narrator-side (explicitly NOT mechanized)

Nen categories of NPCs improvised in play (AI instructions give the hexagon vocabulary); emotional aura reading; Manipulator control rules; conditions of individual canon Hatsu beyond their description text. Rationale: V33 triggers cap at 200 semantic / 500 mechanical — spend them on vows, arc state, awakening, and quest wiring, not on simulating every aura interaction.

## Open design choices for sign-off

1. **Tier ladder numbers** (§3) — aura amounts and skill bonuses are first-pass; tune during P3?
2. **Jajanken as 3 abilities vs 1** — proposed 3 (Rock/Paper/Scissors with distinct costs/cooldowns).
3. **"Hatsu" trait category visible at creation** (original characters pick a generic category-matched Hatsu seed) — proposed yes.
4. **En gate** (§6) — canon says any master can learn En but it's rare; proposed gating to Enhancer/Specialist traits OR Nen Master tier. Pick: tier-gated instead of category-gated?
