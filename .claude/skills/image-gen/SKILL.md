---
name: image-gen
description: Generate images using Google Gemini (Nano Banana) image generation API via a Node.js script.
---

# Image Generation

```bash
node .claude/skills/image-gen/scripts/generate-image.mjs -n <name> [options] <prompt>
```

Run from the project root. Set Bash timeout to **120000ms**.

## Important

**Always run image generation directly via Bash.** Never delegate to a background agent (subagent) — the interactive approval workflow (generate → show → approve/retry) requires direct orchestrator control. Concurrent Bash calls with the same `-n` name are safe (the script uses atomic file creation). Failed API calls clean up after themselves.

## Options

| Flag | Short | Required | Description |
|------|-------|----------|-------------|
| `--name` | `-n` | Yes | Output name (e.g. `onmyoji`). Auto-increments: `onmyoji-000.png`, `onmyoji-001.png`, etc. |
| `--model` | `-m` | No | `gemini-3.1-flash-image-preview` (default), `gemini-3-pro-image-preview`, `gemini-2.5-flash-image` |
| `--ratio` | `-r` | No | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3` |
| `--size` | `-s` | No | `512`, `1K`, `2K`, `4K` |
| `--input` | `-i` | No | Path to input image(s) for image-to-image editing. Can be specified multiple times for multi-reference. |

## Output

- Images save to `images/generated/<name>.png`
- Metadata saves to `images/generated/json/<name>.json` (prompt, model, ratio, size, date)
- Auto-increments if name already exists
- Stdout prints the path — use **Read** tool to view it

## Character Portrait Workflow

When the user asks for a portrait of an NPC:

1. Read `tabs/npcs.json` and find the NPC entry
2. If the user wants to change appearance details before generating, update `basicInfo` in `tabs/npcs.json` first (with user approval via AskUserQuestion). The prompt is always curated from the current basicInfo — never invent appearance details directly in the prompt that aren't in basicInfo.
3. Curate `basicInfo` down to **visual/appearance details only**. Keep gender and NPC type as they set visual tone. Drop narrative role, relationships, and lore. Include **all physical features** (ears, tails, horns, wings, skin texture, missing limbs, etc.) even if they extend beyond the frame — the model handles composition. Always include the primary weapon. Be selective with other accessories — pick **1-2 signature items**, not every item mentioned. Too many props create visual clutter.
   - **Keep:** `[gender], [type], [build], [hair], [eyes], [fangs/claws/horns/ears/tails/wings/skin], [clothing + 1-2 items]`
   - **Drop:** `serving as [role]`, `bound as one of [master]'s [group]`, `who commands [unit]`
4. Extract the **single keyword** before the colon from each personality trait (e.g. "Enigmatic" from "Enigmatic: No one knows where the act ends"). **Present the trait options to the user** and let them choose — do not pick for them.
5. Assemble the prompt:

```
Make a character for an anime close-up on the face and upper shoulders in the official, professional Fate/Apocrypha art style. [curated appearance]. [single-word trait]. Type-Moon aesthetic. Ufotable art style, with a detailed ufotable face and kyoto animation eyes, minimal shadows. Thin lines. Kyoto Animation influence.
```

   Examples of curated appearance text (between the style prefix and the keyword suffix):
   - `A male half-kitsune onmyoji with a youthful build, long white hair and golden eyes, with fangs and white-furred fox ears and a single matching tail. Wears the kariginu of a court official bearing a pentagram crest, with paper strips tucked into both sleeves and a folding fan.`
   - `A male onmyōji. Wiry build with tied-back greying black hair and dark brown eyes. Wears the kariginu of a court official, immaculately maintained, with a lacquered astrolabe case and ink-stained calligraphy set at his belt.`
   - `A male ōkami with an imposing build, tied-back grey hair and golden eyes, with fangs, sharp claws, and grey-furred wolf ears and a matching tail. Wears an immaculate suikan.`
   - `A male saburai with a refined build, tied-back black hair and dark brown eyes. Wears elaborately patterned armor with dragon motifs and an ornate kabuto.`

6. **Never modify the approved prompt without flagging the change.** If a previous generation didn't capture a detail (e.g., build reads too thin), explain the issue and propose a prompt change before regenerating. Do not silently add words to the prompt.
7. Run with `-n [npc-name-lowercase]` `-r 1:1` `-s 1K`
8. Show the image and **wait for user approval**. If touch-ups are needed, use `-i` to edit the existing image rather than regenerating from scratch. When the user specifies a base image for img-to-img edits, use that base for all subsequent retries unless the user explicitly changes it.
9. Only once approved, upload with `-n` to move to `images/uploaded/`:

```bash
node .claude/skills/image-gen/scripts/upload-image.mjs -n [npc-name-lowercase] images/generated/<file>.png
```

This uploads, prints the URL, and moves the file to `images/uploaded/{name}-{hash}.png`.

10. Add the returned URL as `"portraitUrl"` on the NPC entry in `tabs/npcs.json`

### Batch Portrait Workflow

When generating portraits for multiple NPCs at once:

1. Curate appearance text and collect personality keywords for all NPCs upfront
2. Run all `generate-image.mjs` calls concurrently via background Bash. The script uses atomic file creation so concurrent runs with the same `-n` name are safe. Some may fail due to API rate limits — just retry the failures.
4. Show all variants to the user and collect picks
5. For each picked variant, upload and write `portraitUrl`
6. Clean up unpicked variants:

```bash
node .claude/skills/image-gen/scripts/cleanup-variants.mjs -n [name] -k [picked-number]
```

This moves all variants of `[name]` except the picked one (and their metadata JSON) to `images/generated/unused/`.

## Prompt Tips

Be specific: not "a tavern" but "a dimly lit medieval tavern with smoke curling from a stone hearth, amber candlelight, rough oak tables stained with ale."
