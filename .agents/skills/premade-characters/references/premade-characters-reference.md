# Premade Characters Reference

Complete documentation for `tabs/premade-characters.json`.

`premadeCharacters` is an **array**, not a keyed object. Display order matches array order in the character creation UI.

## Schema

```typescript
interface PremadeCharacter {
  name: string                           // ✅ Character name + identifier
  gender: string                         // ✅ Normalized to "male" | "female" | "non-binary"
  description: string                    // ✅ Short selection-UI blurb; also seeds turn-1 lore retrieval query
  attributes?: Record<string, number>    // ✅ Attribute values keyed by attribute name
  traits?: string[]                      // ✅ Trait names from tabs/traits.json
  backstory?: string                     // ✅ Hand-written backstory; becomes the character's "Background" in every story turn. Falls back to description if absent
  portraitUrl?: string                   // ✅ Image URL for the character portrait (player generates if absent)
  replacesNpc?: string                   // ✅ NPC name from tabs/npcs.json; NPC removed on selection
}
```

### Legend

- ✅ **Predefine-able**: Can be set in config, used directly

## replacesNpc Behavior

When a player selects a premade character with `replacesNpc` set, the engine removes the matching NPC from the game so the same character isn't represented twice.

### Authorization

A `replacesNpc` value from the client is only honored if it exactly matches a premade the client actually selected. This prevents a tampered client from deleting arbitrary NPCs.

### Removal scope

When authorized, the engine:

1. Deletes the NPC entry from `gameState.npcs`
2. Removes the NPC from `partyState.partyMembers` (by both key and name)
3. Removes the NPC from `partyState.sceneNPCs` (by both key and name)

Both timing paths are covered:

| Timing | Behavior |
|--------|----------|
| Game start | NPC filtered during initialization, never appears in the initial state |
| Mid-game join | NPC removed from live state, party, and scene when the joining player selects this premade |

### Silent failure modes

- Missing NPC: if `replacesNpc` doesn't match any entry in `tabs/npcs.json`, the field is silently ignored.
- Unauthorized claim: if the player's selected character doesn't match a premade whose `replacesNpc` has that value, the claim is rejected.

## Initialization Lifecycle

When a player selects a premade character:

### 1. Authorization

`resolveAuthorizedReplacementNpc` validates the claim against `worldConfig.premadeCharacters`.

### 2. Character Creation

A `Player` record is built from the premade fields:
- `name`, `gender` copy over directly; `gender` is normalized to `"male"`, `"female"`, or `"non-binary"`
- `attributes` are applied to the base attribute map (falling back to defaults for any attribute not set); unknown attribute keys are silently ignored
- `traits` are resolved against `tabs/traits.json` and applied via the normal trait application pipeline (stat modifiers, starting items, unlocked abilities); unknown trait names are silently skipped, and `excludedBy` mutual-exclusion rules are bypassed for premades (the engine sets traits directly, so normally-conflicting traits can coexist)
- `portraitUrl` is used as-is (skipped portrait-generation AI task)

### 3. How `description` and `backstory` reach the AI

The story AI sees exactly one character background on each turn: the `Background:` line. That line is populated once at game start.

Assuming the player does NOT customize:

| Condition | Text used as the character's `Background:` every turn |
|-----------|------------------------------------------------------|
| `backstory` set | `backstory` |
| `backstory` absent | `description` |

`description` is also used on turn 1 only as the query that pulls relevant world-lore memories into the opening-scene prompt. `backstory` is not.

**`backstory` is functionally redundant with `description`.** When `backstory` is absent, `description` already covers:

- the selection-UI blurb,
- the character's `Background:` in story generation,
- the turn-1 lore-retrieval query.

The only reason to set `backstory` is if you deliberately want the selection-UI text and the AI's `Background:` text to be different strings. Since `description` is required and accepts any length, there's no good reason to split. Recommend putting everything in `description` and omitting `backstory`.

If the player DOES customize, both `description` and `backstory` are ignored. An AI-generated profile (seeded from the player's edits in the CreateCharacter screens) replaces them as the character's `Background:`.

### 4. NPC Removal

If authorized, the replaced NPC is removed as described above.

### 5. Party Join

The new player character is added to `gameState.characters` and appended to `partyState.partyMembers`.

## Interactions with Other Systems

| System | Interaction |
|--------|-------------|
| Character background AI | Only runs when the player hits "Customize" and "Generate" in character creation. When skipped, the AI-generated profile is not used; the character's `Background:` is taken directly from `backstory` (or `description` if `backstory` is absent) |
| Portrait generation AI | Skipped when `portraitUrl` is predefined |
| Trait application | Runs normally — stat modifiers, starting items, and unlocked abilities from `traits` are applied to the player |
| Starting items | Global `itemSettings.startingItems` + trait-granted items still apply |
| Story starts | Premade characters are compatible with any story start; `startingPartyNPCs` on the story start is independent of `replacesNpc` |

## Cross-References

| Field | References |
|-------|------------|
| `attributes` keys | `attributeSettings.attributeNames` in `tabs/settings.json` |
| `traits` | `tabs/traits.json` (trait names) |
| `replacesNpc` | `tabs/npcs.json` (NPC name) |
