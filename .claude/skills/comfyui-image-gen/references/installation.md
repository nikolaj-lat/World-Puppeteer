# Image Generation Setup

This skill generates images by talking **directly to a running ComfyUI instance**
via `cli.exe` (no persistent server), with the comfyui-api server as a fallback.
There is no Gemini path in this skill.

## 1. ComfyUI must be running

`cli.exe` connects to ComfyUI at `127.0.0.1:8188` by default (override with
`--comfyui-host` or the `COMFYUI_HOST` env var). Start ComfyUI first; nothing
else generates images.

## 2. Get `cli.exe`

`cli.exe` is a build artifact and is **not committed** to this repo. Fetch and
verify the prebuilt Windows binary (or run from source on Linux/macOS) as
described in the **"Getting cli.exe"** section of the root `SKILL.md`. That
section is authoritative — it covers the download, three-tier attestation/checksum
verification, and update checks.

## 3. Provide workflows

There are **no built-in workflows** (they depend on locally installed models). Export
them from ComfyUI in **Export (API)** format into the workflows folder beside
`cli.exe` (`.claude/skills/comfyui-image-gen/workflows/`), or point `--workflow-dir`
/ `COMFYUI_WORKFLOW_DIR` at your own. See **"Choosing a workflow"** in the root
`SKILL.md`. List what's available with:

```bash
.claude/skills/comfyui-image-gen/cli.exe --list-workflows
```

## 4. Upload credentials (Trinetra / pixelvault)

Hosting a generated image for a stable URL uploads to a self-hosted **Trinetra**
instance. No manual key setup is needed — the upload script provisions an account
and API key on first run (you just supply a username). See
[`image-upload.md`](./image-upload.md) for the full flow and environment overrides.

## Fallback: comfyui-api server (`generate-comfy.mjs`)

If the **comfyui-api** FastAPI server (`127.0.0.1:5000`) is already running, the
`generate-comfy.mjs` script can be used instead of `cli.exe`. See the
**"Server-based alternative"** section of the root `SKILL.md`. Prefer `cli.exe`
unless the server is the only thing available.
