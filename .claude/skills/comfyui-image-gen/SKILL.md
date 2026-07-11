---
name: comfyui-image-gen
description: Generate images by talking directly to a running ComfyUI instance via cli.exe (default, no server), or via the comfyui-api server.
---

# Image Generation

```bash
.claude/skills/comfyui-image-gen/cli.exe --workflow <workflow>.json --out images/generated/<name>.png --prompt "<prompt>"
```

Run from the project root. Set Bash timeout to **120000ms** (the **first** generation in a session is slow while the model loads; later ones are fast).

There are no built-in workflows. Before generating, **discover what workflows exist and let the user pick one** — see [Choosing a workflow](#choosing-a-workflow).

This is the default generator: **`cli.exe`** talks **directly to a running ComfyUI** instance (default `127.0.0.1:8188`) and writes straight to a file — **no persistent server is required, only ComfyUI itself must be running.**

> **Note:** `cli.exe` collects images from the workflow's `SaveImage` or `PreviewImage` nodes. If a workflow has only a `PreviewImage` node (no `SaveImage`), add `--preview` so the image can be collected — otherwise the run finishes with no output. (See *Auto-retry with `--preview`* under **Important**.)

One fallback remains:
- **`generate-comfy.mjs`** — the server-based path, for when the **comfyui-api** FastAPI server (`127.0.0.1:5000`) is already running. See [Server-based alternative](#server-based-alternative-generate-comfymjs).

## Getting cli.exe

`cli.exe` is **not committed to this repo** (it's a build artifact, gitignored). Its source lives at **[Oratorian/comfyui-api](https://github.com/Oratorian/comfyui-api)**, where CI publishes a prebuilt Windows bundle as a release asset: **`comfyui-api-cli-windows.zip`** (it contains `cli.exe` and an empty `workflows/` folder — workflows are not shipped, since they depend on locally installed models).

**Windows — fetch the prebuilt binary if missing.** If `.claude/skills/comfyui-image-gen/cli.exe` is absent, download the CLI zip from the latest release and extract `cli.exe` from it. The orchestrator may do this automatically when the binary is missing — it will always show the source URL first.

```bash
# from project root
mkdir -p .claude/skills/comfyui-image-gen
curl -L -o /tmp/comfyui-api-cli.zip \
  https://github.com/Oratorian/comfyui-api/releases/latest/download/comfyui-api-cli-windows.zip

# (IMPORTANT!) verify the download. Three tiers, strongest first:
#   1. gh attestation verify  — full cryptographic provenance (needs gh CLI)
#   2. curl the attestations REST API by digest — proves an attestation exists
#      for THIS exact hash in this repo (no gh needed; works unauthenticated on
#      a public repo). Does not re-check the Sigstore signature, but binds the
#      binary's hash to a repo attestation — much stronger than a checksum alone.
#   3. .sha256 checksum — integrity only (bytes intact), last resort.
digest=$(sha256sum /tmp/comfyui-api-cli.zip | awk '{print $1}')
verified=""
if command -v gh >/dev/null 2>&1 && \
   gh attestation verify /tmp/comfyui-api-cli.zip --repo Oratorian/comfyui-api >/dev/null 2>&1; then
  verified="attestation (gh)"
else
  # No gh (or it failed): query the attestations API directly by digest.
  count=$(curl -sL -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/Oratorian/comfyui-api/attestations/sha256:$digest" \
    | grep -c '"bundle_url"')   # >=1 means an attestation exists for this hash
  if [ "${count:-0}" -ge 1 ]; then
    verified="attestation (api)"
  else
    # Fall back to the published checksum. Compare the hash field directly (the
    # .sha256 lists the original asset name; our local file is renamed).
    expected=$(curl -sL \
      https://github.com/Oratorian/comfyui-api/releases/latest/download/comfyui-api-cli-windows.zip.sha256 \
      | awk '{print $1}')
    [ -n "$expected" ] && [ "$expected" = "$digest" ] && verified="checksum"
  fi
fi
[ -n "$verified" ] || { echo "verification FAILED — do not run"; exit 1; }
echo "verified via: $verified"

# extract just cli.exe into the skill folder
unzip -o -j /tmp/comfyui-api-cli.zip cli.exe -d .claude/skills/comfyui-image-gen/
```

PowerShell equivalent:

```powershell
$zip = "$env:TEMP\comfyui-api-cli.zip"
Invoke-WebRequest -Uri "https://github.com/Oratorian/comfyui-api/releases/latest/download/comfyui-api-cli-windows.zip" -OutFile $zip

# (IMPORTANT!) verify. Three tiers, strongest first:
#   1. gh attestation verify (full provenance)  2. attestations REST API by
#   digest (no gh needed)  3. .sha256 checksum (integrity only).
$digest = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
$verified = $null
if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh attestation verify $zip --repo Oratorian/comfyui-api 2>$null
    if ($LASTEXITCODE -eq 0) { $verified = "attestation (gh)" }
}
if (-not $verified) {
    # No gh (or it failed): query the attestations API directly by digest.
    try {
        $att = Invoke-RestMethod -Headers @{ Accept = "application/vnd.github+json" } `
            -Uri "https://api.github.com/repos/Oratorian/comfyui-api/attestations/sha256:$digest"
        if ($att.attestations.Count -ge 1) { $verified = "attestation (api)" }
    } catch { }
}
if (-not $verified) {
    # Fall back to the published checksum (integrity only).
    $expected = (Invoke-WebRequest -Uri "https://github.com/Oratorian/comfyui-api/releases/latest/download/comfyui-api-cli-windows.zip.sha256").Content.Trim().Split()[0]
    if ($digest -eq $expected) { $verified = "checksum" }
}
if (-not $verified) { throw "verification FAILED — do not run" }
Write-Host "verified via: $verified"

Expand-Archive -Path $zip -DestinationPath "$env:TEMP\comfyui-api-cli" -Force
Copy-Item "$env:TEMP\comfyui-api-cli\cli.exe" ".claude\skills\comfyui-image-gen\cli.exe" -Force
```

**Verify the download (attestation first, checksum last).** Every release
carries a GitHub build-provenance attestation *and* a `comfyui-api-cli-windows.zip.sha256`
asset. Verify in three tiers, strongest first (the snippets above do this
automatically):

1. **`gh attestation verify <zip> --repo Oratorian/comfyui-api`** — full
   cryptographic provenance. Requires the `gh` CLI. Best when available.
2. **Attestations REST API by digest** — for clients without `gh`. Compute the
   zip's SHA-256, then
   `GET https://api.github.com/repos/Oratorian/comfyui-api/attestations/sha256:<digest>`
   (plain `curl`, no auth needed on this public repo). A non-empty
   `attestations` array means an attestation exists for *this exact hash* in
   this repo — much stronger than a checksum, though it doesn't re-check the
   Sigstore signature the way tier 1 does.
3. **`.sha256` checksum** — integrity only (bytes intact, origin unproven). Last
   resort when neither attestation path is reachable.

If none of the tiers verifies, the download is corrupt or tampered — stop,
re-fetch, and do not run it.

### Checking for updates

`cli.exe` has no self-update. To check whether a newer build is available,
read the installed binary's version with `cli.exe --version` and compare it
against the latest release tag from the GitHub API.

```bash
# from project root
cli=".claude/skills/comfyui-image-gen/cli.exe"
[ -f "$cli" ] || { echo "not installed — see 'Getting cli.exe'"; exit 0; }
local=$("$cli" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
latest=$(curl -sL "https://api.github.com/repos/Oratorian/comfyui-api/releases/latest" \
  | grep -oE '"tag_name":\s*"[^"]+"' | head -1 | sed -E 's/.*"v?([^"]+)".*/\1/')
if [ -z "$local" ]; then
  echo "update available — installed build predates '--version' (latest v$latest)"
elif [ "$local" = "$latest" ]; then
  echo "up to date (v$latest)"
else
  echo "update available — installed v$local, latest v$latest"
fi
```

```powershell
# from project root
$cli = ".claude\skills\comfyui-image-gen\cli.exe"
if (-not (Test-Path $cli)) { "not installed — see 'Getting cli.exe'"; return }
$local  = (& $cli --version 2>$null | Select-String -Pattern '\d+\.\d+\.\d+' | ForEach-Object { $_.Matches[0].Value } | Select-Object -First 1)
$latest = ((Invoke-RestMethod "https://api.github.com/repos/Oratorian/comfyui-api/releases/latest").tag_name -replace '^v','')
if (-not $local)            { "update available — installed build predates '--version' (latest v$latest)" }
elseif ($local -eq $latest) { "up to date (v$latest)" }
else                        { "update available — installed v$local, latest v$latest" }
```

A binary that doesn't recognize `--version` predates the release that added
the flag, so treat that as "update available." To upgrade, re-run the
**Getting cli.exe** steps — they re-download, re-verify (attestation →
checksum), and overwrite the binary.

**Linux / macOS — run from source.** There is no `.exe` for non-Windows. Clone [Oratorian/comfyui-api](https://github.com/Oratorian/comfyui-api), install its requirements, and call the Python entrypoint directly — it takes the same flags as `cli.exe`:

```bash
python cli.py --workflow <workflow>.json --out images/generated/<name>.png --prompt "<prompt>"
```

Everywhere `cli.exe` appears below, substitute `python cli.py` on Linux/macOS. The flags, defaults, and behavior are identical.

## Important

**Always run image generation directly via Bash.** Never delegate to a background agent (subagent) — the interactive approval workflow (generate → show → approve/retry) requires direct orchestrator control. Each `cli.exe` run is an independent subprocess that writes its own `--out` file, so concurrent runs are safe as long as each uses a distinct `--out` path.

**Auto-retry with `--preview` on a no-image result.** If a generation yields no usable image — `cli.exe` exits non-zero with *"produced no images"* and writes no file, **or** the written file is zero-byte / not a PNG / an all-black square — retry the exact same command with `--preview` added. The usual cause is a workflow whose only image output is a `PreviewImage` node (no `SaveImage`); `--preview` lets that image be collected. If it still fails with `--preview`, the workflow has no usable image-output node and the prompt/workflow itself needs attention — do not keep retrying blindly.

## Options (cli.exe — default)

| Flag | Required | Description |
|------|----------|-------------|
| `--prompt` | Yes | Positive prompt. |
| `--out` | No | Output file (default `output.png`). For portraits, write into `images/generated/<name>.png`. With `--all`, an index is inserted (`out.png` → `out_0.png`, `out_1.png`, …). |
| `--workflow` | No | Workflow file: a name resolved inside the workflows folder, or a path. Default `base_workflow.json`. The prompt format (Natural Language vs. Danbooru/Gelbooru tags vs. both) depends on the model the workflow loads — **ask the user** (see [Choosing a workflow](#choosing-a-workflow)). Must be **Export (API)** format. |
| `--workflow-dir` | No | Folder to resolve `--workflow` names against. Defaults to the `workflows/` folder beside `cli.exe` (`.claude/skills/comfyui-image-gen/workflows/`), or the `COMFYUI_WORKFLOW_DIR` env var if set. The explicit flag takes precedence over the env var. |
| `--list-workflows` | No | List the available workflow files (in `--workflow-dir` / the default workflows folder) and exit. Does not require `--prompt`. Prints a `workflow dir: <path>` header followed by the `.json` file names; errors with `workflow dir ... does not exist` if the folder is missing, or `... contains no .json workflow files` if it has none. |
| `--negative` | No | Negative prompt (default empty). Supply a painterly-leaning quality negative for the house look. |
| `--width` / `--height` | No | Output size override (px). Omit to use the workflow's own values. |
| `--batch` | No | Images per run override. |
| `--img2img` | No | Source image → image-to-image (the workflow needs a `LoadImage` node). |
| `--index` | No | Which image to save, in ComfyUI execution order. `-1` (default) = the last/final image. Ignored with `--all`. |
| `--all` | No | Save every collected image (with an index suffix), not just one. |
| `--preview` | No | Also collect images from `PreviewImage` nodes. Needed when a workflow's only image output is a `PreviewImage` node (no `SaveImage`). On its own it does not change selection — `--index`/`--all` still pick which collected image(s) to save. |
| `--comfyui-host` | No | ComfyUI host as `ip:port` (default `COMFYUI_HOST` env or `127.0.0.1:8188`). |

## Output (cli.exe)

- Writes the PNG to the `--out` path you give. For portraits, target `images/generated/<name>.png` so the upload/cleanup scripts can find it.
- **No auto-increment and no metadata JSON** — pick a unique `--out` name yourself (e.g. add a numeric suffix per variant). This is a difference from `generate-comfy.mjs`.
- It prints nothing automatically — use the **Read** tool on the `--out` path to view the result.

## Choosing a workflow

There are **no built-in workflows** — they depend on locally installed models, so the user supplies them. Never assume a workflow name. Before any generation:

1. **List what's available** with `--list-workflows`:

   ```bash
   .claude/skills/comfyui-image-gen/cli.exe --list-workflows
   ```

   This prints the `workflow dir` path followed by the `.json` files it contains.

2. **Ask the user which workflow to use.** Present the listed files and let them choose — do not pick for them.

3. **Ask the user what prompt format the model supports.** This cannot be inferred from the workflow name — it depends on the model the workflow loads. Ask explicitly whether the model supports:
   - **Natural Language** — descriptive prose sentences.
   - **Danbooru / Gelbooru tags** — comma-separated booru tags (`1girl, silver hair, armor, dramatic lighting, ...`).
   - **Both** — the model accepts either; you may mix prose with tags.

   Write the prompt in the format the user specifies. Do not assume — a mismatch (prose into a tag-only model, or tags into a prose-only model) produces poor results.

4. **Handle an empty or missing dir.** If `--list-workflows` reports the folder is missing (`workflow dir ... does not exist`) or contains no workflows (`... contains no .json workflow files`), tell the user — generation cannot proceed until a workflow exists. Instruct them to:
   - In ComfyUI, enable **dev mode**: Settings → enable **"Dev mode"** (this exposes the API export option).
   - Build or load the workflow they want, then export it via **File → Export (API)**.
   - Save the resulting `.json` into the workflows folder (`.claude/skills/comfyui-image-gen/workflows/`, or wherever `--workflow-dir` / `COMFYUI_WORKFLOW_DIR` points).
   - Re-run `--list-workflows` to confirm it appears, then ask which to use.

   Plain **Save** does **not** work — `cli.exe` requires the **Export (API)** format, which only appears once dev mode is enabled.

## Style & Workflow Notes

- Workflow files live in the **`workflows/` folder beside `cli.exe`** (`.claude/skills/comfyui-image-gen/workflows/`) unless overridden with `--workflow-dir` or the `COMFYUI_WORKFLOW_DIR` env var. They must be exported from ComfyUI in **Export (API)** format. Reference one by bare name (`--workflow <name>.json`) or by path. If the folder is missing, `cli.exe` reports it — create it or point `--workflow-dir`/`COMFYUI_WORKFLOW_DIR` at your workflows. Run `--list-workflows` to see what's available (see [Choosing a workflow](#choosing-a-workflow)).
- **Match the prompt to the model's format.** A model supports Natural Language, Danbooru/Gelbooru tags, or both — this can't be guessed from the workflow name. **Ask the user** which (see [Choosing a workflow](#choosing-a-workflow)) before writing the prompt: prose for natural language, comma-separated booru tags (`1boy, black hair, painterly, dramatic lighting, ...`) for tag models, either/mixed if both.
- **Name the style explicitly** when the workflow won't infer one. For the world's house look, ask for a **semi-realistic painterly RPG character splash art**: "painted brushstrokes, dramatic chiaroscuro, warm rim light, oil-painting texture, loose abstract painterly background, moody cinematic color." Avoid flat-anime phrasing unless you want flat anime.

## Character Portrait Workflow

When the user asks for a portrait of an NPC:

1. Read `tabs/npcs.json` and find the NPC entry
2. If the user wants to change appearance details before generating, update `basicInfo` in `tabs/npcs.json` first (with user approval via AskUserQuestion). The prompt is always curated from the current basicInfo — never invent appearance details directly in the prompt that aren't in basicInfo.
3. Curate `basicInfo` down to **visual/appearance details only**. Keep gender and NPC type as they set visual tone. Drop narrative role, relationships, and lore. Include **all physical features** (ears, tails, horns, wings, skin texture, missing limbs, etc.) even if they extend beyond the frame — the model handles composition. Always include the primary weapon. Be selective with other accessories — pick **1-2 signature items**, not every item mentioned. Too many props create visual clutter.
   - **Keep:** `[gender], [type], [build], [hair], [eyes], [fangs/claws/horns/ears/tails/wings/skin], [clothing + 1-2 items]`
   - **Drop:** `serving as [role]`, `bound as one of [master]'s [group]`, `who commands [unit]`
4. Extract the **single keyword** before the colon from each personality trait (e.g. "Enigmatic" from "Enigmatic: No one knows where the act ends"). **Present the trait options to the user** and let them choose — do not pick for them.
5. **Pick the workflow and confirm the prompt format** ([Choosing a workflow](#choosing-a-workflow)) — list available workflows, ask the user which to use, and ask whether the model supports Natural Language, Danbooru/Gelbooru tags, or both. Then assemble the prompt in that format. For a natural-language model, lead with the **style**, then the curated appearance:

```
A semi-realistic painterly digital portrait, RPG character splash art, painted brushstrokes, dramatic chiaroscuro with warm rim light, tight head-and-shoulders close-up, [framing/expression]. [curated appearance]. Loose abstract painterly background, moody cinematic color, oil-painting texture.
```

   Keep the curated appearance to visual facts only (build, hair, eyes, distinctive features, clothing + 1–2 signature items, primary weapon). Name the **style explicitly** when the model won't infer one. For a tag-based model, rewrite the whole thing as Danbooru/Gelbooru comma tags instead.

6. **Never modify the approved prompt without flagging the change.** If a previous generation didn't capture a detail (e.g., build reads too thin), explain the issue and propose a prompt change before regenerating. Do not silently add words to the prompt.
7. Run cli.exe with `--workflow <chosen>.json --out images/generated/[name-lowercase]-000.png --prompt "<prompt>"`. Add `--width 832 --height 1216` to force portrait size. Match the prompt style to the chosen workflow (natural language vs. tags). For each retry/variant, increment the `--out` suffix (`-001`, `-002`, …) yourself — cli.exe does not auto-increment.
8. Show the image and **wait for user approval**. If touch-ups are needed, use `--img2img <path>` to edit the existing image rather than regenerating from scratch. When the user specifies a base image for img2img edits, use that base for all subsequent retries unless the user explicitly changes it.
9. Only once approved, host it for a stable URL (the local file lives under `images/generated/`, but a hosted link is what goes into the config). Images are hosted on a self-hosted **Trinetra** instance (default `https://pixelvault.andrew.home`, override with `TRINETRA_BASE_URL`):

```bash
node .claude/skills/comfyui-image-gen/scripts/upload-image.mjs -n [name-lowercase] -l <purpose-label> -U <username> images/generated/<file>.png
```

**Always pass `-l <purpose-label>`** — this names the image *on the server* (`PATCH /api/images/:id`, cosmetic `original_name`; the URL/id never change) so the LLM can later tell which `/i/<url>` is for what, straight from the gallery or `GET /api/images`. **Name by what the image is FOR, using an `<purpose>_<name>` convention:**

| Image is a… | Label |
|---|---|
| Character/NPC portrait | `portrait_<name>` (e.g. `portrait_leo`) |
| App/scene background | `background_<name>` (e.g. `background_tavern`) |
| Logo / glyph / icon | `logo_<name>`, `glyph_<name>`, `icon_<name>` |
| Anything else | `<purpose>_<name>` — a short descriptive purpose + the subject |

Use lowercase, `_`/`-` separators, no spaces. When uploading an NPC portrait (step 10 flow), the label is `portrait_<npc-name-lowercase>`. Rename is best-effort: if it fails, the upload still succeeds and prints the URL — you just get a warning.

**First run — provisioning credentials:** the instance needs an API key, and the script mints one for you with no browser. **Ask the user for a `username`** (3–32 chars: letters, numbers, `.` `_` `-`) and pass it via `-U <username>`. On that first run the script registers the account (it **generates the password itself** — you do not choose one), mints an API key, and saves `{ base_url, username, password, api_key }` to **`trinetra.credentials`** in the project root (mode `600`). **Later runs reuse that file automatically** — omit `-U` once the file exists. Never commit `trinetra.credentials`; it holds the password and key in plaintext.

The script prints the public URL and moves the file to `images/uploaded/{name}-{hash}.png`. **Notes:**
- If `trinetra.credentials` already exists, `-U` is ignored — the cached key is used.
- A `409` on first run means that username is already taken (or the credentials file was lost); pick a different `-U <username>`.
- Override the instance with `TRINETRA_BASE_URL`, the username with `$TRINETRA_USERNAME`, the credentials path with `-c`/`$TRINETRA_CREDENTIALS`, or skip provisioning entirely by setting `$TRINETRA_API_KEY`.
- If the user already has a hosted image URL, skip this step.

10. Add the returned URL as `"portraitUrl"`:
    - **NPCs** → the NPC entry in `tabs/npcs.json`
    - **Premade characters** (e.g. the fixed protagonist) → the character entry in `tabs/premade-characters.json`
    Then rebuild with `node .claude/scripts/build.js` and validate with `node .claude/scripts/validate.js`.

### Batch Portrait Workflow

When generating portraits for multiple NPCs at once:

1. Curate appearance text and collect personality keywords for all NPCs upfront
2. Run all `cli.exe` calls concurrently via background Bash, each with its own distinct `--out images/generated/[name]-000.png` path. Note ComfyUI processes **one prompt at a time** (extra runs queue), so "concurrent" here means submitted together, not rendered in parallel — they still complete one after another. Retry any that error.
4. Show all variants to the user and collect picks
5. For each picked variant, upload and write `portraitUrl`
6. Clean up unpicked variants:

```bash
node .claude/skills/comfyui-image-gen/scripts/cleanup-variants.mjs -n [name] -k [picked-number]
```

This moves all variants of `[name]` except the picked one to `images/generated/unused/` (along with any sidecar metadata JSON, which only `generate-comfy.mjs` produces — `cli.exe` writes none).

## Prompt Tips

Be specific: not "a tavern" but "a dimly lit medieval tavern with smoke curling from a stone hearth, amber candlelight, rough oak tables stained with ale."

## Server-based alternative (generate-comfy.mjs)

When the **comfyui-api** FastAPI server (`127.0.0.1:5000`) is already running, you can use the original Node.js script instead of `cli.exe`. It submits a job, polls, and downloads from the server's in-memory store:

```bash
node .claude/skills/comfyui-image-gen/scripts/generate-comfy.mjs -n <name> [options] <prompt>
```

Key differences from `cli.exe`: it uses `-n <name>` (auto-increments `name-000.png`, `name-001.png`, …) and writes a metadata JSON to `images/generated/json/<name>.json`; `-i` is its img2img flag; `--host` points at the `:5000` server. It requests preview frames by default (`--no-preview` to skip, **not recommended** — the server keeps images in memory only). Concurrent runs with the same `-n` name are safe (atomic file creation). Prefer `cli.exe` unless the server is the only thing available.
