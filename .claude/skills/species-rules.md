# Species Consistency Rules

When creating a **species** (playable race, creature type, or sentient kind), it must be defined across THREE interconnected systems to ensure world consistency.

## The Species Trinity

Every species requires:

| Component | File | Key Fields |
|-----------|------|------------|
| **NPC Type** | `tabs/npc-types.json` | `description` |
| **Trait** | `tabs/traits.json` | `description`, `quirk` |
| **World Lore** | `tabs/world-lore.json` | `text` |

## Description Alignment

Each field serves a different purpose and has a **different format**, but all share the same **lore paragraphs** as their base.

### Lore Paragraphs (Shared Base)

The lore paragraphs are identical across NPC Type `description`, Trait `description`, and Trait `quirk`. They follow this structure:

1. **Origin sentence** - How the species comes into being (transformation, born as yokai, made through ritual, etc.)
2. **Physical features** - Concrete sensory details of their appearance
3. **Reikan sentence** - "These features remain invisible to those without Reikan, though [species] may reveal them at will or find them manifesting unbidden in combat."
4. **Personality and yokai logic** - One-word personality label ("Mischievous by nature"), followed by their alien operating logic explained through concrete examples

### Field-Specific Formats

| Field | Content |
|-------|---------|
| **NPC Type `description`** | Lore paragraphs + skills (single `\n` between blocks) |
| **Trait `description`** | Lore paragraphs + skills (double `\n\n` between blocks) |
| **Trait `quirk`** | Lore paragraphs only, no skills |
| **World Lore `text`** | Narrative prose format (flowing sentence with semicolons) |

### NPC Type Description Format

Lore paragraphs, then skills appended with single newlines:

```
[lore paragraphs] They wield three signature arts:\n[SkillName]: [exact description from skills.json]\n[SkillName]: [exact description from skills.json]\n[SkillName]: [exact description from skills.json]
```

### Trait Description Format

Lore paragraphs, then skills appended with double newlines:

```
[lore paragraphs] They wield three signature arts:\n\n[SkillName]: [exact description from skills.json]\n\n[SkillName]: [exact description from skills.json]\n\n[SkillName]: [exact description from skills.json]
```

### Trait Quirk Format

Lore paragraphs only. No skills section at all. Ends after the personality/yokai logic paragraph.

### World Lore Text Format

The world lore `text` uses a **narrative prose format** with skills woven into a flowing sentence:

```
[lore paragraphs] They wield three signature arts: [SkillName], [description adapted into flowing prose]; [SkillName], [description adapted into flowing prose]; and [SkillName], [description adapted into flowing prose].
```

The skill descriptions from `tabs/skills.json` are adapted into the flowing sentence by:
- Changing first-person perspective to third-person where needed
- Adjusting sentence fragments to fit as subordinate clauses
- Preserving all content and meaning exactly

### Skill Block Format (NPC Type and Trait Description)

Skill descriptions in NPC Type `description` and Trait `description` are **verbatim copies** from `tabs/skills.json`. The format is:

```
SkillName: exact description from skills.json
```

No adaptation, no rewording. Copy the `description` field from skills.json exactly as written.

### Writing Standards

- **No em dashes** in lore paragraphs. Use commas, semicolons, and periods instead.
- **"Three signature arts"** is the standard phrase. Never use "three terrible arts" or other variants.

## Species Skills (3 Required)

Each species trait MUST include exactly **3 skills** that:

1. Reflect innate species abilities
2. Are defined in `tabs/skills.json` with type `"Innate"`
3. Follow the skill description standards: 3 sentences, effect-focused, no em dashes, no bare translation openers

### Skill Description Standards

Skills referenced by species must follow these rules:

1. **3 sentences, effect-focused** - What it does, how it works, what happens when used
2. **No em dashes** - Use periods, commas, and semicolons instead
3. **No translation labels** - Avoid opening with bare translations
4. **Weave name meanings into prose** - Fold the meaning into full sentences
5. **No species-specific details** - Skills are shared; descriptions should be generic

## NPC Species Ability Inheritance

When creating an NPC that has a species `type`, the NPC should gain the **names and descriptions** of that species' 3 skills as abilities in their `abilities` array.

### Process:

1. Look up the species in `tabs/traits.json`
2. Find the 3 skills defined for that species trait
3. Copy those skill names and descriptions into the NPC's `abilities` array
4. Add additional unique abilities specific to that individual NPC
5. Add the `\nfighting style:` summary as the final ability entry

## Required Trait Fields

Every species trait must include all of these fields:

| Field | Requirement |
|-------|-------------|
| `name` | Must match object key exactly |
| `description` | Lore paragraphs + skill blocks (double newline separated) |
| `quirk` | Lore paragraphs only (no skills) |
| `attributes` | Array of attribute modifiers |
| `skills` | Array of exactly 3 Innate skill modifiers |
| `resources` | Array of resource modifiers (can be empty `[]`) |
| `startingItems` | Array of items granted (can be empty `[]`) |
| `abilities` | Array of ability names granted (can be empty `[]`) |
| `unlockedBy` | Leave empty `[]` - NOT YET IMPLEMENTED IN UI |
| `excludedBy` | Leave empty `[]` - NOT YET IMPLEMENTED IN UI |

## Checklist for Creating a New Species

- [ ] Create NPC Type with `description` (lore paragraphs + `\n` skill blocks)
- [ ] Create Trait with all required fields (including `unlockedBy: []` and `excludedBy: []`)
- [ ] Set Trait `description` (lore paragraphs + `\n\n` skill blocks)
- [ ] Set Trait `quirk` (lore paragraphs only, no skills)
- [ ] Include exactly 3 Innate skills in the Trait
- [ ] Create World Lore entry with `text` (narrative prose format)
- [ ] Verify lore paragraphs are identical across NPC Type, Trait description, and Trait quirk
- [ ] Verify skills exist in `tabs/skills.json` with type `"Innate"`
- [ ] Verify skill descriptions follow the 3-sentence standard

## Checklist for Updating a Species Description

- [ ] Update the NPC Type `description` first (canonical source for lore paragraphs)
- [ ] Derive Trait `description` (same lore + `\n\n` skill blocks)
- [ ] Derive Trait `quirk` (same lore, no skills)
- [ ] Update World Lore `text` (narrative prose format)
- [ ] Verify no em dashes, uses "three signature arts"

## Checklist for Creating an NPC of a Species

- [ ] Set `type` to the species NPC Type key
- [ ] Copy the 3 species skills from the trait as abilities
- [ ] Add unique individual abilities
- [ ] Add fighting style summary
- [ ] Reference species features in `basicInfo` appearance sentence
