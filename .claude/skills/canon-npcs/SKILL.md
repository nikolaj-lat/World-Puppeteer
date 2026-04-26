---
name: canon-npcs
description: Workflow for researching and adapting folklore/historical figures into NPCs
---

# Canon NPCs

Research folklore, yokai, mythology, and historical figures using web search, then write the four lore fields — `basicInfo`, `hiddenInfo`, `personality`, and `abilities` — directly onto existing NPC skeletons in `tabs/npcs.json`.

This is a self-contained workflow skill. It produces only the lore-rich fields that require deep research, writing them directly to existing NPC entries. All other NPC fields (tier, level, hpMax, location, etc.) must already exist on the skeleton or be set separately.

## Workflow Phases

### Phase 0: Context

Before starting, read `tabs/world-background.json` to understand the world's setting, current crisis, tone, and core mechanics. Abilities and traits that seem extraordinary in folklore may be mundane in the world's system — verify before treating them as distinctive. This context shapes how research findings are adapted — especially hiddenInfo (relationship to the crisis) and ability framing.

Before drafting any field, read completed NPC entries of the same or similar type in `tabs/npcs.json` to internalize the voice, sentence structure, vocabulary level, and formatting conventions already established. Match them.

This instruction applies at every drafting point — not just at session start. Before drafting abilities, read abilities of the same type. Before drafting hiddenInfo, read hiddenInfo of batch-mates. Before customizing a shared ability description, check how existing NPCs of the same type have handled it. When in doubt about whether a convention exists, check before asking the user.

### Phase 1: Research

**Web search is mandatory. Never skip this step.**

Spawn 6 research subagents in parallel using the `Task` tool (`subagent_type: general-purpose`). Agents are split across two languages and three focus areas to maximize source diversity and depth.

#### Query Angles

| Agent | Language | Focus |
|-------|----------|-------|
| 1 | English | **Lore** — the figure's name, origin, and primary legends |
| 2 | English | **Cultural context** — role in folklore tradition, symbolic meaning, related figures, cultural significance |
| 3 | Japanese | **Primary sources** — original texts, earliest records, foundational accounts |
| 4 | Japanese | **Variant tellings** — regional differences, lesser-known tales, local folk beliefs |
| 5 | English | **Ability mining** — supernatural powers, capabilities, weaknesses, vulnerabilities as described in folklore |
| 6 | Japanese | **Ability mining** — powers and capabilities described in Japanese folklore sources, folk beliefs about what they can do |

**Japanese-language agents** must write search queries in Japanese (e.g., `酒呑童子 能力 伝説` not `Shuten-dōji abilities legend`). Findings must be returned in English using ALA-LC romanization for Japanese terms. Never include kanji or kana in the output.

**Ability mining agents** focus exclusively on folklore source material — not games, anime, manga, or modern media adaptations. They should extract every distinct power, capability, weakness, and vulnerability attributed to the figure, with the specific tale or source noted for each.

Each subagent must:
- Use `WebSearch` and `WebFetch` to find and read sources
- Return structured findings with source URLs
- Cover as many of the research categories below as their angle permits

#### Research Categories

The combined output from all subagents must cover:

| Category | What to Look For |
|----------|-----------------|
| Origin stories | Where and when the figure first appears in the record |
| Powers/abilities | Supernatural or notable capabilities attributed to them |
| Personality/temperament | How sources characterize their disposition and behavior |
| Notable tales | Key stories, episodes, or legends associated with them |
| Cultural significance | What the figure represents, symbolizes, or teaches |
| Relationships | Connections to other figures, deities, or entities |
| Variant tellings | How the figure differs across regions, eras, or traditions |
| Lesser-known details | Obscure facts that distinguish deep research from surface-level |

#### Research File Setup

Before launching subagents, create the research file `stuff/research/{npc-name}.md` with section headers for each agent:

```markdown
# Research: [NPC Name]

## EN Lore

## EN Cultural Context

## JP Primary Sources

## JP Variant Tellings

## EN Abilities

## JP Abilities
```

#### Subagent Prompt Template

Include all of the following in each subagent's prompt:
- The figure's name (and any known alternate names; include kanji/kana in the prompt to Japanese-language agents so they can form accurate search queries)
- The specific query angle and language assigned to that agent
- For Japanese agents: explicit instruction to write all search queries in Japanese
- For ability mining agents: explicit instruction to focus on folklore sources only, extracting every distinct power/capability/weakness with its source noted
- Instruction to use `WebSearch` and `WebFetch`
- **Instruction to write all findings to the research file** (`stuff/research/{npc-name}.md`) **by replacing the agent's assigned section header with the header + all findings using the Edit tool**. The agent must use the exact section header line (e.g., `## EN Lore`) as the `old_string` and replace it with the header followed by the full research content as `new_string`. This ensures each agent's Edit targets a unique string and concurrent writes do not conflict. If the Edit fails, the agent must re-read the file to get the current content, locate its section header in the updated file, and retry the Edit. Retry up to 3 times before giving up. Include the full file path and the exact section header text in the prompt.
- Instruction to include source URLs for every finding and structure clearly with sub-headers
- Instruction to note any conflicting accounts found
- **Disambiguation warning**: If the figure shares a name or reading with another historical/legendary figure, explicitly warn the agent which figure to research and which to exclude. Include dates, titles, or parentage to distinguish them.
- **"Do not ask questions. Proceed autonomously."**

#### Synthesis

After all subagents return, synthesize their findings by:
- Cross-referencing overlapping information across agents
- Noting where sources agree and disagree
- Prioritizing details attested by multiple sources
- Flagging details found by only a single source
- **Verifying mechanically significant claims against actual sources**: For any factual claim that drives NPC field values or creative decisions, fetch and read the cited source page to confirm the claim actually appears there. Research agents can hallucinate — never trust a single agent's citation without checking.

**For Japanese figures**: Follow ALA-LC romanization standard (reference the `japanese-romanization` skill). Use romanized forms only — never include kanji or kana in the dossier or final NPC fields.

### Phase 1.5: Creative Questions

Between research completion and dossier presentation, use `AskUserQuestion` to resolve any creative decisions that emerged from the research. Examples:
- Ambiguities in the skeleton or planning notes that affect how lore fields should be written
- Whether to lean into a particular interpretation when sources conflict
- How to handle the NPC's relationship to other NPCs already in the file
- Empty fields on the skeleton (e.g., empty `type`) that affect characterization

Do NOT use free-text conversation for these questions — always use the `AskUserQuestion` tool so the user gets structured options.

**Verify skeleton fields against research.** Before asking creative questions, check every pre-filled skeleton field against the research findings. Skeletons are planning notes — they may contain assumptions that the research contradicts. Flag any discrepancies for the user before proceeding.

### Drafting Rules: Ask Before Inventing

Never invent concrete details that haven't been established — ask first via `AskUserQuestion`. This applies especially to:

- **Appearance specifics**: build, hair length/style, distinguishing features. Offer options; don't pick one.
- **Relationship dynamics**: how the NPC feels about other NPCs. If not already established, ask before writing it into any field.
- **Lore that references other NPCs**: curses, abilities, backstory involving characters whose details haven't been locked. Keep references vague or ask to establish them.

What you CAN draft without asking:
- Ability descriptions adapted from the NPC's type (verbatim from npc-types.json) or from research findings
- Fighting style that follows logically from approved abilities and personality
- hiddenInfo structure and beats that use only already-established facts

When in doubt: ask, don't invent.

**Ground every option in evidence.** When presenting options via `AskUserQuestion`, ground every option in research findings or existing NPC conventions. If no research exists for a detail, say so explicitly in the question — "No research basis exists; this is a creative decision" — so the user knows they are choosing without evidence. Do not fill option lists with plausible-sounding inventions.

**Verify before asserting.** Before using a specific factual claim — in a draft, a dossier, a creative question, or in conversation with the user — confirm it against the research corpus or against the cited source directly. This includes dates, timelines, and the sequence of events — if you are about to state when something happened, re-read the research to confirm before stating it. If the research doesn't cover it, look it up or ask — do not guess. This applies to every sentence in every field and every claim from research agents — not just facts that feel uncertain. The most dangerous inventions are the ones that sound plausible. Research agents are not immune to fabrication — if a claim drives a creative or mechanical decision, verify the cited source.

### Phase 2: Present Dossier + Draft

Present research findings organized clearly under the categories above. Then include a **draft of the four lore fields** showing how the figure would be adapted:

- Proposed `name` (with proper romanization if Japanese)
- Proposed `basicInfo` -- three-sentence structure per npcs skill format
- Proposed `personality` -- four traits per npcs skill format, each with a brief justification citing the research evidence or character logic that supports it
- Proposed `abilities` -- at least five abilities plus fighting style summary
- Proposed `hiddenInfo` -- full paragraph mixing narrative secrets and gameplay-useful information
- For each ability: a brief note on which folklore source or tale inspired it

Flag the following explicitly:
- Interesting contradictions between sources
- Areas where creative interpretation was needed to fill gaps
- Lesser-known details that made it into the adaptation

### Phase 3: Await Tweaks

**Before entering approval**: If resuming from a prior session with existing drafts, fact-check every sentence against the research corpus before presenting for approval. Do not assume prior drafts are accurate — verify claims, dates, titles, and relationships against the research files.

**Brief the user before asking decisions.** Before starting sentence-by-sentence approval for hiddenInfo, offer a concise summary of the NPC — who they are, their key relationships, dramatic tensions, and what the research found. The user may not remember the research from a prior session and cannot make informed choices without context. Ask if they want the briefing; don't force it.

**Record new conventions.** When a new hiddenInfo style rule is established during approval (naming conventions, title formatting, structural patterns), add it to the hiddenInfo Style Rules section in the project's NPC progress tracking file — not to the skill, memory, or CLAUDE.md.

Present all fields together, but **lock them one at a time in order**: basicInfo → personality → abilities → hiddenInfo. For hiddenInfo specifically, go **sentence by sentence** through `AskUserQuestion` for approval.

When presenting personality options via `AskUserQuestion`, **include the research evidence for each trait in the option description** — name the source, the specific anecdote, or the behavioral pattern that supports it. Do not present traits without justification.

**Personality AskUserQuestion format**: Present all four trait slots for one NPC in a single `AskUserQuestion` call (4 questions, one per slot: positive, neutral, negative, speaking style). Use the `question` field for the research-backed justification about the NPC's behavior patterns relevant to that trait slot. Each option's `label` contains the full "Trait: Description" text, and the `description` explains how that specific trait reflects the justification. Do not pre-decide traits and ask for lock/adjust — always present genuine competing options with justifications so the user can choose.

```json
{
  "questions": [
    {
      "question": "[Research justification about behavior patterns relevant to this trait slot]",
      "header": "[NPC] +",
      "options": [
        {
          "label": "[Trait]: [Under-10-word description]",
          "description": "[How this trait reflects the justification]"
        }
      ],
      "multiSelect": false
    }
  ]
}
```

Wait for user modifications. These can include any of the following:

- **Narrative reframing**: Changed backstory, personality shifts, gender, recontextualized legend
- **Complete reimaginings**: Wholesale departures from the source material
- **Additions**: Extra abilities, connections to other NPCs or factions, hidden lore
- **Removals**: Dropping abilities, simplifying personality, cutting backstory elements

Incorporate ALL user tweaks into the final version. Do not push back on creative choices -- the user's vision takes priority over folklore accuracy.

### Phase 4: Write

After user approval, write the four lore fields directly onto the existing NPC skeleton in `tabs/npcs.json` using the `Edit` tool. The target NPC entry must already exist. **Always show the complete text to the user and receive explicit approval before writing to the file** — never write a field based on an assumed approval from an earlier draft.

Fields must conform to the `npcs` skill format:
- `basicInfo`: three-sentence structure
- `personality`: four traits (positive, neutral, negative, speaking style)
- `abilities`: at least five abilities plus `\nfighting style:` summary
- `hiddenInfo`: full paragraph with narrative depth and gameplay-useful information

Do not modify any other fields on the NPC entry.

## Field Format Rules

### basicInfo
- **3 sentences**: role, appearance, dress. No lore, no family connections, no training lineage, no age.
- **Read before drafting**: Before writing any basicInfo draft, read at least 10 existing basicInfo entries from npcs.json to internalize the exact sentence structure, vocabulary, and formatting. Do not draft from memory.
- **Role must be current**: The first sentence describes the NPC's role at the world's date — not titles, positions, or accomplishments from later in their life.
- **Role must use in-world terminology**: Use the NPC's actual title or position in the setting's language, not English translations.
- **Appearance must be research-backed**: Do not invent facial features, body language, or physical details not attested in sources. If no physical description survives, use only build, hair, and eyes — do not fabricate distinguishing features.
- **Dress must name specific garments**: Use the actual garment name from the setting, not generic terms like "robes" or "armor." Check existing NPCs of the same type for vocabulary conventions.
- **No personality in basicInfo**: Sentence 2 is physical appearance only. Sentence 3 is clothing/equipment only. Do not editorialize — no character traits disguised as physical description.
- **No secrets in basicInfo**: Hidden relationships, true identities, and connections that are meant to be revealed belong in hiddenInfo. basicInfo describes only what is publicly observable.

### personality
- **4 traits in strict order**: positive, neutral, negative, speaking style
- Format: "Label: Explanation in under 10 words"
- **Descriptions characterize behavior, not biography.** The explanation describes how the NPC acts, not what they did. "Refuses to yield regardless of the odds" not "Challenged an empire outnumbered."
- **Pre-flight check before presenting**: Verify each trait against its slot. The positive trait must be genuinely admirable. The neutral trait must be ambiguous — not clearly good or bad. The negative trait must be a real flaw. The speaking style must describe how they communicate, not what they believe. No two traits may express the same quality in different words — check that each trait covers distinct behavioral territory.

### abilities
- Ability descriptions say what it does, not where it came from — save origin stories for hiddenInfo
- Keep ability names simple and lore-grounded — don't invent compound Japanese names without basis
- **Write general capabilities, not exhaustive lists**: Describe what the ability does broadly. Do not enumerate every specific application — let the AI narrator infer uses from the general description. One clear statement of the power is better than four examples of it.
- Fighting style must logically follow from approved abilities and personality — must name ALL abilities including unique and capstone, but show them in action and synergy rather than listing each one with a separate explanation. The fighting style must reflect the NPC's personality traits, not just their mechanical kit.
- Match the declarative, punchy voice of existing unique abilities and capstones — read at least three before drafting. State what the power does. Do not editorialize, explain the meta-framework, or comment on the power's implications.

### hiddenInfo
- **Read before writing**: Before drafting or approving hiddenInfo, read the hiddenInfo of NPCs who share the same group, faction, batch, or role. Match their length, structure, and voice. Check what terminology existing entries use and do not use. Flag any word choice that would be a first occurrence across the established entries.
- **Read accumulated style rules**: Before drafting, read the hiddenInfo Style Rules section in the project's NPC progress tracking file. These rules accumulate across sessions and contain conventions that override defaults.
- **In-world perspective**: hiddenInfo is what the AI narrator knows as truth in this world. Write as established fact, not as a survey of competing folklore traditions. Research conflicts must be resolved before drafting — use `AskUserQuestion` to pick one version as canon and commit to it. Never use phrases like "some accounts say," "origins are disputed," or "attributed to." No passive hedging — if something happened, state that it happened. If the NPC caused something, say they caused it. Academic distance has no place in narrator truth. No editorial commentary — do not write sentences that analyze, predict, or editorialize. Avoid constructions like "which means," "this suggests," "no one will," or "the implication is." State what is true in the world, not what it signifies.
- **Chronological clarity**: Each sentence should occupy one temporal context. Do not mix the NPC's current state with events from their past in the same sentence. Establish time, then describe what happened in that time.
- **Naming other characters**: Characters referenced in hiddenInfo follow a tiered naming convention. Check the project's NPC progress tracking file for the current rules — these evolve across sessions.
- **Title and name ordering**: Follow the setting's native ordering for titles and names. Check existing entries for the established convention.
- **First mention**: Use the NPC's full name (with clan/family name) on first mention within a hiddenInfo paragraph. Subsequent mentions may use the short form.
- **Numerals for ages only**: "18" not "eighteen" for ages. For other numbers use words: "two brothers," "three poems." For past events use unspecific but accurate relative time: "several years ago," "over two decades ago," "just a year prior," "a century ago."
- For human characters, age is a must-have
- **Reference world elements using the terminology from world-background.json** — not generic terms. If the world background names a specific institution, group, epidemic, war, or crisis, use that name.
- **For batched NPCs, each hiddenInfo must reference the other NPCs in the batch** where relationships exist. Do not write an NPC's hiddenInfo in isolation from its batch-mates. When two batch-mates cover the same beat (e.g., their relationship, a shared activity), write each version from that NPC's personality — do not structurally clone one NPC's sentence and swap the nouns.
- **Perspective anchoring**: When an NPC's story overlaps with another NPC who already has hiddenInfo, anchor overlapping content in the current NPC's experience — do not restate the other NPC's perspective. If NPC A is affected by NPC B's actions, describe what A perceives or experiences, not what B is doing.
- End with the NPC's relationship to the current crisis
- Go sentence by sentence through `AskUserQuestion` for approval — **present exactly one sentence per question, not multiple**. Never batch sentences even when confident they will be approved. When presenting sentence options, put the full sentence text in the option `label` or `description` so it is immediately visible — do not rely on `preview` fields that require interaction to reveal.
- **Draft each sentence yourself** by inferring the natural order from existing NPCs of the same type — do not ask the user what beat to cover next. Present each drafted sentence via `AskUserQuestion` with Approve/Revise options. The user steers by revising, not by choosing topics.

### voiceTags
- Required field — don't assign without user input

### Portrait Workflow
After lore fields are locked, follow the image-gen skill's Character Portrait Workflow. Key points:
1. Curate basicInfo to visual-only description per the image-gen skill's keep/drop rules
2. Present ALL personality trait keywords to the user via `AskUserQuestion` — do not pick for them
3. Assemble the full prompt and show it to the user before generating
4. Run image generation directly via Bash — never delegate to agents
5. Show image and wait for user approval; use `-i` for touch-ups
6. Once approved: upload via upload-image.mjs, write `portraitUrl`, clean up unpicked variants via cleanup-variants.mjs

## Ability Adaptation Rules

Folklore powers are **creative seeds**, not literal translations. Follow these principles:

| Principle | Description |
|-----------|-------------|
| Mechanical variety | Design abilities with varied usage -- offensive, defensive, utility |
| Inspired, not copied | Each ability should feel rooted in the source while being fun in gameplay |
| Avoid redundancy | Do not create five variations of the same power; diversify |
| Gameplay-first | If a folklore power would be boring mechanically, reimagine it |
| Preserve essence | The overall ability set should evoke the figure's identity even if individual powers diverge from the source |

## Ability Building Process

Build ability sets one NPC at a time, in order, with user approval at each stage:

0. **Feat inventory**: Before proposing any abilities, compile every power, capability, trait, and weakness attested in the research into a numbered list, organized by source. Present this as a table or list in free text — not inside AskUserQuestion. This is analysis, not a decision point.
1. **Feat-to-ability mapping**: Map each feat to a candidate ability (base, cross-discipline, or unique) in a table showing feat → ability → justification. Present uncovered feats explicitly. Use AskUserQuestion only after the full mapping is visible.
2. **Base abilities**: List the NPC type's signature arts verbatim from npc-types.json. Confirm with the user which apply — not all base abilities suit every NPC of that type. Before presenting, read existing NPCs of the same type to check for customization conventions (e.g., type-specific flavor in the last sentence of a shared ability description).
3. **Cross-discipline picks**: Draw from `tabs/skills.json`. Only pick skills that are attested in the NPC's folklore. Present the folklore evidence for each proposed pick. Do not pick Innate-type skills associated with other yōkai species — these are species-locked.
4. **Unique abilities**: Propose abilities that capture what is genuinely unique to this NPC and not already covered by base or cross-discipline picks. Each unique must be folklore-attested — name the source. Do not duplicate what a base ability already does.
5. **Fighting style**: Draft only after all abilities are locked. Name every ability and show them working together. The fighting style must reflect the NPC's personality traits — not just mechanical synergy but *how this specific character* would use these abilities, given their temperament.

At each stage, present the options with folklore justification and wait for approval before proceeding to the next.

## Research Quality Rules

| Rule | Standard |
|------|----------|
| Minimum sources | Sources from both English and Japanese agents cross-referenced |
| Conflicting accounts | Note them explicitly rather than silently picking one |
| Depth markers | Include lesser-known details that demonstrate thorough research |
| Source distinction | Distinguish between widely-attested folklore and speculative/modern interpretations |
| Attribution | When a detail comes from a single source, say so |
| Bilingual cross-check | Details found in both English and Japanese sources are strongest; flag language-exclusive findings |

## Romanization Rules

For Japanese figures:

- Follow ALA-LC standard with proper macrons (reference `japanese-romanization` skill)
- **Never include kanji or kana** in the dossier, draft, or final NPC fields — romanized forms only
- NPC `name` field uses the romanized form
- Honorifics and titles follow ALA-LC hyphenation rules
- Kanji/kana are used only internally in search queries to Japanese-language subagents
