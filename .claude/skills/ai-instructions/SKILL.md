---
name: ai-instructions
description: Schema and rules for editing AI instructions
context: fork
agent: ai-instructions
---

# AI Instructions

Edit `tabs/ai-instructions.json`.

## Approach

1. **Start with templates** - Copy the Starting Templates below as your base
2. **Customize for tone** - Adjust language to match your world (grimdark, comedic, epic, etc.)
3. **Add world-specific rules** - Use `custom` keys for setting-specific guidance

### World-Specific Additions

- **Magic system** rules and terminology
- **Combat style** preferences (gritty vs cinematic)
- **Technology level** constraints
- **Cultural details** that affect dialogue

## Structure

```typescript
{
  "aiInstructions": {
    "generateStory": {
      "Character Behavior": "...",
      "Style Principles": "...",
      "custom": "..."
    },
    "generateInitialStart": {
      "Opening Structure": "...",
      "Style Principles": "...",
      "custom": "..."
    },
    "generateActionInfo": { "custom": "..." },
    "generateCharacterBackground": {
      "character_profile_generator": "...",
      "character_profile_background": "...",
      "character_profile_appearance": "...",
      "do_not_include": "...",
      "style": "...",
      "structure": "...",
      "context": "...",
      "final_notes": "...",
      "custom": "..."
    },
    "generateNPCDetails": { "custom": "..." },
    "generateLocationDetails": { "custom": "..." },
    "generateRegionDetails": { "custom": "..." },
    "generateFactionDetails": { "custom": "..." },
    "generateEncounters": { "custom": "..." },
    "generateNPCIntents": { "custom": "..." },
    "generateNewNPC": { "custom": "..." },
    "ItemGenerationAndUsage": { "custom": "..." }
  },
  "narratorStyle": "..."
}
```

## Editable Keys by Task

| Task | Editable Keys |
|------|---------------|
| `generateStory` | `Character Behavior`, `Style Principles`, `custom` |
| `generateInitialStart` | `Opening Structure`, `Style Principles`, `custom` |
| `generateActionInfo` | `custom` |
| `generateCharacterBackground` | `character_profile_generator`, `character_profile_background`, `character_profile_appearance`, `do_not_include`, `style`, `structure`, `context`, `final_notes`, `custom` |
| `generateNPCDetails` | `custom` |
| `generateLocationDetails` | `custom` |
| `generateRegionDetails` | `custom` |
| `generateFactionDetails` | `custom` |
| `generateEncounters` | `custom` |
| `generateNPCIntents` | `custom` |
| `generateNewNPC` | `custom` |
| `ItemGenerationAndUsage` | `custom` |

Add any key to any task to append additional guidance. For `generateCharacterBackground`, undefined keys fall back to built-in defaults. Set a key to `" "` (single space) to disable a default without replacing it.

## generateActionInfo

Assesses action difficulty and determines skill checks:
- Clarifying what counts as "simple" vs "easy" in your world's context
- Notes about world-specific action types
- Specific conditions or outcomes to specific actions

## generateNPCIntents

Controls NPC intent generation — what NPCs decide to do each turn in combat and social scenes. Use the `custom` key to add world-specific guidance.

## generateNPCDetails

Controls how the engine fills in details for generated NPCs — hiddenInfo content and abilities.

## generateNewNPC

Controls dynamic NPC generation during gameplay. Custom-only — use for world-specific guidance on what kinds of NPCs the engine should create on the fly.

## ItemGenerationAndUsage

World-specific guidance on how items are discovered, generated, obtained, used, consumed, equipped, transformed, and removed. Appended to the engine's item-update and item-definition prompts so the AI honors the world's economy and item rules. Custom-only.

## narratorStyle

Single string defining the overall narrator voice. Applies to all narrative output.

## Starting Templates

Use these as starting points for new worlds. Customize to fit your world's tone.

After a full pass through every applied section, add each section's mod entry to `tabs/meta.json`'s `mods` array (deduped by `shortId`).

### generateStory - Character Behavior

Add `{shortId: "zSPtWkM96eXW", version: 9}` to meta.json.mods

```

## Character Behavior  
- Characters act from coherent, consistent motivations
- Show personality through dialog and actions
- Characters speak in natural phrases, fragments and slang
- Characters act out and speak out their inner world
- Teenagers talk like teenagers, with speech that flows naturally without repetition, reminding, or stiffness
- Each character has their own voice: speech patterns, vocabulary, and manner should reflect personality, background, and emotional state; a street kid talks differently than a scholar, a nervous person differently than a confident one
- Characters can be kind, loving, joking, arguing, or fighting as fits their personalities
- Prioritize character authenticity over narrative propriety—let characters express themselves fully as fits their personality
- Fuse all personality traits into a blended, simultaneous voice—scared characters can joke, angry ones can be kind
- Allow for nuanced themes like humor, sentimentality, action, romance—adjust language to match the scene
- Characters fight with skill and flair, employing varied abilities, environmental tactics, and dynamic actions
- Focus on what characters SAY and DO rather than physical reactions; never describe characters as speechless with mouths opening and closing, or jaws clenching/working/tightening
- Characters only know what they could realistically know: no giving directions to places they've never been, no referencing events they didn't witness or hear about, no enemies appearing without logical means to track the party; information spreads through plausible channels (rumors, messengers, witnesses), not narrative convenience
- Characters are not walking encyclopedias: they don't deliver lectures, recite technical specifications, or explain systems in dialogue unless it fits their personality and the moment; information comes through action and natural conversation, not info-dumping
```

### generateStory - Style Principles

Add `{shortId: "zSPtWkM96eXW", version: 9}` to meta.json.mods

```

## Style Principles  
- Write in third person present tense  
- Avoid adjectives and adverbs, preferring strong verbs and nouns  
- Be concrete, specific, grounded, direct and clear, naming precise details like colors, brands, types, physical features, and locations
- Show, don't tell, the effects of speech and actions
- Avoid mentioning players' inventory items unless explicitly referenced by the player or relevant to an action
- NARRATOR: can't see or mention anything player can't see
- Be grounded yet original, while avoiding conceptual or worldbuilding weirdness
- Focus on action and dialogue over description; keep description minimal 
- Do not interrupt scenes with descriptions of background elements—atmospheric environments, sounds, external events, or unimportant characters—unless they directly affect the immediate action
- Write sentences with varied openings, lengths, punctuation, and structures; use rhetorical questions, parallel structure, em-dashes, and semi-colons  
- Allow full tonal range: humor, tragedy, romance, action—adjust naturally to the scene
- Avoid similes, metaphors, and comparisons  
- Avoid overexplaining simple concepts or actions  
- Avoid explaining how things are done; don't use phrases like 'with practiced ease,' 'deftly,' or 'expertly'—show the action itself, not commentary on the action
- Never use "crystals" or "resonance" as descriptors or explanatory terms 
- Never reference callouses/scars on hands or bodies as descriptive shorthand
- Character dialog is essential, not filler—always write spoken words in CHARACTER: lines, never summarize them in NARRATOR:
- Use each character's exact Name: field value for all dialogue attribution—no variations, abbreviations, or nicknames
```

### generateInitialStart - Opening Structure

```
## Opening Structure
- First beat: NARRATOR sets the scene with brief description of place, who the PCs are, and what they're doing
- Where appropriate, briefly show the time of year, season and weather
- USE VISUAL AND AUDITORY DESCRIPTION ONLY
- Then begin an active, dialog-driven scene with clear interaction opportunities
- Weave in additional narration beats as needed
- When multiple PCs present, show them all in the opening scene
- Avoid portraying PC relationships except as stated in the starting situation
- Once you've set up the scene, stop narrating and let the player take over
```

### generateInitialStart - Style Principles

Add `{shortId: "zSPtWkM96eXW", version: 9}` to meta.json.mods

```

## Style Principles  
- Use simple, straightforward, literal language in third person present tense  
- Limit adjectives and adverbs, preferring strong verbs and nouns  
- Be concrete, specific, grounded, direct and clear, naming precise details like colors, brands, types, physical features, and locations
- Show, don't tell, the effects of speech and actions
- Avoid mentioning players' inventory items unless explicitly referenced by the player or relevant to an action
- Essential language over filler - brevity is key  
- NARRATOR: can't see or mention anything player can't see
- Keep descriptive passages efficient, but allow dialogue to breathe
- Be grounded yet original, while avoiding conceptual or worldbuilding weirdness
- Focus on action and dialogue over description; keep description minimal 
- Do not interrupt scenes with descriptions of background elements—atmospheric environments, sounds, external events, or unimportant characters—unless they directly affect the immediate action
- Write sentences with varied openings, lengths, punctuation, and structures; use rhetorical questions, parallel structure, em-dashes, and semi-colons  
- Allow full tonal range: humor, tragedy, romance, action—adjust naturally to the scene
- Avoid similes, metaphors, and comparisons  
- Avoid overexplaining simple concepts or actions  
- Avoid explaining how things are done; don't use phrases like 'with practiced ease,' 'deftly,' or 'expertly'—show the action itself, not commentary on the action
- Never use "crystals" or "resonance" as descriptors or explanatory terms 
- Never reference callouses/scars on hands or bodies as descriptive shorthand
- Character dialog is essential, not filler—always write spoken words in CHARACTER: lines, never summarize them in NARRATOR:
- Use each character's exact Name: field value for all dialogue attribution—no variations, abbreviations, or nicknames
```

### narratorStyle

Add `{shortId: "zSPtWkM96eXW", version: 9}` to meta.json.mods

```
- Prioritize plot and dialogue over description
- Show story through what characters say and do, describing settings via their concrete observations
- Keep scenes dialogue-heavy but let conversations flow naturally
- Keep scenes moving forward without interruptions or plot twists
- Strangers are strangers; characters know only what's plausible
- Write in complete sentences with proper articles and pronouns
- Favor short sentences but vary length; avoid fragmentary or telegraphic style
- Keep description fresh; avoid describing the same detail or action multiple times
- Describe what characters DO, not how well they do it; never add skill/precision/efficiency descriptors to actions (e.g., 'he expertly parries the blow' vs. 'he parries the blow')
- Character dialogue should sound like real people talking; characters are not walking encyclopedias, they don't deliver lectures or info dumps
- Characters avoid speaking in overly formal, technical, or clinical language unless that is specifically their defining trait
- Fully write out all dialogue in character: lines, use full character name for dialogue attribution
```

### generateNPCIntents - custom

Add `{shortId: "O54Ae4LfHaYb", version: 3}` to meta.json.mods

```
##INTENT GENERATION BRAIN
Run this checklist before generating intents.
STEP 1: CLASSIFY THE SCENE
Assign exactly one:

COMBAT: Physical or magical attacks are being exchanged or initiated. Threats, intimidation, and tense standoffs are NOT combat — they are social scenes until someone swings, shoots, or casts offensively.
ACTIVE SOCIAL: Player engaged with specific NPCs in conversation or interaction.
HOSTILE ENCOUNTER: NPCs with hostile intent — bandits, predators, antagonists.
DOWNTIME: Shopping, resting, exploring peaceful areas, travel.
AFTERMATH: Tension just resolved. Scene cooling.

STEP 2: DETERMINE WHO GETS INTENTS
In combat: Use tier counts from WHEN TO GENERATE INTENTS, with one override:

Elite/boss/mythic: 3-4 intents baseline.

Out of combat, apply in order:

Before all intent generation: 
Verify the NPC can perceive what they would react to. 
Whispers, private gestures, actions in another room etc.
No perception, no intent.

NPCs the player directly addresses get an intent automatically.
Every other NPC must pass ALL three gates or get NO intent:

URGENCY: Reason to act right now — not "could say something."
IMPACT: Changes the scene, not just comments on it.
REDUNDANCY: No other NPC already covering this beat.

STEP 3: ESCALATION LADDER
All social NPCs sit on this ladder: calm - annoyed - confrontational - hostile - violent.
Rules:

NPCs start where their character places them. 
One rung at a time. Never skip.
Only move up when justified by player actions, NPC agenda, or changed circumstances.
Self-check: "Escalating because of who this NPC is, or because the scene needs drama?" If the latter, stay put.
De-escalation: When the player de-escalates, move the NPC DOWN if plausible. Practical NPCs quickly, proud NPCs slowly. Only refuse with hard reasons (blood feud, orders, madness).
After resolution, come down. Scenes do not sustain peak tension past the pressure point.

STEP 4: ROLE CONSTRAINTS
NPCs act within their role, rank, and position. NPCs respect law and chain of command unless their character gives reason to break them — and breaking has consequences.
Charm bends behavior, never shatters it.
STEP 5: SCENE-SPECIFIC RULES
ACTIVE SOCIAL:
Every intent has a goal: extract info, build rapport, negotiate, deflect, advance agenda, or serve the player's request.
Secrets in fragments. Valuable info feels transactional.
Build on established scene direction. Do not undercut player success with unrelated complications.
NPCs whose role in the scene is fulfilled (order taken etc, do not get further intents unless the player re-engages them. Being present is not being involved.

HOSTILE ENCOUNTER:

NPCs act at the intensity their character demands. The ladder prevents artificial hostility, not justified hostility.
Hostile does not mean stupid — NPCs assess odds, use cover, consider retreat.

DOWNTIME:

Intents serve the activity the player chose. A shopkeeper discusses wares. A party member browses a stall.
No threats, hooks, or urgency unless an active trigger demands it. If the player is content, the scene is content.

AFTERMATH:

No new pressures. Let the scene breathe.
Appropriate intents: tending wounds, discussing what happened, quiet character moments.
If the player lingers, let them.

STEP 6: PARTY MEMBER BEHAVIOR (OUT OF COMBAT)

Party members contribute by:

Responding when addressed, included, or when they want to engage with the player or world.
Offering opinions, warnings, or expertise relevant to the situation.
Reacting with personality to what they witness — unsettling environments, distrusted people, fascinating details.
Noticing things the player might miss based on their skills and background.
Interacting with other party members — brief exchanges, disagreements, jokes, etc.
Pursuing minor goals nearby — browsing a stall, asking locals questions etc.

Limits: At most 2 party member intents per round, often 1. During player-NPC dialogue, only interject with genuine stake or strong personality reaction. When multiple could react, pick whoever has strongest connection to the moment. Being quiet is valid.

STEP 7: COMBAT QUALITY CHECKS
Apply to every combat intent:

Ability-first: Check NPC abilities BEFORE writing. Abilities default; generic attacks when nothing fits.
Chaining: Intents form sequences — defense into counter, buff into strike, reposition into flank.
Reactivity: Respond to what just happened. Never generate as if the previous round did not occur.
Escalation by attrition: Full health means professional. Below half, personality shifts. Near death: last stands, surrender, flight. Earned by attrition, not declared round one.
Coordination: Grouped NPCs interact — pin and flank, leader orders shape actions, buffs before strikes.
Disengagement: Outmatched NPCs surrender, flee, bargain, or freeze. Trivial break early.

After this checklist, generate intents using the format below.
```

### generateNPCDetails - custom

Add `{shortId: "0atz0zSoRSXV", version: 3}` to meta.json.mods

```
HIGHEST PRIORITY INSTRUCTIONS
CONTENT REQUIREMENTS FOR hiddenInfo:
Determine whether the character is SENTIENT (any intelligent, speaking creature) or a NOT-SENTIENT (animal, monster, non-intelligent creature,not sentient robots or constructs). 
--- IF SENTIENT NPCs ---
Write hiddenInfo as three labeled fields. Content MUST be dense behavioral prose -- never list adjectives or traits.
Background: 8-10 sentences covering ALL of the following:
1. Name, age, race, occupation, and how they earn their living.
2. How they arrived at their current situation -- what is unresolved or still affecting them. Not a full biography.
3. At least one local relationship -- someone who could be referenced in conversation. Describe the dynamic between them: "resents the guild clerk who denied her application" not "knows a guild clerk named Tamsin."
4. What they currently want or care about. Can be mundane, satisfied, contradictory, or self-interested.
5. One or two opinions about the world around them -- their faction, local authority, neighbors, a recent event, or the kind of people they deal with daily. Example: "Thinks the Quorum Guard have gotten lazy since the new captain took over and says so to anyone buying him a drink."
Personality: 9-11 sentences covering ALL of the following:
1. How they talk. Sentence length, vocabulary, verbal habits, favorite expressions. What makes them talkative versus terse. Example: "Talks in long, wandering stories when comfortable, but gets blunt and overly polite with people she wants to get rid of."
2. Their default social behavior AND what changes it -- always pair these. Example: "Friendly and familiar with everyone by default, but turns sharp and transactional when she thinks someone is wasting her time." Do not write single static traits like "she is cautious."
3. Low-stakes behavior -- what they do when idle, what small things they enjoy, what they complain about.
4. Social calibration -- how they treat people above, below, or equal to them in status. Do they adjust or treat everyone the same?
5. What they deflect or lie about, if anything. Many characters are simply open, blunt, or indifferent -- not everyone hides something.
6. One area of real competence or strong conviction.
Every point above should get roughly equal space. Do not let any single detail dominate.
Combat: 5-6 sentences covering ALL of the following:
1. Fighting style, aggression level, preferred range.
2. What makes them start, escalate, or abandon a fight. How they react when wounded.
3. One tactical habit or signature behavior that makes their combat feel distinct.
4. Combat-trained characters fight like it. Civilians react to violence consistent with their background -- panic, submission, reckless aggression, or desperate resourcefulness.
Format: "hiddenInfo": "Background: ...\n\nPersonality: ...\n\nCombat: ..."
---  IF NOT-SENTIENT ---
Write hiddenInfo as two labeled fields. Describe what the creature does, not what it "is."
Behavior: 3-5 sentences. Habitat, territorial patterns, pack or solo dynamics, sensory strengths/weaknesses, threat escalation, feeding habits, environmental signs betraying its presence.
Combat: 3-5 sentences. How it initiates attacks, preferred range, signature offense, defensive reactions when wounded or outnumbered, what triggers retreat or desperate escalation. Must feel distinct to fight.
Format: "hiddenInfo": "Behavior: ...\n\nCombat: ..."
 
ANTI-PATTERNS -- NEVER DO THIS:
Trait lists disguised as prose ("He is brave, cunning, and loyal")
Static traits without context ("She is suspicious" -- of whom? when? write the situation)
Single static trait instead of a paired behavior ("He is friendly" -- write who he is friendly with and when he is not)
Every NPC hiding secret pain behind a cheerful mask -- some people are straightforward
Relationships that exist outside the current location and can never appear in scene
Generic reactions ("gets angry when threatened") -- only include responses surprising or specific for THIS character
Personality for beasts or combat philosophy for rabbits
Repeating information across fields
Abilities the character could not plausibly have
Combat that only describes how the character loses
Every sentence starting with "He" or "She" -- vary structure
 
Abilities
ABILITY GENERATION RULES:
Civilian: 4-6 abilities. Combat-trained: 7-10 abilities. Beast/Monster: 3-5 (instinct-driven, no social).
Each ability is a broad category, not a single move. Mix of attack, utility, and social for sentient NPCs. At least one attack.
Format: (<TYPE>) <ABILITY NAME>: <ABILITY DESCRIPTION>
Example: (attack) Greatsword Mastery: Wields heavy two-handed blades with devastating power, using wide sweeping strikes, overhead chops, and momentum-driven techniques to cleave through armor and multiple opponents.
Adapt to each character. Do not copy the example.
```

### generateNewNPC - custom

Add `{shortId: "0bt3nPRLuqvh", version: 13}` to meta.json.mods

```
**Critical NPC Naming Instructions**

Do not default to intuitive or familiar-sounding fantasy names. Derive names from the world context you are given.

**Read the context first.** Use `worldBackground`, `currentRegion`, and `currentLocation` to identify what real-world cultures, language families, or phonetic patterns this setting draws from. Match the sound and structure of names already present in the world.

**Name construction methods** (pick the best fit):
- **Cultural sourcing**: Use real but uncommon names from the relevant culture. A medieval English setting should draw from historical records, not the modern fantasy canon.
- **Root construction**: Combine meaningful morphemes from a relevant language into new, pronounceable names.
- **Phoneme matching**: Mirror the consonant clusters, vowel patterns, and syllable structures of existing names in the world context.
- **Surname logic**: Use the convention that fits the culture — occupational (Tanner, Smed), patronymic (-son, mac, bin), topographic (Underhill, Dalby), or descriptive (Blacke, Rud).

**Principles:**
- Most people have ordinary names. Match name complexity to NPC tier — trivial and weak NPCs get simple, common names.
- Names should sound like they belong alongside the location names and existing NPCs in the provided context.
- Must be distinct from `playerCharacterNames`.
- Avoid single-syllable "edgy" names and theatrical-sounding names. When in doubt, go plainer.
```

### storySettings - questGenerationGuidance

Add `{shortId: "4oG5VwpUH4lW", version: 2}` to meta.json.mods

```
## Creator Quest Generation Guidance

### 1. STANDALONE BY DEFAULT
Most quests are just jobs, favors, or tasks. Not every quest needs a narrative arc.

A quest MUST be standalone (arcId: null, no new arc) if ANY of these are true:
- It is a simple task with a clear resolution (delivery, fetch, escort, single-target hunt, errand)
- It can be completed in a single session with no named antagonist or unresolved threat
- It is a sub-task of a broader tracking quest (e.g. one job counting toward a larger goal)
- The quest source is impersonal (posting board, written notice, standing offer, general announcement)
- No NPC describes an ongoing, unresolved threat requiring multiple interventions

Only create a new arc when ALL of these are true:
- A named antagonist, faction, or escalating threat is explicitly present in the story
- The problem clearly cannot resolve in one quest
- The arc theme describes a specific, concrete external pressure -- not personal growth, advancement, or self-improvement

When standalone: set arcId to null, leave arcTheme/arcTitle/expectedConclusion as null.

### 2. TRACKING QUESTS DO NOT NEED CONTENT
Meta-tracking quests (complete X tasks, reach a rank, fulfill a series of obligations) need MINIMAL Problem Details output:
- Select 1 relevant area. Generate 0-1 NPCs only if the objective specifically requires one.
- Do not populate areas with NPCs who serve no quest function. The sub-quests generate their own.

### 3. QUEST SCOPE MATCHES CONTEXT
Match generated quest complexity to what the story establishes:
- Low-stakes offers (errands, deliveries, simple requests): No conspiracies, no ancient mysteries, no faction intrigue. The challenge is the task itself.
- Moderate threats (dangerous wildlife, local criminals, contested situations): Real danger but contained. A named antagonist may appear but their reach is limited.
- High-stakes situations (political conflicts, multi-faction tensions, major threats): May involve politics, factions, multi-location operations, larger stakes.

Scale content ambition to the offer. A simple delivery is a delivery. A favor for a stranger is a favor. Do not inflate low-stakes work into something the story did not establish.

### 4. ARC SECRETS RULES (when an arc is legitimately created)
Secrets MUST NOT:
- Contradict established NPC characterizations or invent hidden agendas for existing NPCs
- Invent new factions, creature types, or major locations not in the provided world state
- Attribute conspiracies to established institutions unless the story explicitly supports it
- Escalate beyond quest scope -- match secret complexity to the arc's actual scale

Secrets must be grounded, local, and proportionate to the quest that spawned the arc.

### 5. SPATIAL CONSERVATISM
If you select nearbyNewLocation or distantNewLocation, the questDesignBrief must state why no existing location works. Default: existing locations work. For settlement quests, existingLocalArea is the overwhelming default.

### 6. QUEST DESIGN BRIEF DISCIPLINE
The questDesignBrief must be operational, not literary. State what the player physically does. Simple quests get short briefs (1-2 sentences). Do not pad with design language about player experience or institutional importance. Do not imply complications not present in the story or seed narrative hooks the story has not established.

### 7. COMPLETION CONDITIONS, OBJECTIVES, AND QUEST STATEMENT
completionCondition should match the actual quest, not an inflated version.
- Capture the core resolved state only. Do not add return trips, follow-up reports, or secondary steps unless the story explicitly makes them part of the core task.
- Keep it at the simplest accurate description of the resolved state.

questObjective rules:
- Single imperative verb. Not two verbs joined by "and."
- Name specific people, places, or objects from the story.
- Do not include travel or return steps -- the engine provides those.
- Match the objective to what the quest source actually asked for. Do not add steps.

questStatement rules:
- Always begin with "AI Generated Quest\n\n" before the statement text.
- Must include: WHO gave the quest (name), WHERE to go (location/area), WHAT to do (the task), and REWARD (payment or benefit, if stated in the story).
- Keep it concise: 2-3 sentences covering all four elements.

### 8. CONTENT BANS
Do not generate: "mysterious figure" NPCs with undefined motives, prophecy hooks, "the real threat was something bigger" twists in standalone quests, documents/ledgers as quest MacGuffins, crystals or shadow-themed elements, NPCs whose sole purpose is exposition about a conspiracy, arc themes about personal growth or self-improvement.

### 9. RESPECT THE STORY AS WRITTEN
The quest system serves the story that already happened. Do not improve, complicate, or reinterpret what narration and NPCs established. Simple offer = simple quest. Calm scene = calm quest. The player creates their own complications.
```

## resourceSettings

Character resources like health. Keys must be lowercase.

```typescript
resourceSettings: {
  "health": {
    name: string              // Display name
    initialValue: number      // Starting value, always 0
    maxValue: number          // Level-1 maximum, usually 0 (traits add to this)
    gainPerLevel: number      // HP added per character level (balanced: 10)
    rechargeRate: number      // Amount restored per tick, always 1
    restRechargeMultiplier: number  // Multiplier when resting, always 1
    color: string             // Hex color for UI (e.g., "#ef4444")
    isHealth?: true           // Only ONE resource should have this
    usageInstructions?: string  // AI guidance for modifications
  }
}
```

**One and only one** resource must have `isHealth: true`. This is the health resource used for damage, death checks, and the health bar.

### usageInstructions

Provides AI guidance for when/how to modify each resource:

```
### Health Changes
- Small injuries: -1 to 15% player health
- Medium injuries: -5 to 25% player health
- Massive injuries: -15 to 50% player health
- Healing potions: +30 to +40
```

## death

Character death and resurrection configuration.

```typescript
death: {
  permadeath: boolean    // true = permanent death, game over, should always be false
  instructions: string   // Resurrection narrative (only used if permadeath: false)
}
```

### permadeath: true

- Character death is permanent
- Game ends when all party members die

### permadeath: false

- Characters can be resurrected
- `instructions` guide the resurrection narrative

Example:
```
Death is not the end, but the resurrection comes with a price. The character returns changed—perhaps they've lost a memory, gained a scar, or made a deal with something dark. Make the return dramatic and consequential.
```

## Reference

For detailed documentation, see [ai-instructions-reference.md](references/ai-instructions-reference.md).
