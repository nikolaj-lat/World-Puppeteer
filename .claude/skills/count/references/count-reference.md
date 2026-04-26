# Count Reference

Complete character and count limits for world configs.

## Section Limits

| Section | Limit |
|---------|-------|
| Total config | 10,000,000 chars |
| worldLore | 500,000 chars |
| npcs | 1,000,000 chars |
| locations | 1,000,000 chars |
| npcTypes | 500,000 chars |
| items | 100,000 chars |
| factions | 100,000 chars |
| regions | 100,000 chars |
| traitCategories | 100,000 chars |
| realms.[id].basicInfo | 100,000 chars |
| itemSettings | 5,000 chars |

## Field Limits

| Field | Limit |
|-------|-------|
| storySettings.worldBackground | 5,000 chars |
| storySettings.questGenerationGuidance | 5,000 chars |
| Individual AI instruction | 5,000 chars |
| AI task instructions (combined) | 20,000 chars |
| narratorStyle | 2,000 chars |
| abilities.[id].description | 2,000 chars |
| Individual worldLore entry text | 4,000 chars |
| Individual story start | 4,000 chars |
| Individual item description | 4,000 chars |
| factions.[id].basicInfo | 4,000 chars |
| factions.[id].hiddenInfo | 4,000 chars |
| npcTypes.[id].description | 8,000 chars |
| Individual NPC (combined fields) | 8,000 chars |
| regions.[id].basicInfo | 4,000 chars |
| regions.[id].hiddenInfo | 4,000 chars |
| locations.[id].basicInfo | 8,000 chars |
| locations.[id].hiddenInfo | 8,000 chars |
| locations.[id].areas.[areaId].description | 4,000 chars |
| traits.[id].description | 4,000 chars |
| death.instructions | 4,000 chars |
| Trigger condition query | 1,000 chars |
| Trigger effect instruction | 1,000 chars |
| Trigger condition value | 100 chars |
| Trigger effect value | 100 chars |

## Count Limits

| Element | Max Count |
|---------|-----------|
| Story starts | 100 |
| Semantic triggers (story/action conditions) | 200 |
| Mechanical triggers (all other conditions) | 500 |
| Abilities | 1,000 |
| Trigger conditions (per trigger) | 5 |
| Trigger effects (per trigger) | 5 |
| Individual trigger size | 10,000 chars |
| Ability requirements | 10 |

## Script Usage

```bash
node .claude/scripts/count.js              # defaults to tabs/
node .claude/scripts/count.js ./tabs/      # explicit path
node .claude/scripts/count.js --json       # JSON output
```

## Output Indicators

| Status | Meaning |
|--------|---------|
| 🟢 OK | Under limit |
| 🟡 WARNING | >80% of limit |
| 🔴 OVER | Exceeds limit |
