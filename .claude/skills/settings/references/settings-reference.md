# Settings Reference

Complete documentation for `tabs/settings.json`.

## AttributeSettings Schema

```typescript
interface AttributeSettings {
  attributeNames: string[]                    // ✅ Thematic attribute names for the world
  startingAttributeValue: number              // ✅ Base attribute value (balanced: 0)
  startingAttributePoints: number             // ✅ Points to allocate at creation (balanced: 0)
  maxStartingAttribute: number                // ✅ Hard cap at creation (balanced: 0)
  attributeBonusModifier: number              // ✅ Multiplier for attribute bonus to checks (balanced: 2.5)
  lowAttributeThreshold: number               // ✅ Below this grants weakness traits (balanced: 8)
  lowAttributeTraits?: Record<string, string> // ✅ Weakness descriptions per attribute
  attributeStatModifiers?: Record<string, AttributeStatModifier>  // ✅ Keyed by attribute name
}

interface AttributeStatModifier {
  variable: string                            // Resource name (e.g. 'health' or custom resource)
  amount: number                              // Bonus per attribute point
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, used directly

## SkillSettings Schema

```typescript
interface SkillSettings {
  trainingCooldown: number                    // ✅ Ticks between training (balanced: 10)
  skillBonusModifier: number                  // ✅ Multiplier for skill level to checks (balanced: 1)
  maxSkillLevel: number                       // ✅ Maximum skill level (balanced: 999)
  maxSkillSuccessLevel: number                // ✅ Maximum absolute contribution any single skill, attribute, ability, random roll, or context modifier can make to a success check (balanced: 999)
  startingXPToLevelUpSkill: number            // ✅ XP for first skill level (balanced: 50)
  additionalXPRequiredPerSkillLevel: number   // ✅ Additional XP per level (balanced: 50)
  baseXPFromSkillUpgrade: number              // ✅ Bonus XP on skill level-up (balanced: 100)
  charXPPerSkillLevel: number                 // ✅ Character XP from skill progression (balanced: 100)
  baseChanceToLearnNewSkill: number           // ✅ Learning success rate 0-1 (balanced: 1)
  skillLearningBonusModifier: number          // ✅ Attribute contribution to learning (balanced: 1)
  xpFromNewSkill: number                     // ✅ Character XP awarded when learning a new skill (balanced: 200)
  skillTypeDifficultyBonus: Record<string, number>  // ✅ Bonus by skill type, always include "none": 0
  skillXPRewards: SkillXPRewards              // ✅ XP amounts by impact size
}

interface SkillXPRewards {
  small: number                               // ✅ XP for small impact (balanced: 50)
  medium: number                              // ✅ XP for medium impact (balanced: 100)
  large: number                               // ✅ XP for large impact (balanced: 150)
  huge: number                                // ✅ XP for huge impact (balanced: 200)
}
```

## LocationSettings Schema

```typescript
interface LocationSettings {
  regionSize: number                          // ✅ Region size in km (balanced: 100)
  simpleRadius: number                        // ✅ Simple interaction radius in km (balanced: 5)
  complexRadius: number                       // ✅ Complex interaction radius in km (balanced: 10)
  regionLocationCount: number                 // ✅ Locations per region (world-specific)
  regionFactionCount: number                  // ✅ Factions per region (world-specific)
  avgTravelDistance: number                   // ✅ Average distance between locations (balanced: 40)
  minTravelDistance: number                   // ✅ Minimum distance between locations (balanced: 20)
  newRegionGenerationEnabled: boolean         // ✅ Whether the engine pre-generates adjacent regions as players approach boundaries (default: true). Set false to keep the world bounded to predefined regions only.
  encountersEnabled: boolean                  // ✅ Whether random wilderness encounters can interrupt travel between locations (default: false)
}
```

## ItemSettings Schema

```typescript
interface ItemSettings {
  currencyName: string                        // ✅ Thematic currency name (world-specific)
  startingItems: StartingItem[]               // ✅ Items at character creation (balanced: [])
  itemCategories: string[]                    // ✅ Must include "Armor", "Consumable"
  itemSlots: ItemSlot[]                       // ✅ Must include 7 armor slots
}

interface StartingItem {
  name: string                                // Item key from items.json
  quantity: number                            // Number of items
}

interface ItemSlot {
  slot: string                                // Slot name (head, chest, etc.)
  category: string                            // Category from itemCategories
  quantity: number                            // Max items in slot
}
```

### Required Item Slots

Always include these 7 armor slots:

| Slot | Category | Quantity |
|------|----------|----------|
| head | Armor | 1 |
| chest | Armor | 1 |
| shoulders | Armor | 1 |
| hands | Armor | 1 |
| waist | Armor | 1 |
| legs | Armor | 1 |
| feet | Armor | 1 |

## CombatSettings Schema

```typescript
interface CombatSettings {
  baseCombatXP: number                        // ✅ Base XP for combat victory (balanced: 200)
  minCombatXP: number                         // ✅ Minimum XP from combat (balanced: 50)
  abilityCooldown: number                     // ✅ Default ability cooldown in ticks (balanced: 0)
  abilityBonus: number                        // ✅ Bonus for ability checks (balanced: 10)
  npcDailyHealingAmount: number               // ✅ NPC healing per day (balanced: 999)
  damageTypes: string[]                       // ✅ Available damage types (world-specific)
}
```

## OtherSettings Schema

```typescript
interface OtherSettings {
  startingCharacterLevelUpRequirement: number // ✅ Base XP for level 1 (balanced: 500)
  extraRequiredXPPerCharacterLevel: number    // ✅ Additional XP per level (balanced: 100)
  maxCharacterLevel: number                   // ✅ Maximum character level (balanced: 999)
  npcHealthPerLevel: number                   // ✅ NPC HP per level (balanced: 10)
  npcMinHealth: number                        // ✅ NPC base HP (balanced: 0)
}
```

Player HP scaling lives on the health resource in `resourceSettings` — `maxValue` is the level-1 maximum and `gainPerLevel` is the per-level growth. See the Resource schema in the ai-instructions reference.

## Skill Check Formula

```
successScore = totalBonus - totalDifficulty

totalBonus = skillBonus + attributeBonus + earlyGameBonus + randomBonus + modifierBonus

Where:
  skillBonus = skillBonusModifier * effectiveSkillLevel
  attributeBonus = (effectiveAttribute - 10) * attributeBonusModifier
  earlyGameBonus = 10 (if gameTick < 50, else 0)
```

## Combat Balance System

### Player HP Formula

```
Player HP at level L = resourceSettings.health.maxValue
                     + gainPerLevel × (L - 1)
                     + milestoneHealthBonus
```

Where `milestoneHealthBonus = floor(L / 5) × 5`. `maxValue` is level-1 HP; `gainPerLevel` accrues from level 2 onward.

Example at level 20 with balanced values (maxValue=80, gainPerLevel=10):
- Base: 80 + (10 × 19) = 270
- Milestone: floor(20/5) × 5 = 20
- Total: 290 HP

### Player Damage Formula

```
Player DPR = 16.4 + (2.5 × level) + milestoneDamageBonus
```

Where `milestoneDamageBonus = floor(level / 5) × 2`

These are engine constants, not configurable. They determine how fast players deal damage at each level.

### NPC HP Formula

```
NPC HP = (npcHealthPerLevel × level + npcMinHealth) × tierHPModifier
```

| Tier | HP Modifier |
|------|-------------|
| trivial | 0.15 |
| weak | 0.5 |
| average | 1.0 |
| strong | 1.25 |
| elite | 1.5 |
| boss | 1.7 |
| mythic | 1.85 |

### NPC Tier Damage Modifiers

Each tier also scales NPC damage output (engine constants, not configurable):

| Tier | Damage Modifier |
|------|-----------------|
| trivial | 0.65 |
| weak | 0.8 |
| average | 1.0 |
| strong | 1.12 |
| elite | 1.25 |
| boss | 1.35 |
| mythic | 1.55 |

### Milestone Bonuses

Players receive milestone bonuses every 5 character levels (engine constants):

| Milestone | HP Bonus | Damage Bonus |
|-----------|----------|--------------|
| Every 5 levels | +5 HP | +2 damage |

Example at level 25: 5 milestones = +25 HP, +10 damage on top of per-level scaling.

### Difficulty Multipliers

NPC stats scale by encounter difficulty (engine constants, not configurable):

| Difficulty | NPC Damage | NPC Health |
|------------|------------|------------|
| very easy | 0.7× | 0.5× |
| easy | 0.85× | 0.75× |
| medium | 1.0× | 1.0× |
| hard | 1.15× | 1.25× |
| very hard | 1.3× | 1.5× |

### Encounter Health Budget

The engine targets **4 rounds** to kill (TTK) when sizing encounters:

```
Encounter HP Budget = 4 × effectivePartySize × playerExpectedDPR
```

Where `effectivePartySize = playerCount + (npcAllyCount × 0.7)`

NPC allies count at 70% effectiveness. This determines total enemy HP the engine distributes across NPCs in a generated encounter.

## Skill XP Requirements

```
XP to reach skill level N = startingXPToLevelUpSkill + (N - 1) * additionalXPRequiredPerSkillLevel
```

With balanced values (50/50):
- Level 1: 50 XP
- Level 10: 500 XP
- Level 30: 1,500 XP

## Character Level XP Requirements

```
XP to reach character level N = startingCharacterLevelUpRequirement + (N - 1) * extraRequiredXPPerCharacterLevel
```

With balanced values (500/100):
- Level 2: 500 XP
- Level 5: 800 XP
- Level 10: 1,300 XP

## Power Level Success Rates

| Power Level | Skill Range | vs Medium (30) | vs Hard (60) |
|-------------|-------------|----------------|--------------|
| I | 1-10 | Fails most | Fails almost all |
| II | 10-30 | Sometimes | Rarely |
| III | 30-40 | Usually | Sometimes |
| IV | 40-60 | Almost always | Usually |

## Cross-References

| Field | References |
|-------|------------|
| `itemSettings.itemCategories` | Used by `tabs/items.json` category field |
| `itemSettings.itemSlots[].category` | Must match `itemCategories` values |
| `combatSettings.damageTypes` | Used by NPC vulnerabilities/resistances/immunities |
| `attributeSettings.attributeNames` | Used in trait and skill attribute associations |
| `resourceSettings` keys | Used by ability and trait resource modifiers |
